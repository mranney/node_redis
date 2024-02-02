import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { ConnectionTimeoutError, ClientClosedError, SocketClosedUnexpectedlyError, ReconnectStrategyError } from '../errors';
import { setTimeout } from 'node:timers/promises';
import { RedisArgument } from '../RESP/types';

export interface RedisSocketCommonOptions {
  /**
   * Connection Timeout (in milliseconds)
   */
  connectTimeout?: number;
  /**
   * Toggle [`Nagle's algorithm`](https://nodejs.org/api/net.html#net_socket_setnodelay_nodelay)
   */
  noDelay?: boolean;
  /**
   * Toggle [`keep-alive`](https://nodejs.org/api/net.html#net_socket_setkeepalive_enable_initialdelay)
   */
  keepAlive?: number | false;
  /**
   * When the socket closes unexpectedly (without calling `.close()`/`.destroy()`), the client uses `reconnectStrategy` to decide what to do. The following values are supported:
   * 1. `false` -> do not reconnect, close the client and flush the command queue.
   * 2. `number` -> wait for `X` milliseconds before reconnecting.
   * 3. `(retries: number, cause: Error) => false | number | Error` -> `number` is the same as configuring a `number` directly, `Error` is the same as `false`, but with a custom error.
   * Defaults to `retries => Math.min(retries * 50, 500)`
   */
  reconnectStrategy?: false | number | ((retries: number, cause: Error) => false | Error | number);
}

type RedisNetSocketOptions = Partial<net.SocketConnectOpts> & {
  tls?: false;
};

export interface RedisTlsSocketOptions extends tls.ConnectionOptions {
  tls: true;
}

export type RedisSocketOptions = RedisSocketCommonOptions & (RedisNetSocketOptions | RedisTlsSocketOptions);

interface CreateSocketReturn<T> {
  connectEvent: string;
  socket: T;
}

export type RedisSocketInitiator = () => void | Promise<unknown>;

export default class RedisSocket extends EventEmitter {
  static #initiateOptions(options?: RedisSocketOptions): RedisSocketOptions {
    options ??= {};
    if (!(options as net.IpcSocketConnectOpts).path) {
      (options as net.TcpSocketConnectOpts).port ??= 6379;
      (options as net.TcpSocketConnectOpts).host ??= 'localhost';
    }

    options.connectTimeout ??= 5000;
    options.keepAlive ??= 5000;
    options.noDelay ??= true;

