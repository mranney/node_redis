import { RedisClientOptions, RedisClientType } from '../client';
import { CommandOptions } from '../client/commands-queue';
import { Command, CommandArguments, CommanderConfig, CommandSignature, /*CommandPolicies, CommandWithPoliciesSignature,*/ TypeMapping, RedisArgument, RedisFunction, RedisFunctions, RedisModules, RedisScript, RedisScripts, ReplyUnion, RespVersions } from '../RESP/types';
import COMMANDS from '../commands';
import { EventEmitter } from 'node:events';
import { attachConfig, functionArgumentsPrefix, getTransformReply, scriptArgumentsPrefix } from '../commander';
import RedisClusterSlots, { NodeAddressMap, ShardNode } from './cluster-slots';
import RedisClusterMultiCommand, { RedisClusterMultiCommandType } from './multi-command';
import { PubSubListener } from '../client/pub-sub';
import { ErrorReply } from '../errors';
import { RedisTcpSocketOptions } from '../client/socket';
import { ClientSideCacheConfig, PooledClientSideCacheProvider } from '../client/cache';
import { BasicCommandParser } from '../client/parser';
import { ASKING_CMD } from '../commands/ASKING';

interface ClusterCommander<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping,
  // POLICIES extends CommandPolicies
> extends CommanderConfig<M, F, S, RESP> {
  commandOptions?: ClusterCommandOptions<TYPE_MAPPING/*, POLICIES*/>;
}

export type RedisClusterClientOptions = Omit<
  RedisClientOptions<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping, RedisTcpSocketOptions>,
  keyof ClusterCommander<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping/*, CommandPolicies*/>
>;

export interface RedisClusterOptions<
  M extends RedisModules = RedisModules,
  F extends RedisFunctions = RedisFunctions,
  S extends RedisScripts = RedisScripts,
  RESP extends RespVersions = RespVersions,
  TYPE_MAPPING extends TypeMapping = TypeMapping,
  // POLICIES extends CommandPolicies = CommandPolicies
> extends ClusterCommander<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/> {
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
  // TODO: replicas only mode?
  useReplicas?: boolean;
  /**
   * The maximum number of times a command will be redirected due to `MOVED` or `ASK` errors.
   */
  maxCommandRedirections?: number;
  /**
   * Mapping between the addresses in the cluster (see `CLUSTER SHARDS`) and the addresses the client should connect to
   * Useful when the cluster is running on another network
   */
  nodeAddressMap?: NodeAddressMap;
  /**
   * TODO
   */
  clientSideCache?: PooledClientSideCacheProvider | ClientSideCacheConfig;
}

// remove once request & response policies are ready
type ClusterCommand<
  NAME extends PropertyKey,
  COMMAND extends Command
> = COMMAND['NOT_KEYED_COMMAND'] extends true ? (
  COMMAND['IS_FORWARD_COMMAND'] extends true ? NAME : never
) : NAME;

// CommandWithPoliciesSignature<(typeof COMMANDS)[P], RESP, TYPE_MAPPING, POLICIES>
type WithCommands<
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof typeof COMMANDS as ClusterCommand<P, (typeof COMMANDS)[P]>]: CommandSignature<(typeof COMMANDS)[P], RESP, TYPE_MAPPING>;
};

type WithModules<
  M extends RedisModules,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof M]: {
    [C in keyof M[P] as ClusterCommand<C, M[P][C]>]: CommandSignature<M[P][C], RESP, TYPE_MAPPING>;
  };
};

type WithFunctions<
  F extends RedisFunctions,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [L in keyof F]: {
    [C in keyof F[L] as ClusterCommand<C, F[L][C]>]: CommandSignature<F[L][C], RESP, TYPE_MAPPING>;
  };
};

type WithScripts<
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof S as ClusterCommand<P, S[P]>]: CommandSignature<S[P], RESP, TYPE_MAPPING>;
};

export type RedisClusterType<
  M extends RedisModules = {},
  F extends RedisFunctions = {},
  S extends RedisScripts = {},
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = {},
  // POLICIES extends CommandPolicies = {}
> = (
  RedisCluster<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/> &
  WithCommands<RESP, TYPE_MAPPING> &
  WithModules<M, RESP, TYPE_MAPPING> &
  WithFunctions<F, RESP, TYPE_MAPPING> &
  WithScripts<S, RESP, TYPE_MAPPING>
);

