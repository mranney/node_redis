import { EventEmitter } from 'node:events';
import { CommandArguments, RedisFunctions, RedisModules, RedisScripts, ReplyUnion, RespVersions, TypeMapping } from '../RESP/types';
import RedisClient, { RedisClientOptions, RedisClientType } from '../client';
import { CommandOptions } from '../client/commands-queue';
import { attachConfig } from '../commander';
import COMMANDS from '../commands';
import { ClientErrorEvent, NamespaceProxySentinel, NamespaceProxySentinelClient, ProxySentinel, ProxySentinelClient, RedisNode, RedisSentinelClientType, RedisSentinelEvent, RedisSentinelOptions, RedisSentinelType, SentinelCommander } from './types';
import { clientSocketToNode, createCommand, createFunctionCommand, createModuleCommand, createNodeList, createScriptCommand, parseNode } from './utils';
import { RedisMultiQueuedCommand } from '../multi-command';
import RedisSentinelMultiCommand, { RedisSentinelMultiCommandType } from './multi-commands';
import { PubSubListener } from '../client/pub-sub';
import { PubSubProxy } from './pub-sub-proxy';
import { setTimeout } from 'node:timers/promises';
import RedisSentinelModule from './module'
import { RedisVariadicArgument } from '../commands/generic-transformers';
import { WaitQueue } from './wait-queue';
import { TcpNetConnectOpts } from 'node:net';
import { RedisTcpSocketOptions } from '../client/socket';
import { BasicPooledClientSideCache, PooledClientSideCacheProvider } from '../client/cache';

interface ClientInfo {
  id: number;
}

export class RedisSentinelClient<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> {
  #clientInfo: ClientInfo | undefined;
  #internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>;
  readonly _self: RedisSentinelClient<M, F, S, RESP, TYPE_MAPPING>;

  get isOpen() {
    return this._self.#internal.isOpen;
  }

  get isReady() {
    return this._self.#internal.isReady;
  }

  get commandOptions() {
    return this._self.#commandOptions;
  }

  #commandOptions?: CommandOptions<TYPE_MAPPING>;

  constructor(
    internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>,
    clientInfo: ClientInfo,
    commandOptions?: CommandOptions<TYPE_MAPPING>
  ) {
    this._self = this;
    this.#internal = internal;
    this.#clientInfo = clientInfo;
    this.#commandOptions = commandOptions;
  }

  static factory<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(config?: SentinelCommander<M, F, S, RESP, TYPE_MAPPING>) {
    const SentinelClient = attachConfig({
      BaseClass: RedisSentinelClient,
      commands: COMMANDS,
      createCommand: createCommand<ProxySentinelClient>,
      createModuleCommand: createModuleCommand<NamespaceProxySentinelClient>,
      createFunctionCommand: createFunctionCommand<NamespaceProxySentinelClient>,
      createScriptCommand: createScriptCommand<ProxySentinelClient>,
      config
    });

    SentinelClient.prototype.Multi = RedisSentinelMultiCommand.extend(config);

    return (
      internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>,
      clientInfo: ClientInfo,
      commandOptions?: CommandOptions<TYPE_MAPPING>
    ) => {
      // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
      return Object.create(new SentinelClient(internal, clientInfo, commandOptions)) as RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>;
    };
  }

  static create<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(
    options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>,
    internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>,
    clientInfo: ClientInfo,
    commandOptions?: CommandOptions<TYPE_MAPPING>,
  ) {
    return RedisSentinelClient.factory(options)(internal, clientInfo, commandOptions);
  }

  withCommandOptions<
    OPTIONS extends CommandOptions<TYPE_MAPPING>,
    TYPE_MAPPING extends TypeMapping
  >(options: OPTIONS) {
    const proxy = Object.create(this);
    proxy._commandOptions = options;
    return proxy as RedisSentinelClientType<
      M,
      F,
      S,
      RESP,
      TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}
    >;
  }

  private _commandOptionsProxy<
    K extends keyof CommandOptions,
    V extends CommandOptions[K]
  >(
    key: K,
    value: V
  ) {
    const proxy = Object.create(this);
    proxy._commandOptions = Object.create(this._self.#commandOptions ?? null);
    proxy._commandOptions[key] = value;
    return proxy as RedisSentinelClientType<
      M,
      F,
      S,
      RESP,
      K extends 'typeMapping' ? V extends TypeMapping ? V : {} : TYPE_MAPPING
    >;
  }

  /**
   * Override the `typeMapping` command option
   */
  withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING) {
    return this._commandOptionsProxy('typeMapping', typeMapping);
  }

  async _execute<T>(
    isReadonly: boolean | undefined,
    fn: (client: RedisClient<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>
  ): Promise<T> {
    if (this._self.#clientInfo === undefined) {
      throw new Error("Attempted execution on released RedisSentinelClient lease");
    }

    return await this._self.#internal.execute(fn, this._self.#clientInfo);
  }

  async sendCommand<T = ReplyUnion>(
    isReadonly: boolean | undefined,
    args: CommandArguments,
    options?: CommandOptions,
  ): Promise<T> {
    return this._execute(
      isReadonly,
      client => client.sendCommand(args, options)
    );
  }

  /**
   * @internal
   */
  async _executePipeline(
    isReadonly: boolean | undefined,
    commands: Array<RedisMultiQueuedCommand>
  ) {
    return this._execute(
      isReadonly,
      client => client._executePipeline(commands)
    );
  }

  /**f
    * @internal
    */
  async _executeMulti(
    isReadonly: boolean | undefined,
    commands: Array<RedisMultiQueuedCommand>
  ) {
    return this._execute(
      isReadonly,
      client => client._executeMulti(commands)
    );
  }

  MULTI(): RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING> {
    return new (this as any).Multi(this);
  }

  multi = this.MULTI;

  WATCH(key: RedisVariadicArgument) {
    if (this._self.#clientInfo === undefined) {
      throw new Error("Attempted execution on released RedisSentinelClient lease");
    }

    return this._execute(
      false,
      client => client.watch(key)
    )
  }

  watch = this.WATCH;

  UNWATCH() {
    if (this._self.#clientInfo === undefined) {
      throw new Error('Attempted execution on released RedisSentinelClient lease');
    }

    return this._execute(
      false,
      client => client.unwatch()
    )
  }

  unwatch = this.UNWATCH;

  release() {
    if (this._self.#clientInfo === undefined) {
      throw new Error('RedisSentinelClient lease already released');
    }

    const result = this._self.#internal.releaseClientLease(this._self.#clientInfo);
    this._self.#clientInfo = undefined;
    return result;
  }
}