    return options;
  }

  static #isTlsSocket(options: RedisSocketOptions): options is RedisTlsSocketOptions {
    return (options as RedisTlsSocketOptions).tls === true;
  }

  readonly #initiator: RedisSocketInitiator;

  readonly #options: RedisSocketOptions;

  #socket?: net.Socket | tls.TLSSocket;

  #isOpen = false;

  get isOpen(): boolean {
    return this.#isOpen;
  }

  #isReady = false;

  get isReady(): boolean {
    return this.#isReady;
  }

  #isSocketUnrefed = false;

  #socketEpoch = 0;

  get socketEpoch() {
    return this.#socketEpoch;
  }

  constructor(initiator: RedisSocketInitiator, options?: RedisSocketOptions) {
    super();

    this.#initiator = initiator;
    this.#options = RedisSocket.#initiateOptions(options);
  }

  #reconnectStrategy(retries: number, cause: Error) {
    if (this.#options.reconnectStrategy === false) {
      return false;
    } else if (typeof this.#options.reconnectStrategy === 'number') {
      return this.#options.reconnectStrategy;
    } else if (this.#options.reconnectStrategy) {
      try {
        const retryIn = this.#options.reconnectStrategy(retries, cause);
        if (retryIn !== false && !(retryIn instanceof Error) && typeof retryIn !== 'number') {
          throw new TypeError(`Reconnect strategy should return \`false | Error | number\`, got ${retryIn} instead`);
        }

        return retryIn;
      } catch (err) {
        this.emit('error', err);
      }
    }

    return Math.min(retries * 50, 500);
  }

  #shouldReconnect(retries: number, cause: Error) {
    const retryIn = this.#reconnectStrategy(retries, cause);
    if (retryIn === false) {
      this.#isOpen = false;
      this.emit('error', cause);
      return cause;
    } else if (retryIn instanceof Error) {
      this.#isOpen = false;
      this.emit('error', cause);
      return new ReconnectStrategyError(retryIn, cause);
    }

    return retryIn;
  }

  async connect(): Promise<void> {
    if (this.#isOpen) {
      throw new Error('Socket already opened');
    }

    this.#isOpen = true;
    return this.#connect();
  }

  async #connect(): Promise<void> {
    let retries = 0;
    do {
      try {
        this.#socket = await this.#createSocket();
        this.emit('connect');

        try {
          await this.#initiator();
        } catch (err) {
          this.#socket.destroy();
          this.#socket = undefined;
          throw err;
        }
        this.#isReady = true;
        this.#socketEpoch++;
        this.emit('ready');
      } catch (err) {
        const retryIn = this.#shouldReconnect(retries++, err as Error);
        if (typeof retryIn !== 'number') {
          throw retryIn;
        }

        this.emit('error', err);
        await setTimeout(retryIn);
        this.emit('reconnecting');
      }
    } while (this.#isOpen && !this.#isReady);
  }

  #createSocket(): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const { connectEvent, socket } = RedisSocket.#isTlsSocket(this.#options) ?
        this.#createTlsSocket() :
        this.#createNetSocket();

      if (this.#options.connectTimeout) {
        socket.setTimeout(this.#options.connectTimeout, () => socket.destroy(new ConnectionTimeoutError()));
      }

      if (this.#isSocketUnrefed) {
        socket.unref();
      }

      socket
        .setNoDelay(this.#options.noDelay)
        .once('error', reject)
        .once(connectEvent, () => {
          socket
            .setTimeout(0)
            // https://github.com/nodejs/node/issues/31663
            .setKeepAlive(this.#options.keepAlive !== false, this.#options.keepAlive || 0)
            .off('error', reject)
            .once('error', (err: Error) => this.#onSocketError(err))
            .once('close', hadError => {
              if (!hadError && this.#isOpen && this.#socket === socket) {
                this.#onSocketError(new SocketClosedUnexpectedlyError());
              }
            })
            .on('drain', () => this.emit('drain'))
            .on('data', data => this.emit('data', data));

          resolve(socket);
        });
    });
  }

  #createNetSocket(): CreateSocketReturn<net.Socket> {
    return {
      connectEvent: 'connect',
      socket: net.connect(this.#options as net.NetConnectOpts) // TODO
    };
  }

  #createTlsSocket(): CreateSocketReturn<tls.TLSSocket> {
    return {
      connectEvent: 'secureConnect',
      socket: tls.connect(this.#options as tls.ConnectionOptions) // TODO
    };
  }

  #onSocketError(err: Error): void {
    const wasReady = this.#isReady;
    this.#isReady = false;
    this.emit('error', err);

    if (!wasReady || !this.#isOpen || typeof this.#shouldReconnect(0, err) !== 'number') return;

    this.emit('reconnecting');
    this.#connect().catch(() => {
      // the error was already emitted, silently ignore it
    });
  }

  write(iterator: IterableIterator<Array<RedisArgument>>): void {
    if (!this.#socket) return;
    
    this.#socket.cork();
    for (const args of iterator) {
      for (const toWrite of args) {
        this.#socket.write(toWrite);
      }

      if (this.#socket.writableNeedDrain) break;
    }
    this.#socket.uncork();
  }

  async quit<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.#isOpen) {
      throw new ClientClosedError();
    }

    this.#isOpen = false;
    const reply = await fn();
    this.destroySocket();
    return reply;
  }

  close() {
    if (!this.#isOpen) {
      throw new ClientClosedError();
    }

    this.#isOpen = false;
  }

  destroy() {
    if (!this.#isOpen) {
      throw new ClientClosedError();
    }

    this.#isOpen = false;
    this.destroySocket();
  }

  destroySocket() {
    this.#isReady = false;

    if (this.#socket) {
      this.#socket.destroy();
      this.#socket = undefined;
    }

    this.emit('end');
  }

  ref(): void {
    this.#isSocketUnrefed = false;
    this.#socket?.ref();
  }

  unref(): void {
    this.#isSocketUnrefed = true;
    this.#socket?.unref();
  }
}
