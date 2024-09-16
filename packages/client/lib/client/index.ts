import COMMANDS from './commands';
import { RedisCommand, RedisCommandArgument, RedisCommandArguments, RedisCommandRawReply, RedisCommandReply, RedisFunctions, RedisModules, RedisExtensions, RedisScript, RedisScripts, RedisCommandSignature, ConvertArgumentType, RedisFunction, ExcludeMappedString, RedisCommands } from '../commands';
import RedisSocket, { RedisSocketOptions, RedisTlsSocketOptions } from './socket';
import RedisCommandsQueue, { QueueCommandOptions } from './commands-queue';
import RedisClientMultiCommand, { RedisClientMultiCommandType } from './multi-command';
import { RedisMultiQueuedCommand } from '../multi-command';
import { EventEmitter } from 'events';
import { CommandOptions, commandOptions, isCommandOptions } from '../command-options';
import { ScanOptions, ZMember } from '../commands/generic-transformers';
import { ScanCommandOptions } from '../commands/SCAN';
import { HScanTuple } from '../commands/HSCAN';
import { attachCommands, attachExtensions, fCallArguments, transformCommandArguments, transformCommandReply, transformLegacyCommandArguments } from '../commander';
import { Pool, Options as PoolOptions, createPool } from 'generic-pool';
import { ClientClosedError, ClientOfflineError, DisconnectsClientError, ErrorReply } from '../errors';
import { URL } from 'url';
import { TcpSocketConnectOpts } from 'net';
import { PubSubType, PubSubListener, PubSubTypeListeners, ChannelListeners } from './pub-sub';

import {version} from '../../package.json';

export interface RedisClientOptions<
    M extends RedisModules = RedisModules,
    F extends RedisFunctions = RedisFunctions,
    S extends RedisScripts = RedisScripts
> extends RedisExtensions<M, F, S> {
    /**
     * `redis[s]://[[username][:password]@][host][:port][/db-number]`
     * See [`redis`](https://www.iana.org/assignments/uri-schemes/prov/redis) and [`rediss`](https://www.iana.org/assignments/uri-schemes/prov/rediss) IANA registration for more details
     */
    url?: string;
    /**
     * Socket connection properties
     */
    socket?: RedisSocketOptions;
    /**
     * ACL username ([see ACL guide](https://redis.io/topics/acl))
     */
    username?: string;
    /**
     * ACL password or the old "--requirepass" password
     */
    password?: string;
    /**
     * Client name ([see `CLIENT SETNAME`](https://redis.io/commands/client-setname))
     */
    name?: string;
    /**
     * Redis database number (see [`SELECT`](https://redis.io/commands/select) command)
     */
    database?: number;
    /**
     * Maximum length of the client's internal command queue
     */
    commandsQueueMaxLength?: number;
    /**
     * When `true`, commands are rejected when the client is reconnecting.
     * When `false`, commands are queued for execution after reconnection.
     */
    disableOfflineQueue?: boolean;
    /**
     * Connect in [`READONLY`](https://redis.io/commands/readonly) mode
     */
    readonly?: boolean;
    legacyMode?: boolean;
    isolationPoolOptions?: PoolOptions;
    /**
     * Send `PING` command at interval (in ms).
     * Useful with Redis deployments that do not use TCP Keep-Alive.
     */
    pingInterval?: number;
    /**
     * If set to true, disables sending client identifier (user-agent like message) to the redis server
     */
    disableClientInfo?: boolean;
    /**
     * Tag to append to library name that is sent to the Redis server
     */
    clientInfoTag?: string;
}

type WithCommands = {
    [P in keyof typeof COMMANDS]: RedisCommandSignature<(typeof COMMANDS)[P]>;
};

export type WithModules<M extends RedisModules> = {
    [P in keyof M as ExcludeMappedString<P>]: {
        [C in keyof M[P] as ExcludeMappedString<C>]: RedisCommandSignature<M[P][C]>;
    };
};

export type WithFunctions<F extends RedisFunctions> = {
    [P in keyof F as ExcludeMappedString<P>]: {
        [FF in keyof F[P] as ExcludeMappedString<FF>]: RedisCommandSignature<F[P][FF]>;
    };
};

export type WithScripts<S extends RedisScripts> = {
    [P in keyof S as ExcludeMappedString<P>]: RedisCommandSignature<S[P]>;
};

export type RedisClientType<
    M extends RedisModules = Record<string, never>,
    F extends RedisFunctions = Record<string, never>,
    S extends RedisScripts = Record<string, never>