export interface ClusterCommandOptions<
  TYPE_MAPPING extends TypeMapping = TypeMapping
  // POLICIES extends CommandPolicies = CommandPolicies
> extends CommandOptions<TYPE_MAPPING> {
  // policies?: POLICIES;
}

type ProxyCluster = RedisCluster<any, any, any, any, any/*, any*/>;

type NamespaceProxyCluster = { _self: ProxyCluster };

export default class RedisCluster<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping,
  // POLICIES extends CommandPolicies
> extends EventEmitter {
  static #createCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return async function (this: ProxyCluster, ...args: Array<unknown>) {
      const parser = new BasicCommandParser();
      command.parseCommand(parser, ...args);

      return this._self.#execute(
        parser.firstKey,
        command.IS_READ_ONLY,
        this._commandOptions,
        (client, opts) => client._executeCommand(command, parser, opts, transformReply)
      );
    };
  }

  static #createModuleCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return async function (this: NamespaceProxyCluster, ...args: Array<unknown>) {
      const parser = new BasicCommandParser();
      command.parseCommand(parser, ...args);

      return this._self.#execute(
        parser.firstKey,
        command.IS_READ_ONLY,
        this._self._commandOptions,
        (client, opts) => client._executeCommand(command, parser, opts, transformReply)
      );
    };
  }

  static #createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions) {
    const prefix = functionArgumentsPrefix(name, fn);
    const transformReply = getTransformReply(fn, resp);

    return async function (this: NamespaceProxyCluster, ...args: Array<unknown>) {
      const parser = new BasicCommandParser();
      parser.push(...prefix);
      fn.parseCommand(parser, ...args);

      return this._self.#execute(
        parser.firstKey,
        fn.IS_READ_ONLY,
        this._self._commandOptions,
        (client, opts) => client._executeCommand(fn, parser, opts, transformReply)
      );
    };
  }

  static #createScriptCommand(script: RedisScript, resp: RespVersions) {
    const prefix = scriptArgumentsPrefix(script);
    const transformReply = getTransformReply(script, resp);

    return async function (this: ProxyCluster, ...args: Array<unknown>) {
      const parser = new BasicCommandParser();
      parser.push(...prefix);
      script.parseCommand(parser, ...args);

      return this._self.#execute(
        parser.firstKey,
        script.IS_READ_ONLY,
        this._commandOptions,
        (client, opts) => client._executeScript(script, parser, opts, transformReply)
      );
    };
  }

  static factory<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {},
    // POLICIES extends CommandPolicies = {}
  >(config?: ClusterCommander<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>) {
    const Cluster = attachConfig({
      BaseClass: RedisCluster,
      commands: COMMANDS,
      createCommand: RedisCluster.#createCommand,
      createModuleCommand: RedisCluster.#createModuleCommand,
      createFunctionCommand: RedisCluster.#createFunctionCommand,
      createScriptCommand: RedisCluster.#createScriptCommand,
      config
    });

    Cluster.prototype.Multi = RedisClusterMultiCommand.extend(config);

    return (options?: Omit<RedisClusterOptions, keyof Exclude<typeof config, undefined>>) => {
      // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
      return Object.create(new Cluster(options)) as RedisClusterType<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>;
    };
  }

  static create<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {},
    // POLICIES extends CommandPolicies = {}
  >(options?: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>) {
    return RedisCluster.factory(options)(options);
  }

  readonly #options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>;

  readonly #slots: RedisClusterSlots<M, F, S, RESP, TYPE_MAPPING>;

  private _self = this;
  private _commandOptions?: ClusterCommandOptions<TYPE_MAPPING/*, POLICIES*/>;

  /**
   * An array of the cluster slots, each slot contain its `master` and `replicas`.
   * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
   */
  get slots() {
    return this._self.#slots.slots;
  }

  get clientSideCache() {
    return this._self.#slots.clientSideCache;
  }

  /**
   * An array of the cluster masters.
   * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific master node.
   */
  get masters() {
    return this._self.#slots.masters;
  }

  /**
   * An array of the cluster replicas.
   * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific replica node.
   */
  get replicas() {
    return this._self.#slots.replicas;
  }

  /**
   * A map form a node address (`<host>:<port>`) to its shard, each shard contain its `master` and `replicas`.
   * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
   */
  get nodeByAddress() {
    return this._self.#slots.nodeByAddress;
  }

  /**
   * The current pub/sub node.
   */
  get pubSubNode() {
    return this._self.#slots.pubSubNode;
  }

  get isOpen() {
    return this._self.#slots.isOpen;
  }

  constructor(options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>) {
    super();

    this.#options = options;
    this.#slots = new RedisClusterSlots(options, this.emit.bind(this));

    if (options?.commandOptions) {
      this._commandOptions = options.commandOptions;
    }
  }

  duplicate<
    _M extends RedisModules = M,
    _F extends RedisFunctions = F,
    _S extends RedisScripts = S,
    _RESP extends RespVersions = RESP,
    _TYPE_MAPPING extends TypeMapping = TYPE_MAPPING
  >(overrides?: Partial<RedisClusterOptions<_M, _F, _S, _RESP, _TYPE_MAPPING>>) {
    return new (Object.getPrototypeOf(this).constructor)({
      ...this._self.#options,
      commandOptions: this._commandOptions,
      ...overrides
    }) as RedisClusterType<_M, _F, _S, _RESP, _TYPE_MAPPING>;
  }

  async connect() {
    await this._self.#slots.connect();
    return this as unknown as RedisClusterType<M, F, S, RESP, TYPE_MAPPING>;
  }

  withCommandOptions<
    OPTIONS extends ClusterCommandOptions<TYPE_MAPPING/*, CommandPolicies*/>,
    TYPE_MAPPING extends TypeMapping,
    // POLICIES extends CommandPolicies
  >(options: OPTIONS) {
    const proxy = Object.create(this);
    proxy._commandOptions = options;
    return proxy as RedisClusterType<
      M,
      F,
      S,
      RESP,
      TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}
      // POLICIES extends CommandPolicies ? POLICIES : {}
    >;
  }

  private _commandOptionsProxy<
    K extends keyof ClusterCommandOptions,
    V extends ClusterCommandOptions[K]
  >(
    key: K,
    value: V
  ) {
    const proxy = Object.create(this);
    proxy._commandOptions = Object.create(this._commandOptions ?? null);
    proxy._commandOptions[key] = value;
    return proxy as RedisClusterType<
      M,
      F, 
      S,
      RESP,
      K extends 'typeMapping' ? V extends TypeMapping ? V : {} : TYPE_MAPPING
      // K extends 'policies' ? V extends CommandPolicies ? V : {} : POLICIES
    >;
  }

  /**
   * Override the `typeMapping` command option
   */
  withTypeMapping<TYPE_MAPPING extends TypeMapping>(typeMapping: TYPE_MAPPING) {
    return this._commandOptionsProxy('typeMapping', typeMapping);
  }

  // /**
  //  * Override the `policies` command option
  //  * TODO
  //  */
  // withPolicies<POLICIES extends CommandPolicies> (policies: POLICIES) {
  //   return this._commandOptionsProxy('policies', policies);
  // }

  #handleAsk<T>(
    fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, opts?: ClusterCommandOptions) => Promise<T>
  ) {
    return async (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, options?: ClusterCommandOptions) => {
      const chainId = Symbol("asking chain");
      const opts = options ? {...options} : {};
      opts.chainId = chainId;



      const ret = await Promise.all(
        [
          client.sendCommand([ASKING_CMD], {chainId: chainId}),
          fn(client, opts)
        ]
      );

      return ret[1];
    };
  }

  async #execute<T>(
    firstKey: RedisArgument | undefined,
    isReadonly: boolean | undefined,
    options: ClusterCommandOptions | undefined,
    fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>, opts?: ClusterCommandOptions) => Promise<T>
  ): Promise<T> {
    const maxCommandRedirections = this.#options.maxCommandRedirections ?? 16;
    let client = await this.#slots.getClient(firstKey, isReadonly);
    let i = 0;

    let myFn = fn;

    while (true) {
      try {
        return await myFn(client, options);
      } catch (err) {
        myFn = fn;

        // TODO: error class
        if (++i > maxCommandRedirections || !(err instanceof Error)) {
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

          client = redirectTo;
          myFn = this.#handleAsk(fn);
          continue;
        }
        
        if (err.message.startsWith('MOVED')) {
          await this.#slots.rediscover(client);
          client = await this.#slots.getClient(firstKey, isReadonly);
          continue;
        }

        throw err;
      } 
    }
  }

  async sendCommand<T = ReplyUnion>(
    firstKey: RedisArgument | undefined,
    isReadonly: boolean | undefined,
    args: CommandArguments,
    options?: ClusterCommandOptions,
    // defaultPolicies?: CommandPolicies
  ): Promise<T> {
    return this._self.#execute(
      firstKey,
      isReadonly,
      options,
      (client, opts) => client.sendCommand(args, opts)
    );
  }

  MULTI(routing?: RedisArgument) {
    type Multi = new (...args: ConstructorParameters<typeof RedisClusterMultiCommand>) => RedisClusterMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    return new ((this as any).Multi as Multi)(
      async (firstKey, isReadonly, commands) => {
        const client = await this._self.#slots.getClient(firstKey, isReadonly);
        return client._executeMulti(commands);
      },
      async (firstKey, isReadonly, commands) => {
        const client = await this._self.#slots.getClient(firstKey, isReadonly);
        return client._executePipeline(commands);
      },
      routing,
      this._commandOptions?.typeMapping
    );
  }

  multi = this.MULTI;

  async SUBSCRIBE<T extends boolean = false>(
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return (await this._self.#slots.getPubSubClient())
      .SUBSCRIBE(channels, listener, bufferMode);
  }

  subscribe = this.SUBSCRIBE;

  async UNSUBSCRIBE<T extends boolean = false>(
    channels?: string | Array<string>,
    listener?: PubSubListener<boolean>,
    bufferMode?: T
  ) {
    return this._self.#slots.executeUnsubscribeCommand(client =>
      client.UNSUBSCRIBE(channels, listener, bufferMode)
    );
  }

  unsubscribe = this.UNSUBSCRIBE;

  async PSUBSCRIBE<T extends boolean = false>(
    patterns: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return (await this._self.#slots.getPubSubClient())
      .PSUBSCRIBE(patterns, listener, bufferMode);
  }

  pSubscribe = this.PSUBSCRIBE;

  async PUNSUBSCRIBE<T extends boolean = false>(
    patterns?: string | Array<string>,
    listener?: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this._self.#slots.executeUnsubscribeCommand(client =>
      client.PUNSUBSCRIBE(patterns, listener, bufferMode)
    );
  }

  pUnsubscribe = this.PUNSUBSCRIBE;

  async SSUBSCRIBE<T extends boolean = false>(
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    const maxCommandRedirections = this._self.#options.maxCommandRedirections ?? 16,
      firstChannel = Array.isArray(channels) ? channels[0] : channels;
    let client = await this._self.#slots.getShardedPubSubClient(firstChannel);
    for (let i = 0; ; i++) {
      try {
        return await client.SSUBSCRIBE(channels, listener, bufferMode);
      } catch (err) {
        if (++i > maxCommandRedirections || !(err instanceof ErrorReply)) {
          throw err;
        }

        if (err.message.startsWith('MOVED')) {
          await this._self.#slots.rediscover(client);
          client = await this._self.#slots.getShardedPubSubClient(firstChannel);
          continue;
        }

        throw err;
      }
    }
  }

  sSubscribe = this.SSUBSCRIBE;

  SUNSUBSCRIBE<T extends boolean = false>(
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    bufferMode?: T
  ) {
    return this._self.#slots.executeShardedUnsubscribeCommand(
      Array.isArray(channels) ? channels[0] : channels,
      client => client.SUNSUBSCRIBE(channels, listener, bufferMode)
    );
  }

  sUnsubscribe = this.SUNSUBSCRIBE;

  /**
   * @deprecated Use `close` instead.
   */
  quit() {
    return this._self.#slots.quit();
  }

  /**
   * @deprecated Use `destroy` instead.
   */
  disconnect() {
    return this._self.#slots.disconnect();
  }

  close() {
    this._self.#slots.clientSideCache?.onPoolClose();
    return this._self.#slots.close();
  }

  destroy() {
    this._self.#slots.clientSideCache?.onPoolClose();
    return this._self.#slots.destroy();
  }

  nodeClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>) {
    return this._self.#slots.nodeClient(node);
  }

  /**
   * Returns a random node from the cluster.
   * Userful for running "forward" commands (like PUBLISH) on a random node.
   */
  getRandomNode() {
    return this._self.#slots.getRandomNode();
  }

  /**
   * Get a random node from a slot.
   * Useful for running readonly commands on a slot.
   */
  getSlotRandomNode(slot: number) {
    return this._self.#slots.getSlotRandomNode(slot);
  }

  /**
   * @deprecated use `.masters` instead
   * TODO
   */
  getMasters() {
    return this.masters;
  }

  /**
   * @deprecated use `.slots[<SLOT>]` instead
   * TODO
   */
  getSlotMaster(slot: number) {
    return this.slots[slot].master;
  }
}
