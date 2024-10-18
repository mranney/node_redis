import COMMANDS from '../commands';
import { Command, RedisArgument, RedisFunction, RedisFunctions, RedisModules, RedisScript, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
import RedisClient, { RedisClientType, RedisClientOptions, RedisClientExtensions } from '.';
import { EventEmitter } from 'node:events';
import { DoublyLinkedNode, DoublyLinkedList, SinglyLinkedList } from './linked-list';
import { TimeoutError } from '../errors';
import { attachConfig, functionArgumentsPrefix, getTransformReply, scriptArgumentsPrefix } from '../commander';
import { CommandOptions } from './commands-queue';
import RedisClientMultiCommand, { RedisClientMultiCommandType } from './multi-command';
import { BasicCommandParser } from './parser';

export interface RedisPoolOptions {
  /**
   * The minimum number of clients to keep in the pool (>= 1).
   */
  minimum: number;
  /**
   * The maximum number of clients to keep in the pool (>= {@link RedisPoolOptions.minimum} >= 1).
   */
  maximum: number;
  /**
   * The maximum time a task can wait for a client to become available (>= 0).
   */
  acquireTimeout: number;
  /**
   * TODO
   */
  cleanupDelay: number;
}

export type PoolTask<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping,
  T = unknown
> = (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>) => T;

export type RedisClientPoolType<
  M extends RedisModules = {},
  F extends RedisFunctions = {},
  S extends RedisScripts = {},
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = {}
> = (
  RedisClientPool<M, F, S, RESP, TYPE_MAPPING> &
  RedisClientExtensions<M, F, S, RESP, TYPE_MAPPING>
);

type ProxyPool = RedisClientPoolType<any, any, any, any, any>;

type NamespaceProxyPool = { _self: ProxyPool };

export class RedisClientPool<
  M extends RedisModules = {},
  F extends RedisFunctions = {},
  S extends RedisScripts = {},
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = {}
> extends EventEmitter {
  static #createCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return async function (this: ProxyPool, ...args: Array<unknown>) {
      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);

        return this.execute(client => client.executeCommand(parser, this._commandOptions, transformReply))
      } else {
        const redisArgs = command.transformArguments(...args),
          reply = await this.sendCommand(redisArgs, this._commandOptions);
        return transformReply ?
          transformReply(reply, redisArgs.preserve) :
          reply;
      }
    };
  }

  static #createModuleCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return async function (this: NamespaceProxyPool, ...args: Array<unknown>) {
      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);

        return this._self.execute(client => client.executeCommand(parser, this._self._commandOptions, transformReply))
      } else {
        const redisArgs = command.transformArguments(...args),
          reply = await this._self.sendCommand(redisArgs, this._self._commandOptions);
        return transformReply ?
          transformReply(reply, redisArgs.preserve) :
          reply;
      }
    };
  }

  static #createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions) {
    const prefix = functionArgumentsPrefix(name, fn);
    const transformReply = getTransformReply(fn, resp);

    return async function (this: NamespaceProxyPool, ...args: Array<unknown>) {
      if (fn.parseCommand) {
        const parser = new BasicCommandParser(resp);
        parser.pushVariadic(prefix);
        fn.parseCommand(parser, ...args);

        return this._self.execute(client => client.executeCommand(parser, this._self._commandOptions, transformReply))
      } else {
        const fnArgs = fn.transformArguments(...args),
          reply = await this._self.sendCommand(
            prefix.concat(fnArgs),
            this._self._commandOptions
          );
        return transformReply ?
          transformReply(reply, fnArgs.preserve) :
          reply;
      }
    };
  }

  static #createScriptCommand(script: RedisScript, resp: RespVersions) {
    const prefix = scriptArgumentsPrefix(script);
    const transformReply = getTransformReply(script, resp);

    return async function (this: ProxyPool, ...args: Array<unknown>) {
      if (script.parseCommand) {
        const parser = new BasicCommandParser(resp);
        parser.pushVariadic(prefix);
        script.parseCommand(parser, ...args);

        return this.execute(client => client.executeCommand(parser, this._commandOptions, transformReply))
      } else {
        const scriptArgs = script.transformArguments(...args),
          redisArgs = prefix.concat(scriptArgs),
          reply = await this.executeScript(script, redisArgs, this._commandOptions);
        return transformReply ?
          transformReply(reply, scriptArgs.preserve) :
          reply;
      }
    };
  }

  static create<
    M extends RedisModules,
    F extends RedisFunctions,
    S extends RedisScripts,
    RESP extends RespVersions,
    TYPE_MAPPING extends TypeMapping = {}
  >(
    clientOptions?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>,
    options?: Partial<RedisPoolOptions>
  ) {
    const Pool = attachConfig({
      BaseClass: RedisClientPool,
      commands: COMMANDS,
      createCommand: RedisClientPool.#createCommand,
      createModuleCommand: RedisClientPool.#createModuleCommand,
      createFunctionCommand: RedisClientPool.#createFunctionCommand,
      createScriptCommand: RedisClientPool.#createScriptCommand,
      config: clientOptions
    });

    Pool.prototype.Multi = RedisClientMultiCommand.extend(clientOptions);

    // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
    return Object.create(
      new Pool(
        RedisClient.factory(clientOptions).bind(undefined, clientOptions),
        options
      )
    ) as RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
  }

  // TODO: defaults
  static #DEFAULTS = {
    minimum: 1,
    maximum: 100,
    acquireTimeout: 3000,
    cleanupDelay: 3000
  } satisfies RedisPoolOptions;

  readonly #clientFactory: () => RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
  readonly #options: RedisPoolOptions;

  readonly #idleClients = new SinglyLinkedList<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>();

  /**
   * The number of idle clients.
   */
  get idleClients() {
    return this._self.#idleClients.length;
  }

  readonly #clientsInUse = new DoublyLinkedList<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>();

  /**
   * The number of clients in use.
   */
  get clientsInUse() {
    return this._self.#clientsInUse.length;
  }

  /**
   * The total number of clients in the pool (including connecting, idle, and in use).
   */
  get totalClients() {
    return this._self.#idleClients.length + this._self.#clientsInUse.length;
  }

  readonly #tasksQueue = new SinglyLinkedList<{
    timeout: NodeJS.Timeout | undefined;
    resolve: (value: unknown) => unknown;
    reject: (reason?: unknown) => unknown;
    fn: PoolTask<M, F, S, RESP, TYPE_MAPPING>;
  }>();

  /**
   * The number of tasks waiting for a client to become available.
   */
  get tasksQueueLength() {
    return this._self.#tasksQueue.length;
  }

  #isOpen = false;

  /**
   * Whether the pool is open (either connecting or connected).
   */
  get isOpen() {
    return this._self.#isOpen;
  }

  #isClosing = false;

  /**
   * Whether the pool is closing (*not* closed).
   */
  get isClosing() {
    return this._self.#isClosing;
  }


  /**
   * You are probably looking for {@link RedisClient.createPool `RedisClient.createPool`},
   * {@link RedisClientPool.fromClient `RedisClientPool.fromClient`},
   * or {@link RedisClientPool.fromOptions `RedisClientPool.fromOptions`}...
   */
  constructor(
    clientFactory: () => RedisClientType<M, F, S, RESP, TYPE_MAPPING>,
    options?: Partial<RedisPoolOptions>
  ) {
    super();

    this.#clientFactory = clientFactory;
    this.#options = {
      ...RedisClientPool.#DEFAULTS,
      ...options
    };
  }

  private _self = this;
  private _commandOptions?: CommandOptions<TYPE_MAPPING>;

  withCommandOptions<
    OPTIONS extends CommandOptions<TYPE_MAPPING>,
    TYPE_MAPPING extends TypeMapping
  >(options: OPTIONS) {
    const proxy = Object.create(this._self);
    proxy._commandOptions = options;
    return proxy as RedisClientPoolType<
      M,
      F,
      S,
      RESP,
      TYPE_MAPPING extends TypeMapping ? TYPE_MAPPING : {}
    >;
  }

  #commandOptionsProxy<
    K extends keyof CommandOptions,
    V extends CommandOptions[K]
  >(
    key: K,
    value: V
  ) {
    const proxy = Object.create(this._self);
    proxy._commandOptions = Object.create(this._commandOptions ?? null);
    proxy._commandOptions[key] = value;
    return proxy as RedisClientPoolType<
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
    return this._self.#commandOptionsProxy('typeMapping', typeMapping);
  }

  /**
   * Override the `abortSignal` command option
   */
  withAbortSignal(abortSignal: AbortSignal) {
    return this._self.#commandOptionsProxy('abortSignal', abortSignal);
  }

  /**
   * Override the `asap` command option to `true`
   * TODO: remove?
   */
  asap() {
    return this._self.#commandOptionsProxy('asap', true);
  }

  async connect() {
    if (this._self.#isOpen) return; // TODO: throw error?

    this._self.#isOpen = true;

    const promises = [];
    while (promises.length < this._self.#options.minimum) {
      promises.push(this._self.#create());
    }

    try {
      await Promise.all(promises);
      return this as unknown as RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>;
    } catch (err) {
      this.destroy();
      throw err;
    }
  }

  async #create() {
    const node = this._self.#clientsInUse.push(
      this._self.#clientFactory()
        .on('error', (err: Error) => this.emit('error', err))
    );

    try {
      await node.value.connect();
    } catch (err) {
      this._self.#clientsInUse.remove(node);
      throw err;
    }

    this._self.#returnClient(node);
  }
  
  execute<T>(fn: PoolTask<M, F, S, RESP, TYPE_MAPPING, T>) {
    return new Promise<Awaited<T>>((resolve, reject) => {
      const client = this._self.#idleClients.shift(),
        { tail } = this._self.#tasksQueue;
      if (!client) {
        let timeout;
        if (this._self.#options.acquireTimeout > 0) {
          timeout = setTimeout(
            () => {
              this._self.#tasksQueue.remove(task, tail);
              reject(new TimeoutError('Timeout waiting for a client')); // TODO: message
            },
            this._self.#options.acquireTimeout
          );
        }

        const task = this._self.#tasksQueue.push({
          timeout,
          // @ts-ignore
          resolve,
          reject,
          fn
        });

        if (this.totalClients < this._self.#options.maximum) {
          this._self.#create();
        }

        return;
      }

      const node = this._self.#clientsInUse.push(client);
      // @ts-ignore
      this._self.#executeTask(node, resolve, reject, fn);
    });
  }

  #executeTask(
    node: DoublyLinkedNode<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>,
    resolve: <T>(value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
    fn: PoolTask<M, F, S, RESP, TYPE_MAPPING>
  ) {
    const result = fn(node.value);
    if (result instanceof Promise) {
      result.then(resolve, reject);
      result.finally(() => this.#returnClient(node))
    } else {
      resolve(result);
      this.#returnClient(node);
    }
  }

  #returnClient(node: DoublyLinkedNode<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>) {
    const task = this.#tasksQueue.shift();
    if (task) {
      clearTimeout(task.timeout);
      this.#executeTask(node, task.resolve, task.reject, task.fn);
      return;
    }

    this.#clientsInUse.remove(node);
    this.#idleClients.push(node.value);

    this.#scheduleCleanup();
  }

  cleanupTimeout?: NodeJS.Timeout;

  #scheduleCleanup() {
    if (this.totalClients <= this.#options.minimum) return;

    clearTimeout(this.cleanupTimeout);
    this.cleanupTimeout = setTimeout(() => this.#cleanup(), this.#options.cleanupDelay);
  }

  #cleanup() {
    const toDestroy = Math.min(this.#idleClients.length, this.totalClients - this.#options.minimum);
    for (let i = 0; i < toDestroy; i++) {
      // TODO: shift vs pop
      this.#idleClients.shift()!.destroy();
    }
  }

  sendCommand(
    args: Array<RedisArgument>,
    options?: CommandOptions
  ) {
    return this.execute(client => client.sendCommand(args, options));
  }

  executeScript(
    script: RedisScript,
    args: Array<RedisArgument>,
    options?: CommandOptions
  ) {
    return this.execute(client => client.executeScript(script, args, options));
  }

  MULTI() {
    type Multi = new (...args: ConstructorParameters<typeof RedisClientMultiCommand>) => RedisClientMultiCommandType<[], M, F, S, RESP, TYPE_MAPPING>;
    return new ((this as any).Multi as Multi)(
      (commands, selectedDB) => this.execute(client => client._executeMulti(commands, selectedDB)),
      commands => this.execute(client => client._executePipeline(commands))
    );
  }

  multi = this.MULTI;

  async close() {
    if (this._self.#isClosing) return; // TODO: throw err?
    if (!this._self.#isOpen) return; // TODO: throw err?

    this._self.#isClosing = true;
    
    try {
      const promises = [];

      for (const client of this._self.#idleClients) {
        promises.push(client.close());
      }
  
      for (const client of this._self.#clientsInUse) {
        promises.push(client.close());
      }
  
      await Promise.all(promises);
  
      this._self.#idleClients.reset();
      this._self.#clientsInUse.reset();
    } catch (err) {
      
    } finally {
      this._self.#isClosing = false;
    } 
  }

  destroy() {
    for (const client of this._self.#idleClients) {
      client.destroy();
    }
    this._self.#idleClients.reset();

    for (const client of this._self.#clientsInUse) {
      client.destroy();
    }
    this._self.#clientsInUse.reset();

    this._self.#isOpen = false;
  }
}
