import { SinglyLinkedList, DoublyLinkedNode, DoublyLinkedList } from './linked-list';
import encodeCommand from '../RESP/encoder';
import { Decoder, PUSH_TYPE_MAPPING, RESP_TYPES } from '../RESP/decoder';
import { TypeMapping, ReplyUnion, RespVersions, CommandArguments } from '../RESP/types';
import { COMMANDS, ChannelListeners, PUBSUB_TYPE, PubSub, PubSubCommand, PubSubListener, PubSubType, PubSubTypeListeners } from './pub-sub';
import { AbortError, ErrorReply } from '../errors';
import { MonitorCallback } from '.';

export interface CommandOptions<T = TypeMapping> {
  chainId?: symbol;
  asap?: boolean;
  abortSignal?: AbortSignal;
  /**
   * Maps between RESP and JavaScript types
   */
  typeMapping?: T;
}

export interface CommandToWrite extends CommandWaitingForReply {
  args: CommandArguments;
  chainId: symbol | undefined;
  abort: {
    signal: AbortSignal;
    listener: () => unknown;
  } | undefined;
}

interface CommandWaitingForReply {
  resolve(reply?: unknown): void;
  reject(err: unknown): void;
  channelsCounter: number | undefined;
  typeMapping: TypeMapping | undefined;
}

export type OnShardedChannelMoved = (channel: string, listeners: ChannelListeners) => void;

const PONG = Buffer.from('pong'),
  RESET = Buffer.from('RESET');

const RESP2_PUSH_TYPE_MAPPING = {
  ...PUSH_TYPE_MAPPING,
  [RESP_TYPES.SIMPLE_STRING]: Buffer
};

export default class RedisCommandsQueue {
  readonly #respVersion;
  readonly #maxLength;
  readonly #toWrite = new DoublyLinkedList<CommandToWrite>();
  readonly #waitingForReply = new SinglyLinkedList<CommandWaitingForReply>();
  readonly #onShardedChannelMoved;
  #chainInExecution: symbol | undefined;
  readonly decoder;
  readonly #pubSub = new PubSub();
  readonly #pushHandlers: Map<string, (pushMsg: Array<any>) => unknown> = new Map();
  readonly #builtInSet: ReadonlySet<string>;

  get isPubSubActive() {
    return this.#pubSub.isActive;
  }

  constructor(
    respVersion: RespVersions,
    maxLength: number | null | undefined,
    onShardedChannelMoved: OnShardedChannelMoved
  ) {
    this.#respVersion = respVersion;
    this.#maxLength = maxLength;
    this.#onShardedChannelMoved = onShardedChannelMoved;

    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.CHANNELS].message.toString(), this.#pubSub.handleMessageReplyChannel.bind(this.#pubSub));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.CHANNELS].subscribe.toString(), this.#handleStatusReply.bind(this));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.CHANNELS].unsubscribe.toString(), this.#handleStatusReply.bind(this));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.PATTERNS].message.toString(), this.#pubSub.handleMessageReplyPattern.bind(this.#pubSub));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.PATTERNS].subscribe.toString(), this.#handleStatusReply.bind(this));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.PATTERNS].unsubscribe.toString(), this.#handleStatusReply.bind(this));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.SHARDED].message.toString(), this.#pubSub.handleMessageReplySharded.bind(this.#pubSub));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.SHARDED].subscribe.toString(), this.#handleStatusReply.bind(this));
    this.#pushHandlers.set(COMMANDS[PUBSUB_TYPE.SHARDED].unsubscribe.toString(), this.#handleShardedUnsubscribe.bind(this));
 
    const s = new Set<string>();
    this.#builtInSet = s;
    for (const str in this.#pushHandlers.keys) {
      s.add(str);
    }

