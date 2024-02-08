import COMMANDS from './commands';
import { RedisCommand, RedisCommandArgument, RedisCommandArguments, RedisCommandRawReply, RedisCommandReply, RedisFunctions, RedisModules, RedisExtensions, RedisScript, RedisScripts, RedisCommandSignature, RedisFunction } from '../commands';
import { ClientCommandOptions, RedisClientOptions, RedisClientType, WithFunctions, WithModules, WithScripts } from '../client';
import RedisClusterSlots, { NodeAddressMap, ShardNode } from './cluster-slots';
import { attachExtensions, transformCommandReply, attachCommands, transformCommandArguments } from '../commander';
import { EventEmitter } from 'events';
import RedisClusterMultiCommand, { InstantiableRedisClusterMultiCommandType, RedisClusterMultiCommandType } from './multi-command';
import { RedisMultiQueuedCommand } from '../multi-command';
import { PubSubListener } from '../client/pub-sub';
import { ClientClosedError, ErrorReply, ConnectionTimeoutError } from '../errors';

export type RedisClusterClientOptions = Omit<
    RedisClientOptions,
    'modules' | 'functions' | 'scripts' | 'database'
>;

export interface RedisClusterOptions<
    M extends RedisModules = Record<string, never>,
    F extends RedisFunctions = Record<string, never>,
    S extends RedisScripts = Record<string, never>
> extends RedisExtensions<M, F, S> {
    /**
     * Should contain details for some of the cluster nodes that the client will use to discover
     * the "cluster topology". We recommend including details for at least 3 nodes here.
     */
    rootNodes: Array<RedisClusterClientOptions>;
    /**
     * Default values used for every client in the cluster. Use this to specify global values,
     * for example: ACL credentials, timeouts, TLS configuration etc.
     */
    defaults?: Partial<RedisClusterClientOptions>;
    /**
     * When `true`, `.connect()` will only discover the cluster topology, without actually connecting to all the nodes.
     * Useful for short-term or PubSub-only connections.
     */
    minimizeConnections?: boolean;
    /**
     * When `true`, distribute load by executing readonly commands (such as `GET`, `GEOSEARCH`, etc.) across all cluster nodes. When `false`, only use master nodes.
     */
    useReplicas?: boolean;
    /**
     * The maximum number of times a command will be redirected due to `MOVED` or `ASK` errors.
     */
    maxCommandRedirections?: number;
    /**
     * Mapping between the addresses in the cluster (see `CLUSTER SHARDS`) and the addresses the client should connect to
     * Useful when the cluster is running on another network
     *
     */
    nodeAddressMap?: NodeAddressMap;
}

type WithCommands = {
    [P in keyof typeof COMMANDS]: RedisCommandSignature<(typeof COMMANDS)[P]>;
};

export type RedisClusterType<
    M extends RedisModules = Record<string, never>,
    F extends RedisFunctions = Record<string, never>,
    S extends RedisScripts = Record<string, never>
> = RedisCluster<M, F, S> & WithCommands & WithModules<M> & WithFunctions<F> & WithScripts<S>;

export default class RedisCluster<
    M extends RedisModules,
    F extends RedisFunctions,
    S extends RedisScripts
