import { RedisClusterClientOptions, RedisClusterOptions } from '.';
import { RootNodesUnavailableError } from '../errors';
import RedisClient, { RedisClientOptions, RedisClientType } from '../client';
import { EventEmitter } from 'node:stream';
import { ChannelListeners, PUBSUB_TYPE, PubSubTypeListeners } from '../client/pub-sub';
import { RedisArgument, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
import calculateSlot from 'cluster-key-slot';
import { RedisSocketOptions } from '../client/socket';
import { BasicPooledClientSideCache, PooledClientSideCacheProvider } from '../client/cache';

interface NodeAddress {
  host: string;
  port: number;
}

export type NodeAddressMap = {
  [address: string]: NodeAddress;
} | ((address: string) => NodeAddress | undefined);

export interface Node<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> {
  address: string;
  client?: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
  connectPromise?: Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
}

export interface ShardNode<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends Node<M, F, S, RESP, TYPE_MAPPING>, NodeAddress {
  id: string;
  readonly: boolean;
}

export interface MasterNode<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends ShardNode<M, F, S, RESP, TYPE_MAPPING> {
  pubSub?: {
    connectPromise?: Promise<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>;
    client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
  };
}

export interface Shard<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> {
  master: MasterNode<M, F, S, RESP, TYPE_MAPPING>;
  replicas?: Array<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
  nodesIterator?: IterableIterator<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;
}

type ShardWithReplicas<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = Shard<M, F, S, RESP, TYPE_MAPPING> & Required<Pick<Shard<M, F, S, RESP, TYPE_MAPPING>, 'replicas'>>;

type PubSubNode<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (
  Omit<Node<M, F, S, RESP, TYPE_MAPPING>, 'client'> &
  Required<Pick<Node<M, F, S, RESP, TYPE_MAPPING>, 'client'>>
);

type PubSubToResubscribe = Record<
  PUBSUB_TYPE['CHANNELS'] | PUBSUB_TYPE['PATTERNS'],
  PubSubTypeListeners
>;

export type OnShardedChannelMovedError = (
  err: unknown,
  channel: string,
  listeners?: ChannelListeners
) => void;

export default class RedisClusterSlots<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> {
  static #SLOTS = 16384;

  readonly #options;
  readonly #clientFactory;
  readonly #emit: EventEmitter['emit'];
  slots = new Array<Shard<M, F, S, RESP, TYPE_MAPPING>>(RedisClusterSlots.#SLOTS);
  masters = new Array<MasterNode<M, F, S, RESP, TYPE_MAPPING>>();
  replicas = new Array<ShardNode<M, F, S, RESP, TYPE_MAPPING>>();
  readonly nodeByAddress = new Map<string, MasterNode<M, F, S, RESP, TYPE_MAPPING> | ShardNode<M, F, S, RESP, TYPE_MAPPING>>();
  pubSubNode?: PubSubNode<M, F, S, RESP, TYPE_MAPPING>;
  clientSideCache?: PooledClientSideCacheProvider;

  #isOpen = false;

  get isOpen() {
    return this.#isOpen;
  }

  constructor(
    options: RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING>,
    emit: EventEmitter['emit']
  ) {
    this.#options = options;
    
    if (options?.clientSideCache) {
      if (options.clientSideCache instanceof PooledClientSideCacheProvider) {
        this.clientSideCache = options.clientSideCache;
      } else {
        this.clientSideCache = new BasicPooledClientSideCache(options.clientSideCache)
      }
    }

    this.#clientFactory = RedisClient.factory(this.#options);
    this.#emit = emit;
  }

  async connect() {
    if (this.#isOpen) {
      throw new Error('Cluster already open');
    }

    this.#isOpen = true;
    try {
      await this.#discoverWithRootNodes();
    } catch (err) {
      this.#isOpen = false;
      throw err;
    }
  }

  async #discoverWithRootNodes() {
    let start = Math.floor(Math.random() * this.#options.rootNodes.length);
    for (let i = start; i < this.#options.rootNodes.length; i++) {
      if (!this.#isOpen) throw new Error('Cluster closed');
      if (await this.#discover(this.#options.rootNodes[i])) return;
    }

    for (let i = 0; i < start; i++) {
      if (!this.#isOpen) throw new Error('Cluster closed');
      if (await this.#discover(this.#options.rootNodes[i])) return;
    }

    throw new RootNodesUnavailableError();
  }

  #resetSlots() {
    this.slots = new Array(RedisClusterSlots.#SLOTS);
    this.masters = [];
    this.replicas = [];
    this._randomNodeIterator = undefined;
  }

  async #discover(rootNode: RedisClusterClientOptions) {
    this.clientSideCache?.clear();
    this.clientSideCache?.disable();
    this.#resetSlots();
    try {
      const addressesInUse = new Set<string>(),
        promises: Array<Promise<unknown>> = [],
        eagerConnect = this.#options.minimizeConnections !== true;

      for (const { from, to, master, replicas } of await this.#getShards(rootNode)) {
        const shard: Shard<M, F, S, RESP, TYPE_MAPPING> = {
          master: this.#initiateSlotNode(master, false, eagerConnect, addressesInUse, promises)
        };

        if (this.#options.useReplicas) {
          shard.replicas = replicas.map(replica =>
            this.#initiateSlotNode(replica, true, eagerConnect, addressesInUse, promises)
          );
        }

        for (let i = from; i <= to; i++) {
          this.slots[i] = shard;
        }
      }

      if (this.pubSubNode && !addressesInUse.has(this.pubSubNode.address)) {
        const channelsListeners = this.pubSubNode.client.getPubSubListeners(PUBSUB_TYPE.CHANNELS),
          patternsListeners = this.pubSubNode.client.getPubSubListeners(PUBSUB_TYPE.PATTERNS);

        this.pubSubNode.client.destroy();

        if (channelsListeners.size || patternsListeners.size) {
          promises.push(
            this.#initiatePubSubClient({
              [PUBSUB_TYPE.CHANNELS]: channelsListeners,
              [PUBSUB_TYPE.PATTERNS]: patternsListeners
            })
          );
        }
      }

      for (const [address, node] of this.nodeByAddress.entries()) {
        if (addressesInUse.has(address)) continue;

        if (node.client) {
          node.client.destroy();
        }

        const { pubSub } = node as MasterNode<M, F, S, RESP, TYPE_MAPPING>;
        if (pubSub) {
          pubSub.client.destroy();
        }

        this.nodeByAddress.delete(address);
      }

      await Promise.all(promises);
      this.clientSideCache?.enable();

      return true;
    } catch (err) {
      this.#emit('error', err);
      return false;
    }
  }

  async #getShards(rootNode: RedisClusterClientOptions) {
    const options = this.#clientOptionsDefaults(rootNode)!;
    options.socket ??= {};
    options.socket.reconnectStrategy = false;
    options.RESP = this.#options.RESP;
    options.commandOptions = undefined;

    // TODO: find a way to avoid type casting
    const client = await this.#clientFactory(options as RedisClientOptions<M, F, S, RESP, {}>)
      .on('error', err => this.#emit('error', err))
      .connect();

    try {
      // switch to `CLUSTER SHARDS` when Redis 7.0 will be the minimum supported version
      return await client.clusterSlots();
    } finally {
      client.destroy();
    }
  }

  #getNodeAddress(address: string): NodeAddress | undefined {
    switch (typeof this.#options.nodeAddressMap) {
      case 'object':
        return this.#options.nodeAddressMap[address];

      case 'function':
        return this.#options.nodeAddressMap(address);
    }
  }

  #clientOptionsDefaults(options?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>) {
    if (!this.#options.defaults) return options;

    let socket;
    if (this.#options.defaults.socket) {
      socket = options?.socket ? {
        ...this.#options.defaults.socket,
        ...options.socket
      } : this.#options.defaults.socket;
    } else {
      socket = options?.socket;
    }

    return {
      ...this.#options.defaults,
      ...options,
      socket: socket as RedisSocketOptions
    };
  }

  #initiateSlotNode(
    shard: NodeAddress & { id: string; },
    readonly: boolean,
    eagerConnent: boolean,
    addressesInUse: Set<string>,
    promises: Array<Promise<unknown>>
  ) {
    const address = `${shard.host}:${shard.port}`;

    let node = this.nodeByAddress.get(address);
    if (!node) {
      node = {
        ...shard,
        address,
        readonly,
        client: undefined,
        connectPromise: undefined
      };

      if (eagerConnent) {
        promises.push(this.#createNodeClient(node));
      }

      this.nodeByAddress.set(address, node);
    }

    if (!addressesInUse.has(address)) {
      addressesInUse.add(address);
      (readonly ? this.replicas : this.masters).push(node);
    }

    return node;
  }

  #createClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>, readonly = node.readonly) {
    return this.#clientFactory(
      this.#clientOptionsDefaults({
        clientSideCache: this.clientSideCache,
        RESP: this.#options.RESP,
        socket: this.#getNodeAddress(node.address) ?? {
          host: node.host,
          port: node.port
        },
        readonly
      })
    ).on('error', err => console.error(err));
  }

  #createNodeClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>, readonly?: boolean) {
    const client = node.client = this.#createClient(node, readonly);
    return node.connectPromise = client.connect()
      .finally(() => node.connectPromise = undefined);
  }

  nodeClient(node: ShardNode<M, F, S, RESP, TYPE_MAPPING>) {
    return (
      node.connectPromise ?? // if the node is connecting
      node.client ?? // if the node is connected
      this.#createNodeClient(node) // if the not is disconnected
    );
  }

  #runningRediscoverPromise?: Promise<void>;

  async rediscover(startWith: RedisClientType<M, F, S, RESP>): Promise<void> {
    this.#runningRediscoverPromise ??= this.#rediscover(startWith)
      .finally(() => this.#runningRediscoverPromise = undefined);
    return this.#runningRediscoverPromise;
  }

  async #rediscover(startWith: RedisClientType<M, F, S, RESP>): Promise<void> {
    if (await this.#discover(startWith.options!)) return;

    return this.#discoverWithRootNodes();
  }

  /**
   * @deprecated Use `close` instead.
   */
  quit(): Promise<void> {
    return this.#destroy(client => client.quit());
  }

  /**
   * @deprecated Use `destroy` instead.
   */
  disconnect(): Promise<void> {
    return this.#destroy(client => client.disconnect());
  }

  close() {
    return this.#destroy(client => client.close());
  }

  destroy() {
    this.#isOpen = false;

    for (const client of this.#clients()) {
      client.destroy();
    }

    if (this.pubSubNode) {
      this.pubSubNode.client.destroy();
      this.pubSubNode = undefined;
    }

    this.#resetSlots();
    this.nodeByAddress.clear();
  }

  *#clients() {
    for (const master of this.masters) {
      if (master.client) {
        yield master.client;
      }

      if (master.pubSub) {
        yield master.pubSub.client;
      }
    }

    for (const replica of this.replicas) {
      if (replica.client) {
        yield replica.client;
      }
    }
  }

  async #destroy(fn: (client: RedisClientType<M, F, S, RESP>) => Promise<unknown>): Promise<void> {
    this.#isOpen = false;

    const promises = [];
    for (const client of this.#clients()) {
      promises.push(fn(client));
    }

    if (this.pubSubNode) {
      promises.push(fn(this.pubSubNode.client));
      this.pubSubNode = undefined;
    }

    this.#resetSlots();
    this.nodeByAddress.clear();

    await Promise.allSettled(promises);
  }

  getClient(
    firstKey: RedisArgument | undefined,
    isReadonly: boolean | undefined
  ) {
    if (!firstKey) {
      return this.nodeClient(this.getRandomNode());
    }

    const slotNumber = calculateSlot(firstKey);
    if (!isReadonly) {
      return this.nodeClient(this.slots[slotNumber].master);
    }

    return this.nodeClient(this.getSlotRandomNode(slotNumber));
  }

  *#iterateAllNodes() {
    let i = Math.floor(Math.random() * (this.masters.length + this.replicas.length));
    if (i < this.masters.length) {
      do {
        yield this.masters[i];
      } while (++i < this.masters.length);

      for (const replica of this.replicas) {
        yield replica;
      }
    } else {
      i -= this.masters.length;
      do {
        yield this.replicas[i];
      } while (++i < this.replicas.length);
    }

    while (true) {
      for (const master of this.masters) {
        yield master;
      }

      for (const replica of this.replicas) {
        yield replica;
      }
    }
  }

  _randomNodeIterator?: IterableIterator<ShardNode<M, F, S, RESP, TYPE_MAPPING>>;

  getRandomNode() {
    this._randomNodeIterator ??= this.#iterateAllNodes();
    return this._randomNodeIterator.next().value as ShardNode<M, F, S, RESP, TYPE_MAPPING>;
  }

  *#slotNodesIterator(slot: ShardWithReplicas<M, F, S, RESP, TYPE_MAPPING>) {
    let i = Math.floor(Math.random() * (1 + slot.replicas.length));
    if (i < slot.replicas.length) {
      do {
        yield slot.replicas[i];
      } while (++i < slot.replicas.length);
    }

    while (true) {
      yield slot.master;

      for (const replica of slot.replicas) {
        yield replica;
      }
    }
  }

  getSlotRandomNode(slotNumber: number) {
    const slot = this.slots[slotNumber];
    if (!slot.replicas?.length) {
      return slot.master;
    }

    slot.nodesIterator ??= this.#slotNodesIterator(slot as ShardWithReplicas<M, F, S, RESP, TYPE_MAPPING>);
    return slot.nodesIterator.next().value as ShardNode<M, F, S, RESP, TYPE_MAPPING>;
  }

  getMasterByAddress(address: string) {
    const master = this.nodeByAddress.get(address);
    if (!master) return;

    return this.nodeClient(master);
  }

  getPubSubClient() {
    if (!this.pubSubNode) return this.#initiatePubSubClient();

    return this.pubSubNode.connectPromise ?? this.pubSubNode.client;
  }

  async #initiatePubSubClient(toResubscribe?: PubSubToResubscribe) {
    const index = Math.floor(Math.random() * (this.masters.length + this.replicas.length)),
      node = index < this.masters.length ?
        this.masters[index] :
        this.replicas[index - this.masters.length],
        client = this.#createClient(node, true);
      
    this.pubSubNode = {
      address: node.address,
      client,
      connectPromise: client.connect()
        .then(async client => {
          if (toResubscribe) {
            await Promise.all([
              client.extendPubSubListeners(PUBSUB_TYPE.CHANNELS, toResubscribe[PUBSUB_TYPE.CHANNELS]),
              client.extendPubSubListeners(PUBSUB_TYPE.PATTERNS, toResubscribe[PUBSUB_TYPE.PATTERNS])
            ]);
          }

          this.pubSubNode!.connectPromise = undefined;
          return client;
        })
        .catch(err => {
          this.pubSubNode = undefined;
          throw err;
        })
    };

    return this.pubSubNode.connectPromise!;
  }

  async executeUnsubscribeCommand(
    unsubscribe: (client: RedisClientType<M, F, S, RESP>) => Promise<void>
  ): Promise<void> {
    const client = await this.getPubSubClient();
    await unsubscribe(client);

    if (!client.isPubSubActive) {
      client.destroy();
      this.pubSubNode = undefined;
    }
  }

  getShardedPubSubClient(channel: string) {
    const { master } = this.slots[calculateSlot(channel)];
    if (!master.pubSub) return this.#initiateShardedPubSubClient(master);
    return master.pubSub.connectPromise ?? master.pubSub.client;
  }

  async #initiateShardedPubSubClient(master: MasterNode<M, F, S, RESP, TYPE_MAPPING>) {
    const client = this.#createClient(master, true)
      .on('server-sunsubscribe', async (channel, listeners) => {
        try {
          await this.rediscover(client);
          const redirectTo = await this.getShardedPubSubClient(channel);
          await redirectTo.extendPubSubChannelListeners(
            PUBSUB_TYPE.SHARDED,
            channel,
            listeners
          );
        } catch (err) {
          this.#emit('sharded-shannel-moved-error', err, channel, listeners);
        }
      });

    master.pubSub = {
      client,
      connectPromise: client.connect()
        .then(client => {
          master.pubSub!.connectPromise = undefined;
          return client;
        })
        .catch(err => {
          master.pubSub = undefined;
          throw err;
        })
    };

    return master.pubSub.connectPromise!;
  }

  async executeShardedUnsubscribeCommand(
    channel: string,
    unsubscribe: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>) => Promise<void>
  ) {
    const { master } = this.slots[calculateSlot(channel)];
    if (!master.pubSub) return;

    const client = master.pubSub.connectPromise ?
      await master.pubSub.connectPromise :
      master.pubSub.client;

    await unsubscribe(client);

    if (!client.isPubSubActive) {
      client.destroy();
      master.pubSub = undefined;
    }
  }
}