    this.decoder = this.#initiateDecoder();
  }

  #onReply(reply: ReplyUnion) {
    this.#waitingForReply.shift()!.resolve(reply);
  }

  #onErrorReply(err: ErrorReply) {
    this.#waitingForReply.shift()!.reject(err);
  }

  #handleStatusReply(push: Array<any>) {
    const head = this.#waitingForReply.head!.value;
    if (
      (Number.isNaN(head.channelsCounter!) && push[2] === 0) ||
      --head.channelsCounter! === 0
    ) {
      this.#waitingForReply.shift()!.resolve();
    }
  }

  #handleShardedUnsubscribe(push: Array<any>) {
    if (!this.#waitingForReply.length) {
      const channel = push[1].toString();
      this.#onShardedChannelMoved(
        channel,
        this.#pubSub.removeShardedListeners(channel)
      );
    } else {
      this.#handleStatusReply(push);
    }
  }

  addPushHandler(messageType: string, handler: (pushMsg: Array<any>) => unknown) {
    if (this.#builtInSet.has(messageType)) {
      throw new Error("Cannot override built in push message handler");
    }

    this.#pushHandlers.set(messageType, handler);
  }

  removePushHandler(messageType: string) {
    if (this.#builtInSet.has(messageType)) {
      throw new Error("Cannot override built in push message handler");
    }

    this.#pushHandlers.delete(messageType);
  }

  #onPush(push: Array<any>) {
    const handler = this.#pushHandlers.get(push[0].toString());
    if (handler) {
      handler(push);
      return true;
    }

    return false;
  }

  #getTypeMapping() {
    return this.#waitingForReply.head!.value.typeMapping ?? {};
  }

  #initiateDecoder() {
    return new Decoder({
      onReply: reply => this.#onReply(reply),
      onErrorReply: err => this.#onErrorReply(err),
      onPush: push => {
        return this.#onPush(push);
      },
      getTypeMapping: () => this.#getTypeMapping()
    });
  }

  addCommand<T>(
    args: CommandArguments,
    options?: CommandOptions
  ): Promise<T> {
    if (this.#maxLength && this.#toWrite.length + this.#waitingForReply.length >= this.#maxLength) {
      return Promise.reject(new Error('The queue is full'));
    } else if (options?.abortSignal?.aborted) {
      return Promise.reject(new AbortError());
    }

    return new Promise((resolve, reject) => {
      let node: DoublyLinkedNode<CommandToWrite>;
      const value: CommandToWrite = {
        args,
        chainId: options?.chainId,
        abort: undefined,
        resolve,
        reject,
        channelsCounter: undefined,
        typeMapping: options?.typeMapping
      };

      const signal = options?.abortSignal;
      if (signal) {
        value.abort = {
          signal,
          listener: () => {
            this.#toWrite.remove(node);
            value.reject(new AbortError());
          }
        };
        signal.addEventListener('abort', value.abort.listener, { once: true });
      }

      node = this.#toWrite.add(value, options?.asap);
    });
  }

  #addPubSubCommand(command: PubSubCommand, asap = false, chainId?: symbol) {
    return new Promise<void>((resolve, reject) => {
      this.#toWrite.add({
        args: command.args,
        chainId,
        abort: undefined,
        resolve() {
          command.resolve();
          resolve();
        },
        reject(err) {
          command.reject?.();
          reject(err);
        },
        channelsCounter: command.channelsCounter,
        typeMapping: PUSH_TYPE_MAPPING
      }, asap);
    });
  }

  #setupPubSubHandler() {
    // RESP3 uses `onPush` to handle PubSub, so no need to modify `onReply`
    if (this.#respVersion !== 2) return;

    this.decoder.onReply = (reply => {
      if (Array.isArray(reply)) {
        if (this.#onPush(reply)) return;
        
        if (PONG.equals(reply[0] as Buffer)) {
          const { resolve, typeMapping } = this.#waitingForReply.shift()!,
            buffer = ((reply[1] as Buffer).length === 0 ? reply[0] : reply[1]) as Buffer;
          resolve(typeMapping?.[RESP_TYPES.SIMPLE_STRING] === Buffer ? buffer : buffer.toString());
          return;
        }
      }

      return this.#onReply(reply);
    }) as Decoder['onReply'];
    this.decoder.getTypeMapping = () => RESP2_PUSH_TYPE_MAPPING;
  }

  subscribe<T extends boolean>(
    type: PubSubType,
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    returnBuffers?: T
  ) {
    const command = this.#pubSub.subscribe(type, channels, listener, returnBuffers);
    if (!command) return;

    this.#setupPubSubHandler();
    return this.#addPubSubCommand(command);
  }

  #resetDecoderCallbacks() {
    this.decoder.onReply = (reply => this.#onReply(reply)) as Decoder['onReply'];
    this.decoder.getTypeMapping = () => this.#getTypeMapping();
  }

  unsubscribe<T extends boolean>(
    type: PubSubType,
    channels?: string | Array<string>,
    listener?: PubSubListener<T>,
    returnBuffers?: T
  ) {
    const command = this.#pubSub.unsubscribe(type, channels, listener, returnBuffers);
    if (!command) return;

    if (command && this.#respVersion === 2) {
      // RESP2 modifies `onReply` to handle PubSub (see #setupPubSubHandler)
      const { resolve } = command;
      command.resolve = () => {
        if (!this.#pubSub.isActive) {
          this.#resetDecoderCallbacks();
        }
        
        resolve();
      };
    }

    return this.#addPubSubCommand(command);
  }

  resubscribe(chainId?: symbol) {
    const commands = this.#pubSub.resubscribe();
    if (!commands.length) return;

    this.#setupPubSubHandler();
    return Promise.all(
      commands.map(command => this.#addPubSubCommand(command, true, chainId))
    );
  }

  extendPubSubChannelListeners(
    type: PubSubType,
    channel: string,
    listeners: ChannelListeners
  ) {
    const command = this.#pubSub.extendChannelListeners(type, channel, listeners);
    if (!command) return;

    this.#setupPubSubHandler();
    return this.#addPubSubCommand(command);
  }

  extendPubSubListeners(type: PubSubType, listeners: PubSubTypeListeners) {
    const command = this.#pubSub.extendTypeListeners(type, listeners);
    if (!command) return;

    this.#setupPubSubHandler();
    return this.#addPubSubCommand(command);
  }

  getPubSubListeners(type: PubSubType) {
    return this.#pubSub.listeners[type];
  }

  monitor(callback: MonitorCallback, options?: CommandOptions) {
    return new Promise<void>((resolve, reject) => {
      const typeMapping = options?.typeMapping ?? {};
      this.#toWrite.add({
        args: ['MONITOR'],
        chainId: options?.chainId,
        abort: undefined,
        // using `resolve` instead of using `.then`/`await` to make sure it'll be called before processing the next reply
        resolve: () => {
          // after running `MONITOR` only `MONITOR` and `RESET` replies are expected
          // any other command should cause an error

          // if `RESET` already overrides `onReply`, set monitor as it's fallback
          if (this.#resetFallbackOnReply) {
            this.#resetFallbackOnReply = callback;
          } else {
            this.decoder.onReply = callback;
          }

          this.decoder.getTypeMapping = () => typeMapping;
          resolve();
        },
        reject,
        channelsCounter: undefined,
        typeMapping
      }, options?.asap);  
    });
  }

  resetDecoder() {
    this.#resetDecoderCallbacks();
    this.decoder.reset();
  }

  #resetFallbackOnReply?: Decoder['onReply'];

  async reset<T extends TypeMapping>(chainId: symbol, typeMapping?: T) {
    return new Promise((resolve, reject) => {
      // overriding onReply to handle `RESET` while in `MONITOR` or PubSub mode
      this.#resetFallbackOnReply = this.decoder.onReply;
      this.decoder.onReply = (reply => {
        if (
          (typeof reply === 'string' && reply === 'RESET') ||
          (reply instanceof Buffer && RESET.equals(reply))
        ) {
          this.#resetDecoderCallbacks();
          this.#resetFallbackOnReply = undefined;
          this.#pubSub.reset();
          
          this.#waitingForReply.shift()!.resolve(reply);
          return;
        }
        
        this.#resetFallbackOnReply!(reply);
      }) as Decoder['onReply'];

      this.#toWrite.push({
        args: ['RESET'],
        chainId,
        abort: undefined,
        resolve,
        reject,
        channelsCounter: undefined,
        typeMapping
      });
    });
  }

  isWaitingToWrite() {
    return this.#toWrite.length > 0;
  }

  *commandsToWrite() {
    let toSend = this.#toWrite.shift();
    while (toSend) {
      let encoded: CommandArguments;
      try {
        encoded = encodeCommand(toSend.args);
      } catch (err) {
        toSend.reject(err);
        toSend = this.#toWrite.shift();
        continue;
      }

      // TODO reuse `toSend` or create new object? 
      (toSend as any).args = undefined;
      if (toSend.abort) {
        RedisCommandsQueue.#removeAbortListener(toSend);
        toSend.abort = undefined;
      }
      this.#chainInExecution = toSend.chainId;
      toSend.chainId = undefined;
      this.#waitingForReply.push(toSend);
      
      yield encoded;
      toSend = this.#toWrite.shift();
    }
  }

  #flushWaitingForReply(err: Error): void {
    for (const node of this.#waitingForReply) {
      node.reject(err);
    }
    this.#waitingForReply.reset();
  }

  static #removeAbortListener(command: CommandToWrite) {
    command.abort!.signal.removeEventListener('abort', command.abort!.listener);
  }

  static #flushToWrite(toBeSent: CommandToWrite, err: Error) {
    if (toBeSent.abort) {
      RedisCommandsQueue.#removeAbortListener(toBeSent);
    }
    
    toBeSent.reject(err);
  }

  flushWaitingForReply(err: Error): void {
    this.resetDecoder();
    this.#pubSub.reset();

    this.#flushWaitingForReply(err);

    if (!this.#chainInExecution) return;

    while (this.#toWrite.head?.value.chainId === this.#chainInExecution) {
      RedisCommandsQueue.#flushToWrite(
        this.#toWrite.shift()!,
        err
      );
    }

    this.#chainInExecution = undefined;
  }

  flushAll(err: Error): void {
    this.resetDecoder();
    this.#pubSub.reset();
    this.#flushWaitingForReply(err);
    for (const node of this.#toWrite) {
      RedisCommandsQueue.#flushToWrite(node, err);
    }
    this.#toWrite.reset();
  }

  isEmpty() {
    return (
      this.#toWrite.length === 0 &&
      this.#waitingForReply.length === 0
    );
  }
}