> = RedisClient<M, F, S> & WithCommands & WithModules<M> & WithFunctions<F> & WithScripts<S>;

export type InstantiableRedisClient<
    M extends RedisModules,
    F extends RedisFunctions,
    S extends RedisScripts
> = new (options?: RedisClientOptions<M, F, S>) => RedisClientType<M, F, S>;

export interface ClientCommandOptions extends QueueCommandOptions {
    isolated?: boolean;
}

type ClientLegacyCallback = (err: Error | null, reply?: RedisCommandRawReply) => void;

export default class RedisClient<
    M extends RedisModules,
    F extends RedisFunctions,
    S extends RedisScripts
> extends EventEmitter {
    static commandOptions<T extends ClientCommandOptions>(options: T): CommandOptions<T> {
        return commandOptions(options);
    }

    commandOptions = RedisClient.commandOptions;

    static extend<
        M extends RedisModules,
        F extends RedisFunctions,
        S extends RedisScripts
    >(extensions?: RedisExtensions<M, F, S>): InstantiableRedisClient<M, F, S> {
        const Client = attachExtensions({
            BaseClass: RedisClient,
            modulesExecutor: RedisClient.prototype.commandsExecutor,
            modules: extensions?.modules,
            functionsExecutor: RedisClient.prototype.functionsExecuter,
            functions: extensions?.functions,
            scriptsExecutor: RedisClient.prototype.scriptsExecuter,
            scripts: extensions?.scripts
        });

        if (Client !== RedisClient) {
            Client.prototype.Multi = RedisClientMultiCommand.extend(extensions);
        }

        return Client;
    }

    static create<
        M extends RedisModules,
        F extends RedisFunctions,
        S extends RedisScripts
    >(options?: RedisClientOptions<M, F, S>): RedisClientType<M, F, S> {
        return new (RedisClient.extend(options))(options);
    }

    static parseOptions<O extends RedisClientOptions>(options: O): O {
        if (options?.url) {
            const parsed = RedisClient.parseURL(options.url);
            if (options.socket) {
                if (options.socket.tls !== undefined && options.socket.tls !== parsed.socket.tls) {
                    throw new TypeError(`tls socket option is set to ${options.socket.tls} which is mismatch with protocol or the URL ${options.url} passed`)
                }
                parsed.socket = Object.assign(options.socket, parsed.socket);
            }

            Object.assign(options, parsed);
        }
        return options;
    }

    static parseURL(url: string): RedisClientOptions & {
        socket: Exclude<RedisClientOptions['socket'], undefined> & {
            tls: boolean
        }
    } {
        // https://www.iana.org/assignments/uri-schemes/prov/redis
        const { hostname, port, protocol, username, password, pathname } = new URL(url),
            parsed: RedisClientOptions & {
              socket: Exclude<RedisClientOptions['socket'], undefined> & {
                tls: boolean
              }
            } = {
                socket: {
                    host: hostname,
                    tls: false
                }
            };

        if (protocol !== 'redis:' && protocol !== 'rediss:') {
            throw new TypeError('Invalid protocol');
        }

        parsed.socket.tls = protocol === 'rediss:';

        if (port) {
            (parsed.socket as TcpSocketConnectOpts).port = Number(port);
        }

        if (username) {
            parsed.username = decodeURIComponent(username);
        }

        if (password) {
            parsed.password = decodeURIComponent(password);
        }

        if (pathname.length > 1) {
            const database = Number(pathname.substring(1));
            if (isNaN(database)) {
                throw new TypeError('Invalid pathname');
            }

            parsed.database = database;
        }

        return parsed;
    }

    readonly #options?: RedisClientOptions<M, F, S>;
    readonly #socket: RedisSocket;
    readonly #queue: RedisCommandsQueue;
    #isolationPool?: Pool<RedisClientType<M, F, S>>;
    readonly #v4: Record<string, any> = {};
    #selectedDB = 0;

    get options(): RedisClientOptions<M, F, S> | undefined {
        return this.#options;
    }

    get isOpen(): boolean {
        return this.#socket.isOpen;
    }

    get isReady(): boolean {
        return this.#socket.isReady;
    }

    get isPubSubActive() {
        return this.#queue.isPubSubActive;
    }

    get v4(): Record<string, any> {
        if (!this.#options?.legacyMode) {
            throw new Error('the client is not in "legacy mode"');
        }

        return this.#v4;
    }

    constructor(options?: RedisClientOptions<M, F, S>) {
        super();
        this.#options = this.#initiateOptions(options);
        this.#queue = this.#initiateQueue();
        this.#socket = this.#initiateSocket();
        // should be initiated in connect, not here
        // TODO: consider breaking in v5
        this.#isolationPool = this.#initiateIsolationPool();
        this.#legacyMode();
    }

    #initiateOptions(options?: RedisClientOptions<M, F, S>): RedisClientOptions<M, F, S> | undefined {
        if (options?.database) {
            this.#selectedDB = options.database;
        }

        if (options) {
            return RedisClient.parseOptions(options);
        }

        return options;
    }

    #initiateQueue(): RedisCommandsQueue {
        return new RedisCommandsQueue(
            this.#options?.commandsQueueMaxLength,
            (channel, listeners) => this.emit('sharded-channel-moved', channel, listeners)
        );
    }

    #initiateSocket(): RedisSocket {
        const socketInitiator = async (): Promise<void> => {
            const promises = [];

            if (this.#selectedDB !== 0) {
                promises.push(
                    this.#queue.addCommand(
                        ['SELECT', this.#selectedDB.toString()],
                        { asap: true }
                    )
                );
            }

            if (this.#options?.readonly) {
                promises.push(
                    this.#queue.addCommand(
                        COMMANDS.READONLY.transformArguments(),
                        { asap: true }
                    )
                );
            }

            if (!this.#options?.disableClientInfo) {
                promises.push(
                    this.#queue.addCommand(
                        [  'CLIENT', 'SETINFO', 'LIB-VER', version],
                        { asap: true }
                    ).catch(err => {
                        if (!(err instanceof ErrorReply)) {
                            throw err;
                        }
                    })
                );

                promises.push(
                    this.#queue.addCommand(
                        [
                           'CLIENT', 'SETINFO', 'LIB-NAME',
                            this.#options?.clientInfoTag ? `node-redis(${this.#options.clientInfoTag})` : 'node-redis'
                        ],
                        { asap: true }
                    ).catch(err => {
                        if (!(err instanceof ErrorReply)) {
                            throw err;
                        }
                    })
                );
              }

            if (this.#options?.name) {
                promises.push(
                    this.#queue.addCommand(
                        COMMANDS.CLIENT_SETNAME.transformArguments(this.#options.name),
                        { asap: true }
                    )
                );
            }

            if (this.#options?.username || this.#options?.password) {
                promises.push(
                    this.#queue.addCommand(
                        COMMANDS.AUTH.transformArguments({
                            username: this.#options.username,
                            password: this.#options.password ?? ''
                        }),
                        { asap: true }
                    )
                );
            }

            const resubscribePromise = this.#queue.resubscribe();
            if (resubscribePromise) {
                promises.push(resubscribePromise);
            }

            if (promises.length) {
                this.#tick(true);
                await Promise.all(promises);
            }
        };

        return new RedisSocket(socketInitiator, this.#options?.socket)
            .on('data', chunk => this.#queue.onReplyChunk(chunk))
            .on('error', err => {
                this.emit('error', err);
                if (this.#socket.isOpen && !this.#options?.disableOfflineQueue) {
                    this.#queue.flushWaitingForReply(err);
                } else {
                    this.#queue.flushAll(err);
                }
            })
            .on('connect', () => {
                this.emit('connect');
            })
            .on('ready', () => {
                this.emit('ready');
                this.#setPingTimer();
                this.#tick();
            })
            .on('reconnecting', () => this.emit('reconnecting'))
            .on('drain', () => this.#tick())
            .on('end', () => this.emit('end'));
    }

    #initiateIsolationPool() {
        return createPool({
            create: async () => {
                const duplicate = this.duplicate({
                    isolationPoolOptions: undefined
                }).on('error', err => this.emit('error', err));
                await duplicate.connect();
                return duplicate;
            },
            destroy: client => client.disconnect()
        }, this.#options?.isolationPoolOptions);
    }

    #legacyMode(): void {
        if (!this.#options?.legacyMode) return;

        (this as any).#v4.sendCommand = this.#sendCommand.bind(this);
        (this as any).sendCommand = (...args: Array<any>): void => {
            const result = this.#legacySendCommand(...args);
            if (result) {
                result.promise
                    .then(reply => result.callback(null, reply))
                    .catch(err => result.callback(err));
            }
        };

        for (const [ name, command ] of Object.entries(COMMANDS as RedisCommands)) {
            this.#defineLegacyCommand(name, command);
            (this as any)[name.toLowerCase()] ??= (this as any)[name];
        }

        // hard coded commands
        this.#defineLegacyCommand('SELECT');
        this.#defineLegacyCommand('select');
        this.#defineLegacyCommand('SUBSCRIBE');
        this.#defineLegacyCommand('subscribe');
        this.#defineLegacyCommand('PSUBSCRIBE');
        this.#defineLegacyCommand('pSubscribe');
        this.#defineLegacyCommand('UNSUBSCRIBE');
        this.#defineLegacyCommand('unsubscribe');
        this.#defineLegacyCommand('PUNSUBSCRIBE');
        this.#defineLegacyCommand('pUnsubscribe');
        this.#defineLegacyCommand('QUIT');
        this.#defineLegacyCommand('quit');
    }

    #legacySendCommand(...args: Array<any>) {
        const callback = typeof args[args.length - 1] === 'function' ?
            args.pop() as ClientLegacyCallback :
            undefined;

        const promise = this.#sendCommand(transformLegacyCommandArguments(args));
        if (callback) return {
            promise,
            callback
        };
        promise.catch(err => this.emit('error', err));
    }

    #defineLegacyCommand(name: string, command?: RedisCommand): void {
        this.#v4[name] = (this as any)[name].bind(this);
        (this as any)[name] = command && command.TRANSFORM_LEGACY_REPLY && command.transformReply ?
            (...args: Array<unknown>) => {
                const result = this.#legacySendCommand(name, ...args);
                if (result) {
                    result.promise
                        .then(reply => result.callback(null, command.transformReply!(reply)))
                        .catch(err => result.callback(err));
                }
            } :
            (...args: Array<unknown>) => (this as any).sendCommand(name, ...args);
    }

    #pingTimer?: NodeJS.Timeout;

    #setPingTimer(): void {
        if (!this.#options?.pingInterval || !this.#socket.isReady) return;
        clearTimeout(this.#pingTimer);

        this.#pingTimer = setTimeout(() => {
            if (!this.#socket.isReady) return;

            // using #sendCommand to support legacy mode
            this.#sendCommand(['PING'])
                .then(reply => this.emit('ping-interval', reply))
                .catch(err => this.emit('error', err))
                .finally(() => this.#setPingTimer());
        }, this.#options.pingInterval);
    }

    duplicate(overrides?: Partial<RedisClientOptions<M, F, S>>): RedisClientType<M, F, S> {
        return new (Object.getPrototypeOf(this).constructor)({
            ...this.#options,
            ...overrides
        });
    }

    async connect() {
        // see comment in constructor
        this.#isolationPool ??= this.#initiateIsolationPool();
        await this.#socket.connect();
        return this as unknown as RedisClientType<M, F, S>;
    }

    async commandsExecutor<C extends RedisCommand>(
        command: C,
        args: Array<unknown>
    ): Promise<RedisCommandReply<C>> {
        const { args: redisArgs, options } = transformCommandArguments(command, args);
        return transformCommandReply(
            command,
            await this.#sendCommand(redisArgs, options),
            redisArgs.preserve
        );
    }

    sendCommand<T = RedisCommandRawReply>(
        args: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<T> {
        return this.#sendCommand(args, options);
    }

    // using `#sendCommand` cause `sendCommand` is overwritten in legacy mode
    #sendCommand<T = RedisCommandRawReply>(
        args: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<T> {
        if (!this.#socket.isOpen) {
            return Promise.reject(new ClientClosedError());
        } else if (options?.isolated) {
            return this.executeIsolated(isolatedClient =>
                isolatedClient.sendCommand(args, {
                    ...options,
                    isolated: false
                })
            );
        } else if (!this.#socket.isReady && this.#options?.disableOfflineQueue) {
            return Promise.reject(new ClientOfflineError());
        }

        const promise = this.#queue.addCommand<T>(args, options);
        this.#tick();
        return promise;
    }

    async functionsExecuter<F extends RedisFunction>(
        fn: F,
        args: Array<unknown>,
        name: string
    ): Promise<RedisCommandReply<F>> {
        const { args: redisArgs, options } = transformCommandArguments(fn, args);
        return transformCommandReply(
            fn,
            await this.executeFunction(name, fn, redisArgs, options),
            redisArgs.preserve
        );
    }

    executeFunction(
        name: string,
        fn: RedisFunction,
        args: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<RedisCommandRawReply> {
        return this.#sendCommand(
            fCallArguments(name, fn, args),
            options
        );
    }

    async scriptsExecuter<S extends RedisScript>(
        script: S,
        args: Array<unknown>
    ): Promise<RedisCommandReply<S>> {
        const { args: redisArgs, options } = transformCommandArguments(script, args);
        return transformCommandReply(
            script,
            await this.executeScript(script, redisArgs, options),
            redisArgs.preserve
        );
    }

    async executeScript(
        script: RedisScript,
        args: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<RedisCommandRawReply> {
        const redisArgs: RedisCommandArguments = ['EVALSHA', script.SHA1];

        if (script.NUMBER_OF_KEYS !== undefined) {
            redisArgs.push(script.NUMBER_OF_KEYS.toString());
        }

        redisArgs.push(...args);

        try {
            return await this.#sendCommand(redisArgs, options);
        } catch (err: any) {
            if (!err?.message?.startsWith?.('NOSCRIPT')) {
                throw err;
            }

            redisArgs[0] = 'EVAL';
            redisArgs[1] = script.SCRIPT;
            return this.#sendCommand(redisArgs, options);
        }
    }

    async SELECT(db: number): Promise<void>;
    async SELECT(options: CommandOptions<ClientCommandOptions>, db: number): Promise<void>;
    async SELECT(options?: any, db?: any): Promise<void> {
        if (!isCommandOptions(options)) {
            db = options;
            options = null;
        }

        await this.#sendCommand(['SELECT', db.toString()], options);
        this.#selectedDB = db;
    }

    select = this.SELECT;

    #pubSubCommand(promise: Promise<void> | undefined) {
        if (promise === undefined) return Promise.resolve();

        this.#tick();
        return promise;
    }

    SUBSCRIBE<T extends boolean = false>(
        channels: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.subscribe(
                PubSubType.CHANNELS,
                channels,
                listener,
                bufferMode
            )
        );
    }

    subscribe = this.SUBSCRIBE;


    UNSUBSCRIBE<T extends boolean = false>(
        channels?: string | Array<string>,
        listener?: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.unsubscribe(
                PubSubType.CHANNELS,
                channels,
                listener,
                bufferMode
            )
        );
    }

    unsubscribe = this.UNSUBSCRIBE;

    PSUBSCRIBE<T extends boolean = false>(
        patterns: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.subscribe(
                PubSubType.PATTERNS,
                patterns,
                listener,
                bufferMode
            )
        );
    }

    pSubscribe = this.PSUBSCRIBE;

    PUNSUBSCRIBE<T extends boolean = false>(
        patterns?: string | Array<string>,
        listener?: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.unsubscribe(
                PubSubType.PATTERNS,
                patterns,
                listener,
                bufferMode
            )
        );
    }

    pUnsubscribe = this.PUNSUBSCRIBE;

    SSUBSCRIBE<T extends boolean = false>(
        channels: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.subscribe(
                PubSubType.SHARDED,
                channels,
                listener,
                bufferMode
            )
        );
    }

    sSubscribe = this.SSUBSCRIBE;

    SUNSUBSCRIBE<T extends boolean = false>(
        channels?: string | Array<string>,
        listener?: PubSubListener<T>,
        bufferMode?: T
    ): Promise<void> {
        return this.#pubSubCommand(
            this.#queue.unsubscribe(
                PubSubType.SHARDED,
                channels,
                listener,
                bufferMode
            )
        );
    }

    sUnsubscribe = this.SUNSUBSCRIBE;

    getPubSubListeners(type: PubSubType) {
        return this.#queue.getPubSubListeners(type);
    }

    extendPubSubChannelListeners(
        type: PubSubType,
        channel: string,
        listeners: ChannelListeners
    ) {
        return this.#pubSubCommand(
            this.#queue.extendPubSubChannelListeners(type, channel, listeners)
        );
    }

    extendPubSubListeners(type: PubSubType, listeners: PubSubTypeListeners) {
        return this.#pubSubCommand(
            this.#queue.extendPubSubListeners(type, listeners)
        );
    }

    QUIT(): Promise<string> {
        return this.#socket.quit(async () => {
            if (this.#pingTimer) clearTimeout(this.#pingTimer);
            const quitPromise = this.#queue.addCommand<string>(['QUIT']);
            this.#tick();
            const [reply] = await Promise.all([
                quitPromise,
                this.#destroyIsolationPool()
            ]);
            return reply;
        });
    }

    quit = this.QUIT;

    #tick(force = false): void {
        if (this.#socket.writableNeedDrain || (!force && !this.#socket.isReady)) {
            return;
        }

        this.#socket.cork();

        while (!this.#socket.writableNeedDrain) {
            const args = this.#queue.getCommandToSend();
            if (args === undefined) break;

            this.#socket.writeCommand(args);
        }
    }

    executeIsolated<T>(fn: (client: RedisClientType<M, F, S>) => T | Promise<T>): Promise<T> {
        if (!this.#isolationPool) return Promise.reject(new ClientClosedError());
        return this.#isolationPool.use(fn);
    }

    MULTI(): RedisClientMultiCommandType<M, F, S> {
        return new (this as any).Multi(
            this.multiExecutor.bind(this),
            this.#options?.legacyMode
        );
    }

    multi = this.MULTI;

    async multiExecutor(
        commands: Array<RedisMultiQueuedCommand>,
        selectedDB?: number,
        chainId?: symbol
    ): Promise<Array<RedisCommandRawReply>> {
        if (!this.#socket.isOpen) {
            return Promise.reject(new ClientClosedError());
        }

        const promise = chainId ?
            // if `chainId` has a value, it's a `MULTI` (and not "pipeline") - need to add the `MULTI` and `EXEC` commands
            Promise.all([
                this.#queue.addCommand(['MULTI'], { chainId }),
                this.#addMultiCommands(commands, chainId),
                this.#queue.addCommand(['EXEC'], { chainId })
            ]) :
            this.#addMultiCommands(commands);

        this.#tick();

        const results = await promise;

        if (selectedDB !== undefined) {
            this.#selectedDB = selectedDB;
        }

        return results;
    }

    #addMultiCommands(commands: Array<RedisMultiQueuedCommand>, chainId?: symbol) {
        return Promise.all(
            commands.map(({ args }) => this.#queue.addCommand(args, { chainId }))
        );
    }

    async* scanIterator(options?: ScanCommandOptions): AsyncIterable<string> {
        let cursor = 0;
        do {
            const reply = await (this as any).scan(cursor, options);
            cursor = reply.cursor;
            for (const key of reply.keys) {
                yield key;
            }
        } while (cursor !== 0);
    }

    async* hScanIterator(key: string, options?: ScanOptions): AsyncIterable<ConvertArgumentType<HScanTuple, string>> {
        let cursor = 0;
        do {
            const reply = await (this as any).hScan(key, cursor, options);
            cursor = reply.cursor;
            for (const tuple of reply.tuples) {
                yield tuple;
            }
        } while (cursor !== 0);
    }

    async* hScanNoValuesIterator(key: string, options?: ScanOptions): AsyncIterable<ConvertArgumentType<RedisCommandArgument, string>> {
        let cursor = 0;
        do {
            const reply = await (this as any).hScanNoValues(key, cursor, options);
            cursor = reply.cursor;
            for (const k of reply.keys) {
                yield k;
            }
        } while (cursor !== 0);
    }

    async* sScanIterator(key: string, options?: ScanOptions): AsyncIterable<string> {
        let cursor = 0;
        do {
            const reply = await (this as any).sScan(key, cursor, options);
            cursor = reply.cursor;
            for (const member of reply.members) {
                yield member;
            }
        } while (cursor !== 0);
    }

    async* zScanIterator(key: string, options?: ScanOptions): AsyncIterable<ConvertArgumentType<ZMember, string>> {
        let cursor = 0;
        do {
            const reply = await (this as any).zScan(key, cursor, options);
            cursor = reply.cursor;
            for (const member of reply.members) {
                yield member;
            }
        } while (cursor !== 0);
    }

    async disconnect(): Promise<void> {
        if (this.#pingTimer) clearTimeout(this.#pingTimer);
        this.#queue.flushAll(new DisconnectsClientError());
        this.#socket.disconnect();
        await this.#destroyIsolationPool();
    }

    async #destroyIsolationPool(): Promise<void> {
        await this.#isolationPool!.drain();
        await this.#isolationPool!.clear();
        this.#isolationPool = undefined;
    }

    ref(): void {
        this.#socket.ref();
    }

    unref(): void {
        this.#socket.unref();
    }
}

attachCommands({
    BaseClass: RedisClient,
    commands: COMMANDS,
    executor: RedisClient.prototype.commandsExecutor
});
(RedisClient.prototype as any).Multi = RedisClientMultiCommand;
