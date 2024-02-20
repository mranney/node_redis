import { RedisArgument } from '..';
import { Command, CommanderConfig, RedisCommands, RedisFunction, RedisFunctions, RedisModules, RedisScript, RedisScripts, RespVersions, TransformReply } from './RESP/types';

export interface CommandParser {
  redisArgs: Array<RedisArgument>;
  respVersion: RespVersions;
  preserve: unknown;

  push: (arg: RedisArgument) => unknown;
  pushKey: (key: RedisArgument) => unknown;
  setCachable: () => unknown;
}

abstract class AbstractCommandParser implements CommandParser {
  #redisArgs: Array<RedisArgument> = [];
  #respVersion: RespVersions;
  #preserve: unknown;

  constructor(respVersion: RespVersions = 2) {
    this.#respVersion = respVersion;
  }

  get redisArgs() {
    return this.#redisArgs;
  }

  get respVersion() {
    return this.#respVersion;
  }

  get preserve() {
    return this.#preserve;
  }

  push(arg: RedisArgument) {
    this.#redisArgs.push(arg);

  };
  
  pushKey(key: RedisArgument) {
    this.#redisArgs.push(key);
  };

  setPreserve(val: unknown) {
    this.#preserve = val;
  }

  setCachable() {};
}

export class BasicCommandParser extends AbstractCommandParser {};

export class CachedCommandParser extends AbstractCommandParser {
  keys: Array<RedisArgument> = [];
  #cachable = false;
  get cachable() {
    return this.#cachable;
  }

  get cacheKey() {
    let cacheKey = "";
    let first = true;
    for (const arg of this.redisArgs) {
      if (!first) {
        cacheKey += '_';
      } else {
        first = false;
      }

      if (arg instanceof Buffer) {
        cacheKey += arg.toString('hex')
      } else {
        cacheKey += arg;
      }
    }

    return cacheKey;
  }

  constructor(resp: RespVersions) {
    super(resp);
  }

  override pushKey(key: RedisArgument) {
    this.keys.push(key);
    super.pushKey(key);
  }

  override setCachable() {
    this.#cachable = true;
  }
}

export class ClusterCommandParser extends BasicCommandParser {
  firstKey?: RedisArgument;

  override pushKey(key: RedisArgument): void {
    if (!this.firstKey) {
      this.firstKey = key;
    }
    super.pushKey(key);
  }
}

export class ClusterCachedCommandParser extends CachedCommandParser {
  firstKey?: RedisArgument;

  override pushKey(key: RedisArgument): void {
    if (!this.firstKey) {
      this.firstKey = key;
    }
    super.pushKey(key);
  }
}

interface AttachConfigOptions<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions
> {
  BaseClass: new (...args: any) => any;
  commands: RedisCommands;
  createCommand(command: Command, resp: RespVersions): (...args: any) => any;
  createModuleCommand(command: Command, resp: RespVersions): (...args: any) => any;
  createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions): (...args: any) => any;
  createScriptCommand(script: RedisScript, resp: RespVersions): (...args: any) => any;
  config?: CommanderConfig<M, F, S, RESP>;
}

export function attachConfig<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions
>({
  BaseClass,
  commands,
  createCommand,
  createModuleCommand,
  createFunctionCommand,
  createScriptCommand,
  config
}: AttachConfigOptions<M, F, S, RESP>) {
  const RESP = config?.RESP ?? 2,
    Class: any = class extends BaseClass {};

  for (const [name, command] of Object.entries(commands)) {
    Class.prototype[name] = createCommand(command, RESP);
  }

  if (config?.modules) {
    for (const [moduleName, module] of Object.entries(config.modules)) {
      const fns = Object.create(null);
      for (const [name, command] of Object.entries(module)) {
        fns[name] = createModuleCommand(command, RESP);
      }

      attachNamespace(Class.prototype, moduleName, fns);
    }
  }

  if (config?.functions) {
    for (const [library, commands] of Object.entries(config.functions)) {
      const fns = Object.create(null);
      for (const [name, command] of Object.entries(commands)) {
        fns[name] = createFunctionCommand(name, command, RESP);
      }

      attachNamespace(Class.prototype, library, fns);
    }
  }

  if (config?.scripts) {
    for (const [name, script] of Object.entries(config.scripts)) {
      Class.prototype[name] = createScriptCommand(script, RESP);
    }
  }

  return Class;
}

function attachNamespace(prototype: any, name: PropertyKey, fns: any) {
  Object.defineProperty(prototype, name, {
    get() {
      const value = Object.create(fns);
      value._self = this;
      Object.defineProperty(this, name, { value });
      return value;
    }
  });
}

export function getTransformReply(command: Command, resp: RespVersions): TransformReply | undefined {
  switch (typeof command.transformReply) {
    case 'function':
      return command.transformReply;

    case 'object':
      return command.transformReply[resp];
  }
}

export function functionArgumentsPrefix(name: string, fn: RedisFunction) {
  const prefix: Array<string | Buffer> = [
    fn.IS_READ_ONLY ? 'FCALL_RO' : 'FCALL',
    name
  ];

  if (fn.NUMBER_OF_KEYS !== undefined) {
    prefix.push(fn.NUMBER_OF_KEYS.toString());
  }

  return prefix;
}

export function scriptArgumentsPrefix(script: RedisScript) {
  const prefix: Array<string | Buffer> = [
    script.IS_READ_ONLY ? 'EVALSHA_RO' : 'EVALSHA',
    script.SHA1
  ];

  if (script.NUMBER_OF_KEYS !== undefined) {
    prefix.push(script.NUMBER_OF_KEYS.toString());
  }

  return prefix;
}