> extends EventEmitter {
    static extractFirstKey(
        command: RedisCommand,
        originalArgs: Array<unknown>,
        redisArgs: RedisCommandArguments
    ): RedisCommandArgument | undefined {
        if (command.FIRST_KEY_INDEX === undefined) {
            return undefined;
        } else if (typeof command.FIRST_KEY_INDEX === 'number') {
            return redisArgs[command.FIRST_KEY_INDEX];
        }

        return command.FIRST_KEY_INDEX(...originalArgs);
    }

    static create<
        M extends RedisModules,
        F extends RedisFunctions,
        S extends RedisScripts
    >(options?: RedisClusterOptions<M, F, S>): RedisClusterType<M, F, S> {
        return new (attachExtensions({
            BaseClass: RedisCluster,
            modulesExecutor: RedisCluster.prototype.commandsExecutor,
            modules: options?.modules,
            functionsExecutor: RedisCluster.prototype.functionsExecutor,
            functions: options?.functions,
            scriptsExecutor: RedisCluster.prototype.scriptsExecutor,
            scripts: options?.scripts
        }))(options);
    }

    readonly #options: RedisClusterOptions<M, F, S>;

    readonly #slots: RedisClusterSlots<M, F, S>;

    get slots() {
        return this.#slots.state.slots;
    }

    get shards() {
        return this.#slots.state.shards;
    }

    get masters() {
        return this.#slots.state.masters;
    }

    get replicas() {
        return this.#slots.state.replicas;
    }

    get nodeByAddress() {
        return this.#slots.nodeByAddress;
    }

    get pubSubNode() {
        return this.#slots.pubSubNode;
    }

    readonly #Multi: InstantiableRedisClusterMultiCommandType<M, F, S>;

    get isOpen() {
        return this.#slots.isOpen;
    }

    constructor(options: RedisClusterOptions<M, F, S>) {
        super();

        this.#options = options;
        this.#slots = new RedisClusterSlots(options, this.emit.bind(this));
        this.#Multi = RedisClusterMultiCommand.extend(options);
    }

    duplicate(overrides?: Partial<RedisClusterOptions<M, F, S>>): RedisClusterType<M, F, S> {
        return new (Object.getPrototypeOf(this).constructor)({
            ...this.#options,
            ...overrides
        });
    }

    connect() {
        return this.#slots.connect();
    }

    async commandsExecutor<C extends RedisCommand>(
        command: C,
        args: Array<unknown>
    ): Promise<RedisCommandReply<C>> {
        const { jsArgs, args: redisArgs, options } = transformCommandArguments(command, args);
        return transformCommandReply(
            command,
            await this.sendCommand(
                RedisCluster.extractFirstKey(command, jsArgs, redisArgs),
                command.IS_READ_ONLY,
                redisArgs,
                options
            ),
            redisArgs.preserve
        );
    }

    async sendCommand<T = RedisCommandRawReply>(
        firstKey: RedisCommandArgument | undefined,
        isReadonly: boolean | undefined,
        args: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<T> {
        return this.#execute(
            firstKey,
            isReadonly,
            client => client.sendCommand<T>(args, options)
        );
    }

    async functionsExecutor<F extends RedisFunction>(
        fn: F,
        args: Array<unknown>,
        name: string,
    ): Promise<RedisCommandReply<F>> {
        const { args: redisArgs, options } = transformCommandArguments(fn, args);
        return transformCommandReply(
            fn,
            await this.executeFunction(
                name,
                fn,
                args,
                redisArgs,
                options
            ),
            redisArgs.preserve
        );
    }

    async executeFunction(
        name: string,
        fn: RedisFunction,
        originalArgs: Array<unknown>,
        redisArgs: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<RedisCommandRawReply> {
        return this.#execute(
            RedisCluster.extractFirstKey(fn, originalArgs, redisArgs),
            fn.IS_READ_ONLY,
            client => client.executeFunction(name, fn, redisArgs, options)
        );
    }

    async scriptsExecutor<S extends RedisScript>(script: S, args: Array<unknown>): Promise<RedisCommandReply<S>> {
        const { args: redisArgs, options } = transformCommandArguments(script, args);
        return transformCommandReply(
            script,
            await this.executeScript(
                script,
                args,
                redisArgs,
                options
            ),
            redisArgs.preserve
        );
    }

    async executeScript(
        script: RedisScript,
        originalArgs: Array<unknown>,
        redisArgs: RedisCommandArguments,
        options?: ClientCommandOptions
    ): Promise<RedisCommandRawReply> {
        return this.#execute(
            RedisCluster.extractFirstKey(script, originalArgs, redisArgs),
            script.IS_READ_ONLY,
            client => client.executeScript(script, redisArgs, options)
        );
    }

    async #execute<Reply>(
        firstKey: RedisCommandArgument | undefined,
        isReadonly: boolean | undefined,
        executor: (client: RedisClientType<M, F, S>) => Promise<Reply>
    ): Promise<Reply> {
        if (this.#slots.lastDiscovered + 10000 < Date.now()) {
            const discover = async () => {
                let client = await this.#slots.nodeClient(this.#slots.getRandomNode());
                this.#slots.rediscover(client).catch(() => { /* ignore */ })
            }
            discover(); // don't wait for it
        }
        const maxCommandRedirections = this.#options.maxCommandRedirections ?? 16;
        let client = await this.#slots.getClient(firstKey, isReadonly);
        for (let i = 0;; i++) {
            try {
                return await executor(client);
            } catch (err) {
                if (err instanceof ClientClosedError) {
                    i-- // don't count this attempt

                    // attempt to reconnect closed client
                    client.connect().catch(() => { /* ignore */ });

                    // try again with a different client
                    let oldClient = client
                    while (client === oldClient) {
                        client = await this.#slots.getClient(undefined, isReadonly)
                    }
                    continue;
                }

                if (++i > maxCommandRedirections || !(err instanceof ErrorReply)) {
                    throw err;
                }

                if (err.message.startsWith('ASK')) {
                    const address = err.message.substring(err.message.lastIndexOf(' ') + 1);
                    let redirectTo = await this.#slots.getMasterByAddress(address);
                    if (!redirectTo) {
                        await this.#slots.rediscover(client);
                        redirectTo = await this.#slots.getMasterByAddress(address);
                    }

                    if (!redirectTo) {
                        throw new Error(`Cannot find node ${address}`);
                    }

                    await redirectTo.asking();
                    client = redirectTo;
                    continue;
                } else if (err.message.startsWith('MOVED')) {
                    await this.#slots.rediscover(client);
                    client = await this.#slots.getClient(firstKey, isReadonly);
                    continue;
                }

                throw err;
            }
        }
    }

    MULTI(routing?: RedisCommandArgument): RedisClusterMultiCommandType<M, F, S> {
        return new this.#Multi(
            (commands: Array<RedisMultiQueuedCommand>, firstKey?: RedisCommandArgument, chainId?: symbol) => {
                return this.#execute(
                    firstKey,
                    false,
                    client => client.multiExecutor(commands, undefined, chainId)
                );
            },
            routing
        );
    }

    multi = this.MULTI;

    async SUBSCRIBE<T extends boolean = false>(
        channels: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ) {
        return (await this.#slots.getPubSubClient())
            .SUBSCRIBE(channels, listener, bufferMode);
    }

    subscribe = this.SUBSCRIBE;

    async UNSUBSCRIBE<T extends boolean = false>(
        channels?: string | Array<string>,
        listener?: PubSubListener<boolean>,
        bufferMode?: T
    ) {
        return this.#slots.executeUnsubscribeCommand(client =>
            client.UNSUBSCRIBE(channels, listener, bufferMode)
        );
    }

    unsubscribe = this.UNSUBSCRIBE;

    async PSUBSCRIBE<T extends boolean = false>(
        patterns: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ) {
        return (await this.#slots.getPubSubClient())
            .PSUBSCRIBE(patterns, listener, bufferMode);
    }

    pSubscribe = this.PSUBSCRIBE;

    async PUNSUBSCRIBE<T extends boolean = false>(
        patterns?: string | Array<string>,
        listener?: PubSubListener<T>,
        bufferMode?: T
    ) {
        return this.#slots.executeUnsubscribeCommand(client =>
            client.PUNSUBSCRIBE(patterns, listener, bufferMode)
        );
    }

    pUnsubscribe = this.PUNSUBSCRIBE;

    async SSUBSCRIBE<T extends boolean = false>(
        channels: string | Array<string>,
        listener: PubSubListener<T>,
        bufferMode?: T
    ) {
        const maxCommandRedirections = this.#options.maxCommandRedirections ?? 16,
            firstChannel = Array.isArray(channels) ? channels[0] : channels;
        let client = await this.#slots.getShardedPubSubClient(firstChannel);
        for (let i = 0;; i++) {
            try {
                return await client.SSUBSCRIBE(channels, listener, bufferMode);
            } catch (err) {
                if (++i > maxCommandRedirections || !(err instanceof ErrorReply)) {
                    throw err;
                }

                if (err.message.startsWith('MOVED')) {
                    await this.#slots.rediscover(client);
                    client = await this.#slots.getShardedPubSubClient(firstChannel);
                    continue;
                }

                throw err;
            }
        }
    }

    sSubscribe = this.SSUBSCRIBE;

    SUNSUBSCRIBE<T extends boolean = false>(
        channels: string | Array<string>,
        listener?: PubSubListener<T>,
        bufferMode?: T
    ) {
        return this.#slots.executeShardedUnsubscribeCommand(
            Array.isArray(channels) ? channels[0] : channels,
            client => client.SUNSUBSCRIBE(channels, listener, bufferMode)
        );
    }

    sUnsubscribe = this.SUNSUBSCRIBE;

    quit(): Promise<void> {
        return this.#slots.quit();
    }

    disconnect(): Promise<void> {
        return this.#slots.disconnect();
    }

    nodeClient(node: ShardNode<M, F, S>) {
        return this.#slots.nodeClient(node);
    }

    getRandomNode() {
        return this.#slots.getRandomNode();
    }

    getSlotRandomNode(slot: number) {
        return this.#slots.getSlotRandomNode(slot);
    }

    /**
     * @deprecated use `.masters` instead
     */
    getMasters() {
        return this.masters;
    }

    /**
     * @deprecated use `.slots[<SLOT>]` instead
     */
    getSlotMaster(slot: number) {
        return this.slots[slot].master;
    }
}

attachCommands({
    BaseClass: RedisCluster,
    commands: COMMANDS,
    executor: RedisCluster.prototype.commandsExecutor
});
