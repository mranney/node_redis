import { RedisArgument } from '../RESP/types';
import { CommandToWrite } from './commands-queue';

export const PUBSUB_TYPE = {
  CHANNELS: 'CHANNELS',
  PATTERNS: 'PATTERNS',
  SHARDED: 'SHARDED'
} as const;

export type PUBSUB_TYPE = typeof PUBSUB_TYPE;

export type PubSubType = PUBSUB_TYPE[keyof PUBSUB_TYPE];

export const COMMANDS = {
  [PUBSUB_TYPE.CHANNELS]: {
    subscribe: Buffer.from('subscribe'),
    unsubscribe: Buffer.from('unsubscribe'),
    message: Buffer.from('message')
  },
  [PUBSUB_TYPE.PATTERNS]: {
    subscribe: Buffer.from('psubscribe'),
    unsubscribe: Buffer.from('punsubscribe'),
    message: Buffer.from('pmessage')
  },
  [PUBSUB_TYPE.SHARDED]: {
    subscribe: Buffer.from('ssubscribe'),
    unsubscribe: Buffer.from('sunsubscribe'),
    message: Buffer.from('smessage')
  }
};

export type PubSubListener<
  RETURN_BUFFERS extends boolean = false
> = <T extends RETURN_BUFFERS extends true ? Buffer : string>(message: T, channel: T) => unknown;

export interface ChannelListeners {
  unsubscribing: boolean;
  buffers: Set<PubSubListener<true>>;
  strings: Set<PubSubListener<false>>;
}

export type PubSubTypeListeners = Map<string, ChannelListeners>;

export type PubSubListeners = Record<PubSubType, PubSubTypeListeners>;

export type PubSubCommand = (
  Required<Pick<CommandToWrite, 'args' | 'channelsCounter' | 'resolve'>> & {
    reject: undefined | (() => unknown);
  }
);

export class PubSub {
  static isStatusReply(reply: Array<Buffer>): boolean {
    return (
      COMMANDS[PUBSUB_TYPE.CHANNELS].subscribe.equals(reply[0]) ||
      COMMANDS[PUBSUB_TYPE.CHANNELS].unsubscribe.equals(reply[0]) ||
      COMMANDS[PUBSUB_TYPE.PATTERNS].subscribe.equals(reply[0]) ||
      COMMANDS[PUBSUB_TYPE.PATTERNS].unsubscribe.equals(reply[0]) ||
      COMMANDS[PUBSUB_TYPE.SHARDED].subscribe.equals(reply[0])
    );
  }

  static isShardedUnsubscribe(reply: Array<Buffer>): boolean {
    return COMMANDS[PUBSUB_TYPE.SHARDED].unsubscribe.equals(reply[0]);
  }