export default class RedisSentinel<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends EventEmitter {
  readonly _self: RedisSentinel<M, F, S, RESP, TYPE_MAPPING>;

  #internal: RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>;
  #options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>;

  get isOpen() {
    return this._self.#internal.isOpen;
  }

  get isReady() {
    return this._self.#internal.isReady;
  }

  get commandOptions() {
    return this._self.#commandOptions;
  }

  #commandOptions?: CommandOptions<TYPE_MAPPING>;

  #trace: (msg: string) => unknown = () => { };

  #reservedClientInfo?: ClientInfo;
  #masterClientCount = 0;
  #masterClientInfo?: ClientInfo;

  get clientSideCache() {
    return this._self.#internal.clientSideCache;
  }

  constructor(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>) {
    super();

    this._self = this;

    this.#options = options;

    if (options.commandOptions) {
      this.#commandOptions = options.commandOptions;
    }

    this.#internal = new RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>(options);
    this.#internal.on('error', err => this.emit('error', err));

    /* pass through underling events */
    /* TODO: perhaps make this a struct and one vent, instead of multiple events */
    this.#internal.on('topology-change', (event: RedisSentinelEvent) => {
      if (!this.emit('topology-change', event)) {
        this._self.#trace(`RedisSentinel: re-emit for topology-change for ${event.type} event returned false`);
      }
    });
  }

  static factory<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(config?: SentinelCommander<M, F, S, RESP, TYPE_MAPPING>) {
    const Sentinel = attachConfig({
      BaseClass: RedisSentinel,
      commands: COMMANDS,
      createCommand: createCommand<ProxySentinel>,
      createModuleCommand: createModuleCommand<NamespaceProxySentinel>,
      createFunctionCommand: createFunctionCommand<NamespaceProxySentinel>,
      createScriptCommand: createScriptCommand<ProxySentinel>,
      config
    });

    Sentinel.prototype.Multi = RedisSentinelMultiCommand.extend(config);

    return (options: Omit<RedisSentinelOptions, keyof Exclude<typeof config, undefined>>) => {
      // returning a "proxy" to prevent the namespaces.self to leak between "proxies"
      return Object.create(new Sentinel(options)) as RedisSentinelType<M, F, S, RESP, TYPE_MAPPING>;
    };
  }

  static create<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>) {
    return RedisSentinel.factory(options)(options);
  }

  withCommandOptions<
    OPTIONS extends CommandOptions<TYPE_MAPPING>,
    TYPE_MAPPING extends TypeMapping,
  >(options: OPTIONS) {
    const proxy = Object.create(this);
    proxy._commandOptions = options;
    return proxy as RedisSentinelType<
      M,
      F,
      S,
      RESP,
      TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}
    >;
  }

  private _commandOptionsProxy<
    K extends keyof CommandOptions,
    V extends CommandOptions[K]
  >(
    key: K,
    value: V
  ) {
    const proxy = Object.create(this._self);
    proxy._commandOptions = Object.create(this._self.#commandOptions ?? null);
    proxy._commandOptions[key] = value;
    return proxy as RedisSentinelType<
      M,
      F,
      S,
      RESP,
      K extends 'typeMapping' ? V extends TypeMapping ? V : {} : TYPE_MAPPING
    >;
  }

  /**
   * Override the `typeMapping` command option
   */
  withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING) {
    return this._commandOptionsProxy('typeMapping', typeMapping);
  }

  async connect() {
    await this._self.#internal.connect();

    if (this._self.#options.reserveClient) {
      this._self.#reservedClientInfo = await this._self.#internal.getClientLease();
    }

    return this as unknown as RedisSentinelType<M, F, S, RESP, TYPE_MAPPING>;
  }

  async _execute<T>(
    isReadonly: boolean | undefined,
    fn: (client: RedisClient<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>
  ): Promise<T> {
    let clientInfo: ClientInfo | undefined;
    if (!isReadonly || !this._self.#internal.useReplicas) {
      if (this._self.#reservedClientInfo) {
        clientInfo = this._self.#reservedClientInfo;
      } else {
        this._self.#masterClientInfo ??= await this._self.#internal.getClientLease();
        clientInfo = this._self.#masterClientInfo;
        this._self.#masterClientCount++;
      }
    }

    try {
      return await this._self.#internal.execute(fn, clientInfo);
    } finally {
      if (
        clientInfo !== undefined &&
        clientInfo === this._self.#masterClientInfo &&
        --this._self.#masterClientCount === 0
      ) {
        const promise = this._self.#internal.releaseClientLease(clientInfo);
        this._self.#masterClientInfo = undefined;
        if (promise) await promise;
      }
    }
  }

  async use<T>(fn: (sentinelClient: RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>) => Promise<T>) {
    const clientInfo = await this._self.#internal.getClientLease();

    try {
      return await fn(
        RedisSentinelClient.create(this._self.#options, this._self.#internal, clientInfo, this._self.#commandOptions)
      );
    } finally {
      const promise = this._self.#internal.releaseClientLease(clientInfo);
      if (promise) await promise;
    }
  }

  async sendCommand<T = ReplyUnion>(
    isReadonly: boolean | undefined,
    args: CommandArguments,
    options?: CommandOptions,
  ): Promise<T> {
    return this._execute(
      isReadonly,
      client => client.sendCommand(args, options)
    );
  }

  /**
   * @internal
   */
  async _executePipeline(
    isReadonly: boolean | undefined,
    commands: Array<RedisMultiQueuedCommand>
  ) {
    return this._execute(
      isReadonly,
      client => client._executePipeline(commands)
    );
  }

  /**f
    * @internal
    */
  async _executeMulti(
    isReadonly: boolean | undefined,
    commands: Array<RedisMultiQueuedCommand>
  ) {
    return this._execute(
      isReadonly,
      client => client._executeMulti(commands)
    );
  }

  MULTI(): RedisSentinelMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING> {
    return new (this as any).Multi(this);
  }

  multi = this.MULTI;

  async close() {
    return this._self.#internal.close();
  }

  destroy() {
    return this._self.#internal.destroy();
  }

  async SUBSCRIBE<T extends boolean = false>(
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this._self.#internal.subscribe(channels, listener, bufferMode);
  }

  subscribe = this.SUBSCRIBE;

  async UNSUBSCRIBE<T extends boolean = false>(
    channels?: string | Array<string>,
    listener?: PubSubListener<boolean>,
    bufferMode?: T
  ) {
    return this._self.#internal.unsubscribe(channels, listener, bufferMode);
  }

  unsubscribe = this.UNSUBSCRIBE;

  async PSUBSCRIBE<T extends boolean = false>(
    patterns: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this._self.#internal.pSubscribe(patterns, listener, bufferMode);
  }

  pSubscribe = this.PSUBSCRIBE;

  async PUNSUBSCRIBE<T extends boolean = false>(
    patterns?: string | Array<string>,
    listener?: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this._self.#internal.pUnsubscribe(patterns, listener, bufferMode);
  }

  pUnsubscribe = this.PUNSUBSCRIBE;

  async aquire(): Promise<RedisSentinelClientType<M, F, S, RESP, TYPE_MAPPING>> {
    const clientInfo = await this._self.#internal.getClientLease();
    return RedisSentinelClient.create(this._self.#options, this._self.#internal, clientInfo, this._self.#commandOptions);
  }

  getSentinelNode(): RedisNode | undefined {
    return this._self.#internal.getSentinelNode();
  }

  getMasterNode(): RedisNode | undefined {
    return this._self.#internal.getMasterNode();
  }

  getReplicaNodes(): Map<RedisNode, number> {
    return this._self.#internal.getReplicaNodes();
  }

  setTracer(tracer?: Array<string>) {
    if (tracer) {
      this._self.#trace = (msg: string) => { tracer.push(msg) };
    } else {
      this._self.#trace = () => { };
    }

    this._self.#internal.setTracer(tracer);
  }
}

class RedisSentinelInternal<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends EventEmitter {
  #isOpen = false;

  get isOpen() {
    return this.#isOpen;
  }

  #isReady = false;

  get isReady() {
    return this.#isReady;
  }

  readonly #name: string;
  readonly #nodeClientOptions: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING, RedisTcpSocketOptions>;
  readonly #sentinelClientOptions: RedisClientOptions<typeof RedisSentinelModule, RedisFunctions, RedisScripts, RespVersions, TypeMapping, RedisTcpSocketOptions>;
  readonly #scanInterval: number;
  readonly #passthroughClientErrorEvents: boolean;

  #anotherReset = false;

  #configEpoch: number = 0;

  #sentinelRootNodes: Array<RedisNode>;
  #sentinelClient?: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>;

  #masterClients: Array<RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>> = [];
  #masterClientQueue: WaitQueue<number>;
  readonly #masterPoolSize: number;

  #replicaClients: Array<RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>> = [];
  #replicaClientsIdx: number = 0;
  readonly #replicaPoolSize: number;

  get useReplicas() {
    return this.#replicaPoolSize > 0;
  }

  #connectPromise?: Promise<void>;
  #maxCommandRediscovers: number;
  readonly #pubSubProxy: PubSubProxy;

  #scanTimer?: NodeJS.Timeout

  #destroy = false;

  #trace: (msg: string) => unknown = () => { };

  #clientSideCache?: PooledClientSideCacheProvider;
  get clientSideCache() {
    return this.#clientSideCache;
  }

  constructor(options: RedisSentinelOptions<M, F, S, RESP, TYPE_MAPPING>) {
    super();

    this.#name = options.name;

    this.#sentinelRootNodes = Array.from(options.sentinelRootNodes);
    this.#maxCommandRediscovers = options.maxCommandRediscovers ?? 16;
    this.#masterPoolSize = options.masterPoolSize ?? 1;
    this.#replicaPoolSize = options.replicaPoolSize ?? 0;
    this.#scanInterval = options.scanInterval ?? 0;
    this.#passthroughClientErrorEvents = options.passthroughClientErrorEvents ?? false;

    this.#nodeClientOptions = (options.nodeClientOptions ? {...options.nodeClientOptions} : {}) as RedisClientOptions<M, F, S, RESP, TYPE_MAPPING, RedisTcpSocketOptions>;
    if (this.#nodeClientOptions.url !== undefined) {
      throw new Error("invalid nodeClientOptions for Sentinel");
    }

    if (options.clientSideCache) {
      if (options.clientSideCache instanceof PooledClientSideCacheProvider) {
        this.#clientSideCache = this.#nodeClientOptions.clientSideCache = options.clientSideCache;
      } else {
        const cscConfig = options.clientSideCache;
        this.#clientSideCache = this.#nodeClientOptions.clientSideCache = new BasicPooledClientSideCache(cscConfig);
//        this.#clientSideCache = this.#nodeClientOptions.clientSideCache = new PooledNoRedirectClientSideCache(cscConfig);
      }
    }

    this.#sentinelClientOptions = options.sentinelClientOptions ? Object.assign({} as RedisClientOptions<typeof RedisSentinelModule, F, S, RESP, TYPE_MAPPING, RedisTcpSocketOptions>, options.sentinelClientOptions) : {};
    this.#sentinelClientOptions.modules = RedisSentinelModule;

    if (this.#sentinelClientOptions.url !== undefined) {
      throw new Error("invalid sentinelClientOptions for Sentinel");
    }

    this.#masterClientQueue = new WaitQueue();
    for (let i = 0; i < this.#masterPoolSize; i++) {
      this.#masterClientQueue.push(i);
    }

    /* persistent object for life of sentinel object */
    this.#pubSubProxy = new PubSubProxy(
      this.#nodeClientOptions,
      err => this.emit('error', err)
    );
  }

  #createClient(node: RedisNode, clientOptions: RedisClientOptions, reconnectStrategy?: undefined | false) {
    return RedisClient.create({
      ...clientOptions,
      socket: {
        ...clientOptions.socket,
        host: node.host,
        port: node.port,
        reconnectStrategy
      }
    });
  }

  getClientLease(): ClientInfo | Promise<ClientInfo> {
    const id = this.#masterClientQueue.shift();
    if (id !== undefined) {
      return { id };
    }

    return this.#masterClientQueue.wait().then(id => ({ id }));
  }

  releaseClientLease(clientInfo: ClientInfo) {
    const client = this.#masterClients[clientInfo.id];
    // client can be undefined if releasing in middle of a reconfigure
    if (client !== undefined) {
      const dirtyPromise = client.resetIfDirty();
      if (dirtyPromise) {
        return dirtyPromise
          .then(() => this.#masterClientQueue.push(clientInfo.id));
      }
    }

    this.#masterClientQueue.push(clientInfo.id);
  }

  async connect() {
    if (this.#isOpen) {
      throw new Error("already attempting to open")
    }

    try {
      this.#isOpen = true;

      this.#connectPromise = this.#connect();
      await this.#connectPromise;
      this.#isReady = true;
    } finally {
      this.#connectPromise = undefined;
      if (this.#scanInterval > 0) {
        this.#scanTimer = setInterval(this.#reset.bind(this), this.#scanInterval);
      }
    }
  }

  async #connect() {
    let count = 0;
    while (true) {
      this.#trace("starting connect loop");

      if (this.#destroy) {
        this.#trace("in #connect and want to destroy")
        return;
      }
      try {
        this.#anotherReset = false;
        await this.transform(this.analyze(await this.observe()));
        if (this.#anotherReset) {
          this.#trace("#connect: anotherReset is true, so continuing");
          continue;
        }

        this.#trace("#connect: returning");
        return;
      } catch (e: any) {
        this.#trace(`#connect: exception ${e.message}`);
        if (!this.#isReady && count > this.#maxCommandRediscovers) {
          throw e;
        }

        if (e.message !== 'no valid master node') {
          console.log(e);
        }
        await setTimeout(1000);
      } finally {
        this.#trace("finished connect");
      }
    }
  }

  async execute<T>(
    fn: (client: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => Promise<T>,
    clientInfo?: ClientInfo
  ): Promise<T> {
    let iter = 0;

    while (true) {
      if (this.#connectPromise !== undefined) {
        await this.#connectPromise;
      }

      const client = this.#getClient(clientInfo);

      if (!client.isReady) {
        await this.#reset();
        continue;
      }
      const sockOpts = client.options?.socket as TcpNetConnectOpts | undefined;
      this.#trace("attemping to send command to " + sockOpts?.host + ":" + sockOpts?.port)

      try {
        /*
                // force testing of READONLY errors        
                if (clientInfo !== undefined) {
                  if (Math.floor(Math.random() * 10) < 1) {
                    console.log("throwing READONLY error");
                    throw new Error("READONLY You can't write against a read only replica.");
                  }
                }
        */
        return await fn(client);
      } catch (err) {
        if (++iter > this.#maxCommandRediscovers || !(err instanceof Error)) {
          throw err;
        }

        /* 
          rediscover and retry if doing a command against a "master"
          a) READONLY error (topology has changed) but we haven't been notified yet via pubsub
          b) client is "not ready" (disconnected), which means topology might have changed, but sentinel might not see it yet
        */
        if (clientInfo !== undefined && (err.message.startsWith('READONLY') || !client.isReady)) {
          await this.#reset();
          continue;
        }

        throw err;
      }
    }
  }

  async #createPubSub(client: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) {
    /* Whenever sentinels or slaves get added, or when slave configuration changes, reconfigure */
    await client.pSubscribe(['switch-master', '[-+]sdown', '+slave', '+sentinel', '[-+]odown', '+slave-reconf-done'], (message, channel) => {
      this.#handlePubSubControlChannel(channel, message);
    }, true);

    return client;
  }

  async #handlePubSubControlChannel(channel: Buffer, message: Buffer) {
    this.#trace("pubsub control channel message on " + channel);
    this.#reset();
  }

  // if clientInfo is defined, it corresponds to a master client in the #masterClients array, otherwise loop around replicaClients
  #getClient(clientInfo?: ClientInfo): RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> {
    if (clientInfo !== undefined) {
      return this.#masterClients[clientInfo.id];
    }

    if (this.#replicaClientsIdx >= this.#replicaClients.length) {
      this.#replicaClientsIdx = 0;
    }

    if (this.#replicaClients.length == 0) {
      throw new Error("no replicas available for read");
    }

    return this.#replicaClients[this.#replicaClientsIdx++];
  }

  async #reset() {
    /* closing / don't reset */
    if (this.#isReady == false || this.#destroy == true) {
      return;
    }

    // already in #connect()
    if (this.#connectPromise !== undefined) {
      this.#anotherReset = true;
      return await this.#connectPromise;
    }

    try {
      this.#connectPromise = this.#connect();
      return await this.#connectPromise;
    } finally {
      this.#trace("finished reconfgure");
      this.#connectPromise = undefined;
    }
  }

  async close() {
    this.#destroy = true;

    if (this.#connectPromise != undefined) {
      await this.#connectPromise;
    }

    this.#isReady = false;

    this.#clientSideCache?.onPoolClose();

    if (this.#scanTimer) {
      clearInterval(this.#scanTimer);
      this.#scanTimer = undefined;
    }

    const promises = [];

    if (this.#sentinelClient !== undefined) {
      if (this.#sentinelClient.isOpen) {
        promises.push(this.#sentinelClient.close());
      }
      this.#sentinelClient = undefined;
    }

    for (const client of this.#masterClients) {
      if (client.isOpen) {
        promises.push(client.close());
      }
    }

    this.#masterClients = [];

    for (const client of this.#replicaClients) {
      if (client.isOpen) {
        promises.push(client.close());
      }
    }

    this.#replicaClients = [];

    await Promise.all(promises);

    this.#pubSubProxy.destroy();

    this.#isOpen = false;
  }

  // destroy has to be async because its stopping others async events, timers and the like
  // and shouldn't return until its finished.
  async destroy() {
    this.#destroy = true;

    if (this.#connectPromise != undefined) {
      await this.#connectPromise;
    }

    this.#isReady = false;

    this.#clientSideCache?.onPoolClose();

    if (this.#scanTimer) {
      clearInterval(this.#scanTimer);
      this.#scanTimer = undefined;
    }

    if (this.#sentinelClient !== undefined) {
      if (this.#sentinelClient.isOpen) {
        this.#sentinelClient.destroy();
      }
      this.#sentinelClient = undefined;
    }

    for (const client of this.#masterClients) {
      if (client.isOpen) {
        client.destroy();
      }
    }
    this.#masterClients = [];

    for (const client of this.#replicaClients) {
      if (client.isOpen) {
        client.destroy();
      }
    }
    this.#replicaClients = [];

    this.#pubSubProxy.destroy();

    this.#isOpen = false
    this.#destroy = false;
  }

  async subscribe<T extends boolean = false>(
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this.#pubSubProxy.subscribe(channels, listener, bufferMode);
  }

  async unsubscribe<T extends boolean = false>(
    channels?: string | Array<string>,
    listener?: PubSubListener<boolean>,
    bufferMode?: T
  ) {
    return this.#pubSubProxy.unsubscribe(channels, listener, bufferMode);
  }

  async pSubscribe<T extends boolean = false>(
    patterns: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this.#pubSubProxy.pSubscribe(patterns, listener, bufferMode);
  }

  async pUnsubscribe<T extends boolean = false>(
    patterns?: string | Array<string>,
    listener?: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this.#pubSubProxy.pUnsubscribe(patterns, listener, bufferMode);
  }

  // observe/analyze/transform remediation functions
  async observe() {
    for (const node of this.#sentinelRootNodes) {
      let client: RedisClientType<typeof RedisSentinelModule, {}, {}, RespVersions, {}> | undefined;
      try {
        this.#trace(`observe: trying to connect to sentinel: ${node.host}:${node.port}`)
        client = this.#createClient(node, this.#sentinelClientOptions, false) as unknown as RedisClientType<typeof RedisSentinelModule, {}, {}, RespVersions, {}>;
        client.on('error', (err) => this.emit('error', `obseve client error: ${err}`));
        await client.connect();
        this.#trace(`observe: connected to sentinel`)

        const [sentinelData, masterData, replicaData] = await Promise.all([
          client.sentinel.sentinelSentinels(this.#name),
          client.sentinel.sentinelMaster(this.#name),
          client.sentinel.sentinelReplicas(this.#name)
        ]);

        this.#trace("observe: got all sentinel data");

        const ret = {
          sentinelConnected: node,
          sentinelData: sentinelData,
          masterData: masterData,
          replicaData: replicaData,
          currentMaster: this.getMasterNode(),
          currentReplicas: this.getReplicaNodes(),
          currentSentinel: this.getSentinelNode(),
          replicaPoolSize: this.#replicaPoolSize,
          useReplicas: this.useReplicas
        }

        return ret;
      } catch (err) {
        this.#trace(`observe: error ${err}`);
        this.emit('error', err);
      } finally {
        if (client !== undefined && client.isOpen) {
          this.#trace(`observe: destroying sentinel client`);
          client.destroy();
        }
      }
    }

    this.#trace(`observe: none of the sentinels are available`);
    throw new Error('None of the sentinels are available');
  }

  analyze(observed: Awaited<ReturnType<RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>["observe"]>>) {
    let master = parseNode(observed.masterData);
    if (master === undefined) {
      this.#trace(`analyze: no valid master node because ${observed.masterData.flags}`);
      throw new Error("no valid master node");
    }

    if (master.host === observed.currentMaster?.host && master.port === observed.currentMaster?.port) {
      this.#trace(`analyze: master node hasn't changed from ${observed.currentMaster?.host}:${observed.currentMaster?.port}`);
      master = undefined;
    } else {
      this.#trace(`analyze: master node has changed to ${master.host}:${master.port} from ${observed.currentMaster?.host}:${observed.currentMaster?.port}`);
    }

    let sentinel: RedisNode | undefined = observed.sentinelConnected;
    if (sentinel.host === observed.currentSentinel?.host && sentinel.port === observed.currentSentinel.port) {
      this.#trace(`analyze: sentinel node hasn't changed`);
      sentinel = undefined;
    } else {
      this.#trace(`analyze: sentinel node has changed to ${sentinel.host}:${sentinel.port}`);
    }

    const replicasToClose: Array<RedisNode> = [];
    const replicasToOpen = new Map<RedisNode, number>();

    const desiredSet = new Set<string>();
    const seen = new Set<string>();

    if (observed.useReplicas) {
      const replicaList = createNodeList(observed.replicaData)

      for (const node of replicaList) {
        desiredSet.add(JSON.stringify(node));
      }

      for (const [node, value] of observed.currentReplicas) {
        if (!desiredSet.has(JSON.stringify(node))) {
          replicasToClose.push(node);
          this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToClose`);
        } else {
          seen.add(JSON.stringify(node));
          if (value != observed.replicaPoolSize) {
            replicasToOpen.set(node, observed.replicaPoolSize - value);
            this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToOpen`);
          }
        }
      }

      for (const node of replicaList) {
        if (!seen.has(JSON.stringify(node))) {
          replicasToOpen.set(node, observed.replicaPoolSize);
          this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToOpen`);
        }
      }
    }

    const ret = {
      sentinelList: [observed.sentinelConnected].concat(createNodeList(observed.sentinelData)),
      epoch: Number(observed.masterData['config-epoch']),

      sentinelToOpen: sentinel,
      masterToOpen: master,
      replicasToClose: replicasToClose,
      replicasToOpen: replicasToOpen,
    };

    return ret;
  }

  async transform(analyzed: ReturnType<RedisSentinelInternal<M, F, S, RESP, TYPE_MAPPING>["analyze"]>) {
    this.#trace("transform: enter");

    let promises: Array<Promise<any>> = [];

    if (analyzed.sentinelToOpen) {
      this.#trace(`transform: opening a new sentinel`);
      if (this.#sentinelClient !== undefined && this.#sentinelClient.isOpen) {
        this.#trace(`transform: destroying old sentinel as open`);
        this.#sentinelClient.destroy()
        this.#sentinelClient = undefined;
      } else {
        this.#trace(`transform: not destroying old sentinel as not open`);
      }

      this.#trace(`transform: creating new sentinel to ${analyzed.sentinelToOpen.host}:${analyzed.sentinelToOpen.port}`);
      const node = analyzed.sentinelToOpen;
      const client = this.#createClient(analyzed.sentinelToOpen, this.#sentinelClientOptions, false);
      client.on('error', (err: Error) => {
        if (this.#passthroughClientErrorEvents) {
          this.emit('error', new Error(`Sentinel Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
        }
        const event: ClientErrorEvent = {
          type: 'SENTINEL',
          node: clientSocketToNode(client.options!.socket!),
          error: err
        };
        this.emit('client-error', event);
        this.#reset();
      });
      this.#sentinelClient = client;

      this.#trace(`transform: adding sentinel client connect() to promise list`);
      const promise = this.#sentinelClient.connect().then((client) => { return this.#createPubSub(client) });
      promises.push(promise);

      this.#trace(`created sentinel client to ${analyzed.sentinelToOpen.host}:${analyzed.sentinelToOpen.port}`);
      const event: RedisSentinelEvent = {
        type: "SENTINEL_CHANGE",
        node: analyzed.sentinelToOpen
      }
      this.#trace(`transform: emiting topology-change event for sentinel_change`);
      if (!this.emit('topology-change', event)) {
        this.#trace(`transform: emit for topology-change for sentinel_change returned false`);
      }
    }

    if (analyzed.masterToOpen) {
      this.#trace(`transform: opening a new master`);
      const masterPromises = [];
      const masterWatches: Array<boolean> = [];

      this.#trace(`transform: destroying old masters if open`);
      for (const client of this.#masterClients) {
        masterWatches.push(client.isWatching);

        if (client.isOpen) {
          client.destroy()
        }
      }

      this.#masterClients = [];

      this.#trace(`transform: creating all master clients and adding connect promises`);
      for (let i = 0; i < this.#masterPoolSize; i++) {
        const node = analyzed.masterToOpen;
        const client = this.#createClient(analyzed.masterToOpen, this.#nodeClientOptions);
        client.on('error', (err: Error) => {
          if (this.#passthroughClientErrorEvents) {
            this.emit('error', new Error(`Master Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
          }
          const event: ClientErrorEvent = {
            type: "MASTER",
            node: clientSocketToNode(client.options!.socket!),
            error: err
          };
          this.emit('client-error', event);
        });

        if (masterWatches[i]) {
          client.setDirtyWatch("sentinel config changed in middle of a WATCH Transaction");
        }
        this.#masterClients.push(client);
        masterPromises.push(client.connect());

        this.#trace(`created master client to ${analyzed.masterToOpen.host}:${analyzed.masterToOpen.port}`);
      }

      this.#trace(`transform: adding promise to change #pubSubProxy node`);
      masterPromises.push(this.#pubSubProxy.changeNode(analyzed.masterToOpen));
      promises.push(...masterPromises);
      const event: RedisSentinelEvent = {
        type: "MASTER_CHANGE",
        node: analyzed.masterToOpen
      }
      this.#trace(`transform: emiting topology-change event for master_change`);
      if (!this.emit('topology-change', event)) {
        this.#trace(`transform: emit for topology-change for master_change returned false`);
      }
      this.#configEpoch++;
    }

    const replicaCloseSet = new Set<string>();
    for (const node of analyzed.replicasToClose) {
      const str = JSON.stringify(node);
      replicaCloseSet.add(str);
    }

    const newClientList: Array<RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>> = [];
    const removedSet = new Set<string>();

    for (const replica of this.#replicaClients) {
      const node = clientSocketToNode(replica.options!.socket!);
      const str = JSON.stringify(node);

      if (replicaCloseSet.has(str) || !replica.isOpen) {
        if (replica.isOpen) {
          const sockOpts = replica.options?.socket as TcpNetConnectOpts | undefined;
          this.#trace(`destroying replica client to ${sockOpts?.host}:${sockOpts?.port}`);
          replica.destroy()
        }
        if (!removedSet.has(str)) {
          const event: RedisSentinelEvent = {
            type: "REPLICA_REMOVE",
            node: node
          }
          this.emit('topology-change', event);
          removedSet.add(str);
        }
      } else {
        newClientList.push(replica);
      }
    }
    this.#replicaClients = newClientList;

    if (analyzed.replicasToOpen.size != 0) {
      for (const [node, size] of analyzed.replicasToOpen) {
        for (let i = 0; i < size; i++) {
          const client = this.#createClient(node, this.#nodeClientOptions);
          client.on('error', (err: Error) => {
            if (this.#passthroughClientErrorEvents) {
              this.emit('error', new Error(`Replica Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
            }
            const event: ClientErrorEvent = {
              type: "REPLICA",
              node: clientSocketToNode(client.options!.socket!),
              error: err
            };
            this.emit('client-error', event);
          });

          this.#replicaClients.push(client);
          promises.push(client.connect());

          this.#trace(`created replica client to ${node.host}:${node.port}`);
        }
        const event: RedisSentinelEvent = {
          type: "REPLICA_ADD",
          node: node
        }
        this.emit('topology-change', event);
      }
    }

    if (analyzed.sentinelList.length != this.#sentinelRootNodes.length) {
      this.#sentinelRootNodes = analyzed.sentinelList;
      const event: RedisSentinelEvent = {
        type: "SENTINE_LIST_CHANGE",
        size: analyzed.sentinelList.length
      }
      this.emit('topology-change', event);
    }

    await Promise.all(promises);
    this.#trace("transform: exit");
  }

  // introspection functions
  getMasterNode(): RedisNode | undefined {
    if (this.#masterClients.length == 0) {
      return undefined;
    }

    for (const master of this.#masterClients) {
      if (master.isReady) {
        return clientSocketToNode(master.options!.socket!);
      }
    }

    return undefined;
  }

  getSentinelNode(): RedisNode | undefined {
    if (this.#sentinelClient === undefined) {
      return undefined;
    }

    return clientSocketToNode(this.#sentinelClient.options!.socket!);
  }

  getReplicaNodes(): Map<RedisNode, number> {
    const ret = new Map<RedisNode, number>();
    const initialMap = new Map<string, number>();

    for (const replica of this.#replicaClients) {
      const node = clientSocketToNode(replica.options!.socket!);
      const hash = JSON.stringify(node);

      if (replica.isReady) {
        initialMap.set(hash, (initialMap.get(hash) ?? 0) + 1);
      } else {
        if (!initialMap.has(hash)) {
          initialMap.set(hash, 0);
        }
      }
    }

    for (const [key, value] of initialMap) {
      ret.set(JSON.parse(key) as RedisNode, value);
    }

    return ret;
  }

  setTracer(tracer?: Array<string>) {
    if (tracer) {
      this.#trace = (msg: string) => { tracer.push(msg) };
    } else {
      // empty function is faster than testing if something is defined or not
      this.#trace = () => { };
    }
  }
}

export class RedisSentinelFactory extends EventEmitter {
  options: RedisSentinelOptions;
  #sentinelRootNodes: Array<RedisNode>;
  #replicaIdx: number = -1;

  constructor(options: RedisSentinelOptions) {
    super();

    this.options = options;
    this.#sentinelRootNodes = options.sentinelRootNodes;
  }

  async updateSentinelRootNodes() {
    for (const node of this.#sentinelRootNodes) {
      const client = RedisClient.create({
        ...this.options.sentinelClientOptions,
        socket: {
          ...this.options.sentinelClientOptions?.socket,
          host: node.host,
          port: node.port,
          reconnectStrategy: false
        },
        modules: RedisSentinelModule
      }).on('error', (err) => this.emit(`updateSentinelRootNodes: ${err}`));
      try {
        await client.connect();
      } catch {
        if (client.isOpen) {
          client.destroy();
        }
        continue;
      }

      try {
        const sentinelData = await client.sentinel.sentinelSentinels(this.options.name);
        this.#sentinelRootNodes = [node].concat(createNodeList(sentinelData));
        return;
      } finally {
        client.destroy();
      }
    }

    throw new Error("Couldn't connect to any sentinel node");
  }

  async getMasterNode() {
    let connected = false;

    for (const node of this.#sentinelRootNodes) {
      const client = RedisClient.create({
        ...this.options.sentinelClientOptions,
        socket: {
          ...this.options.sentinelClientOptions?.socket,
          host: node.host,
          port: node.port,
          reconnectStrategy: false
        },
        modules: RedisSentinelModule
      }).on('error', err => this.emit(`getMasterNode: ${err}`));

      try {
        await client.connect();
      } catch {
        if (client.isOpen) {
          client.destroy();
        }
        continue;
      }

      connected = true;

      try {
        const masterData = await client.sentinel.sentinelMaster(this.options.name);

        let master = parseNode(masterData);
        if (master === undefined) {
          continue;
        }

        return master;
      } finally {
        client.destroy();
      }
    }

    if (connected) {
      throw new Error("Master Node Not Enumerated");
    }

    throw new Error("couldn't connect to any sentinels");
  }

  async getMasterClient() {
    const master = await this.getMasterNode();
    return RedisClient.create({
      ...this.options.nodeClientOptions,
      socket: {
        ...this.options.nodeClientOptions?.socket,
        host: master.host,
        port: master.port
      }
    });
  }

  async getReplicaNodes() {
    let connected = false;

    for (const node of this.#sentinelRootNodes) {
      const client = RedisClient.create({
        ...this.options.sentinelClientOptions,
        socket: {
          ...this.options.sentinelClientOptions?.socket,
          host: node.host,
          port: node.port,
          reconnectStrategy: false
        },
        modules: RedisSentinelModule
      }).on('error', err => this.emit(`getReplicaNodes: ${err}`));

      try {
        await client.connect();
      } catch {
        if (client.isOpen) {
          client.destroy();
        }
        continue;
      }

      connected = true;

      try {
        const replicaData = await client.sentinel.sentinelReplicas(this.options.name);

        const replicas = createNodeList(replicaData);
        if (replicas.length == 0) {
          continue;
        }

        return replicas;
      } finally {
        client.destroy();
      }
    }

    if (connected) {
      throw new Error("No Replicas Nodes Enumerated");
    }

    throw new Error("couldn't connect to any sentinels");
  }

  async getReplicaClient() {
    const replicas = await this.getReplicaNodes();
    if (replicas.length == 0) {
      throw new Error("no available replicas");
    }

    this.#replicaIdx++;
    if (this.#replicaIdx >= replicas.length) {
      this.#replicaIdx = 0;
    }

    return RedisClient.create({
      ...this.options.nodeClientOptions,
      socket: {
        ...this.options.nodeClientOptions?.socket,
        host: replicas[this.#replicaIdx].host,
        port: replicas[this.#replicaIdx].port
      }
    });
  }
}
