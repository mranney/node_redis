import { RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from '../commands/generic-transformers';

export interface CommandParser {
  redisArgs: ReadonlyArray<RedisArgument>;
  keys: ReadonlyArray<RedisArgument>;
  firstKey: RedisArgument | undefined;
  preserve: unknown;

  push: (...arg: Array<RedisArgument>) => unknown;
  pushVariadic: (vals: RedisVariadicArgument) => unknown;
  pushVariadicWithLength: (vals: RedisVariadicArgument) => unknown;
  pushVariadicNumber: (vals: number | Array<number>) => unknown;
  pushKey: (key: RedisArgument) => unknown; // normal push of keys
  pushKeys: (keys: RedisVariadicArgument) => unknown; // push multiple keys at a time
  pushKeysLength: (keys: RedisVariadicArgument) => unknown; // push multiple keys at a time
}

export class BasicCommandParser implements CommandParser {
  #redisArgs: Array<RedisArgument> = [];
  #keys: Array<RedisArgument> = [];
  preserve: unknown;

  get redisArgs() {
    return this.#redisArgs;
  }

  get keys() {
    return this.#keys;
  }

  get firstKey() {
    return this.#keys[0];
  }

  get cacheKey() {
    const tmp = new Array(this.#redisArgs.length*2);

    for (let i = 0; i < this.#redisArgs.length; i++) {
      tmp[i] = this.#redisArgs[i].length;
      tmp[i+this.#redisArgs.length] = this.#redisArgs[i];
    }

    return tmp.join('_');
  }

  push(...arg: Array<RedisArgument>) {
    this.#redisArgs.push(...arg);
  };

  pushVariadic(vals: RedisVariadicArgument) {
    if (Array.isArray(vals)) {
      for (const val of vals) {
        this.push(val);
      }
    } else {
      this.push(vals);
    }
  }

  pushVariadicWithLength(vals: RedisVariadicArgument) {
    if (Array.isArray(vals)) {
      this.#redisArgs.push(vals.length.toString());
    } else {
      this.#redisArgs.push('1');
    }
    this.pushVariadic(vals);
  }

  pushVariadicNumber(vals: number | number[]) {
    if (Array.isArray(vals)) {
      for (const val of vals) {
        this.push(val.toString());
      }
    } else {
      this.push(vals.toString());
    }
  }

  pushKey(key: RedisArgument) {
    this.#keys.push(key);
    this.#redisArgs.push(key);
  }

  pushKeysLength(keys: RedisVariadicArgument) {
    if (Array.isArray(keys)) {
      this.#redisArgs.push(keys.length.toString());
    } else {
      this.#redisArgs.push('1');
    }
    this.pushKeys(keys);
  }

  pushKeys(keys: RedisVariadicArgument) {
    if (Array.isArray(keys)) {
      this.#keys.push(...keys);
      this.#redisArgs.push(...keys);
    } else {
      this.#keys.push(keys);
      this.#redisArgs.push(keys);
    }
  }
}