  static #channelsArray(channels: string | Array<string>) {
    return (Array.isArray(channels) ? channels : [channels]);
  }

  static #listenersSet<T extends boolean>(
    listeners: ChannelListeners,
    returnBuffers?: T
  ) {
    return (returnBuffers ? listeners.buffers : listeners.strings);
  }

  #subscribing = 0;

  #isActive = false;

  get isActive() {
    return this.#isActive;
  }

  readonly listeners: PubSubListeners = {
    [PUBSUB_TYPE.CHANNELS]: new Map(),
    [PUBSUB_TYPE.PATTERNS]: new Map(),
    [PUBSUB_TYPE.SHARDED]: new Map()
  };

  subscribe<T extends boolean>(
    type: PubSubType,
    channels: string | Array<string>,
    listener: PubSubListener<T>,
    returnBuffers?: T
  ) {
    const args: Array<RedisArgument> = [COMMANDS[type].subscribe],
      channelsArray = PubSub.#channelsArray(channels);
    for (const channel of channelsArray) {
      let channelListeners = this.listeners[type].get(channel);
      if (!channelListeners || channelListeners.unsubscribing) {
        args.push(channel);
      }
    }

    if (args.length === 1) {
      // all channels are already subscribed, add listeners without issuing a command
      for (const channel of channelsArray) {
        PubSub.#listenersSet(
          this.listeners[type].get(channel)!,
          returnBuffers
        ).add(listener);
      }
      return;
    }

    this.#isActive = true;
    this.#subscribing++;
    return {
      args,
      channelsCounter: args.length - 1,
      resolve: () => {
        this.#subscribing--;
        for (const channel of channelsArray) {
          let listeners = this.listeners[type].get(channel);
          if (!listeners) {
            listeners = {
              unsubscribing: false,
              buffers: new Set(),
              strings: new Set()
            };
            this.listeners[type].set(channel, listeners);
          }

          PubSub.#listenersSet(listeners, returnBuffers).add(listener);
        }
      },
      reject: () => {
        this.#subscribing--;
        this.#updateIsActive();
      }
    } satisfies PubSubCommand;
  }

  extendChannelListeners(
    type: PubSubType,
    channel: string,
    listeners: ChannelListeners
  ) {
    if (!this.#extendChannelListeners(type, channel, listeners)) return;

    this.#isActive = true;
    this.#subscribing++;
    return {
      args: [
        COMMANDS[type].subscribe,
        channel
      ],
      channelsCounter: 1,
      resolve: () => this.#subscribing--,
      reject: () => {
        this.#subscribing--;
        this.#updateIsActive();
      }
    } satisfies PubSubCommand;
  }

  #extendChannelListeners(
    type: PubSubType,
    channel: string,
    listeners: ChannelListeners
  ) {
    const existingListeners = this.listeners[type].get(channel);
    if (!existingListeners) {
      this.listeners[type].set(channel, listeners);
      return true;
    }

    for (const listener of listeners.buffers) {
      existingListeners.buffers.add(listener);
    }

    for (const listener of listeners.strings) {
      existingListeners.strings.add(listener);
    }

    return false;
  }

  extendTypeListeners(type: PubSubType, listeners: PubSubTypeListeners) {
    const args: Array<RedisArgument> = [COMMANDS[type].subscribe];
    for (const [channel, channelListeners] of listeners) {
      if (this.#extendChannelListeners(type, channel, channelListeners)) {
        args.push(channel);
      }
    }

    if (args.length === 1) return;

    this.#isActive = true;
    this.#subscribing++;
    return {
      args,
      channelsCounter: args.length - 1,
      resolve: () => this.#subscribing--,
      reject: () => {
        this.#subscribing--;
        this.#updateIsActive();
      }
    } satisfies PubSubCommand;
  }

  unsubscribe<T extends boolean>(
    type: PubSubType,
    channels?: string | Array<string>,
    listener?: PubSubListener<T>,
    returnBuffers?: T
  ) {
    const listeners = this.listeners[type];
    if (!channels) {
      return this.#unsubscribeCommand(
        [COMMANDS[type].unsubscribe],
        // cannot use `this.#subscribed` because there might be some `SUBSCRIBE` commands in the queue
        // cannot use `this.#subscribed + this.#subscribing` because some `SUBSCRIBE` commands might fail
        NaN,
        () => listeners.clear()
      );
    }

    const channelsArray = PubSub.#channelsArray(channels);
    if (!listener) {
      return this.#unsubscribeCommand(
        [COMMANDS[type].unsubscribe, ...channelsArray],
        channelsArray.length,
        () => {
          for (const channel of channelsArray) {
            listeners.delete(channel);
          }
        }
      );
    }

    const args: Array<RedisArgument> = [COMMANDS[type].unsubscribe];
    for (const channel of channelsArray) {
      const sets = listeners.get(channel);
      if (sets) {
        let current,
          other;
        if (returnBuffers) {
          current = sets.buffers;
          other = sets.strings;
        } else {
          current = sets.strings;
          other = sets.buffers;
        }

        const currentSize = current.has(listener) ? current.size - 1 : current.size;
        if (currentSize !== 0 || other.size !== 0) continue;
        sets.unsubscribing = true;
      }

      args.push(channel);
    }

    if (args.length === 1) {
      // all channels has other listeners,
      // delete the listeners without issuing a command
      for (const channel of channelsArray) {
        PubSub.#listenersSet(
          listeners.get(channel)!,
          returnBuffers
        ).delete(listener);
      }
      return;
    }

    return this.#unsubscribeCommand(
      args,
      args.length - 1,
      () => {
        for (const channel of channelsArray) {
          const sets = listeners.get(channel);
          if (!sets) continue;

          (returnBuffers ? sets.buffers : sets.strings).delete(listener);
          if (sets.buffers.size === 0 && sets.strings.size === 0) {
            listeners.delete(channel);
          }
        }
      }
    );
  }

  #unsubscribeCommand(
    args: Array<RedisArgument>,
    channelsCounter: number,
    removeListeners: () => void
  ) {
    return {
      args,
      channelsCounter,
      resolve: () => {
        removeListeners();
        this.#updateIsActive();
      },
      reject: undefined
    } satisfies PubSubCommand;
  }

  #updateIsActive() {
    this.#isActive = (
      this.listeners[PUBSUB_TYPE.CHANNELS].size !== 0 ||
      this.listeners[PUBSUB_TYPE.PATTERNS].size !== 0 ||
      this.listeners[PUBSUB_TYPE.SHARDED].size !== 0 ||
      this.#subscribing !== 0
    );
  }

  reset() {
    this.#isActive = false;
    this.#subscribing = 0;
  }

  resubscribe() {
    const commands = [];
    for (const [type, listeners] of Object.entries(this.listeners)) {
      if (!listeners.size) continue;

      this.#isActive = true;
      this.#subscribing++;
      const callback = () => this.#subscribing--;
      commands.push({
        args: [
          COMMANDS[type as PubSubType].subscribe,
          ...listeners.keys()
        ],
        channelsCounter: listeners.size,
        resolve: callback,
        reject: callback
      } satisfies PubSubCommand);
    }

    return commands;
  }

  handleMessageReplyChannel(push: ReadonlyArray<Buffer>) {
    this.#emitPubSubMessage(
      PUBSUB_TYPE.CHANNELS,
      push[2],
      push[1]
    );
  }

  handleMessageReplyPattern(push: ReadonlyArray<Buffer>) {
    this.#emitPubSubMessage(
      PUBSUB_TYPE.PATTERNS,
      push[3],
      push[2],
      push[1]
    );
  }

  handleMessageReplySharded(push: ReadonlyArray<Buffer>) {
    this.#emitPubSubMessage(
      PUBSUB_TYPE.SHARDED,
      push[2],
      push[1]
    );
  }

  handleMessageReply(reply: Array<Buffer>): boolean {
    if (COMMANDS[PUBSUB_TYPE.CHANNELS].message.equals(reply[0])) {
      return true;
    } else if (COMMANDS[PUBSUB_TYPE.PATTERNS].message.equals(reply[0])) {
      return true;
    } else if (COMMANDS[PUBSUB_TYPE.SHARDED].message.equals(reply[0])) {
      return true;
    }

    return false;
  }

  removeShardedListeners(channel: string): ChannelListeners {
    const listeners = this.listeners[PUBSUB_TYPE.SHARDED].get(channel)!;
    this.listeners[PUBSUB_TYPE.SHARDED].delete(channel);
    this.#updateIsActive();
    return listeners;
  }

  #emitPubSubMessage(
    type: PubSubType,
    message: Buffer,
    channel: Buffer,
    pattern?: Buffer
  ): void {
    const keyString = (pattern ?? channel).toString(),
      listeners = this.listeners[type].get(keyString);

    if (!listeners) return;

    for (const listener of listeners.buffers) {
      listener(message, channel);
    }

    if (!listeners.strings.size) return;

    const channelString = pattern ? channel.toString() : keyString,
      messageString = channelString === '__redis__:invalidate' ?
        // https://github.com/redis/redis/pull/7469
        // https://github.com/redis/redis/issues/7463
        (message === null ? null : (message as any as Array<Buffer>).map(x => x.toString())) as any :
        message.toString();
    for (const listener of listeners.strings) {
      listener(messageString, channelString);
    }
  }
}
