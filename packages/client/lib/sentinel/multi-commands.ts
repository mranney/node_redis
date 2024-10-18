import COMMANDS from '../commands';
import RedisMultiCommand, { MULTI_REPLY, MultiReply, MultiReplyType } from '../multi-command';
import { ReplyWithTypeMapping, CommandReply, Command, CommandArguments, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TransformReply, RedisScript, RedisFunction, TypeMapping } from '../RESP/types';
import { attachConfig, functionArgumentsPrefix, getTransformReply } from '../commander';
import { RedisSentinelType } from './types';
import { BasicCommandParser } from '../client/parser';

type CommandSignature<
  REPLIES extends Array<unknown>,
  C extends Command,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (...args: Parameters<C['transformArguments']>) => RedisSentinelMultiCommandType<
  [...REPLIES, ReplyWithTypeMapping<CommandReply<C, RESP>, TYPE_MAPPING>],
  M,
  F,
  S,
  RESP,
  TYPE_MAPPING
>;

type WithCommands<
  REPLIES extends Array<unknown>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof typeof COMMANDS]: CommandSignature<REPLIES, (typeof COMMANDS)[P], M, F, S, RESP, TYPE_MAPPING>;
};

type WithModules<
  REPLIES extends Array<unknown>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof M]: {
    [C in keyof M[P]]: CommandSignature<REPLIES, M[P][C], M, F, S, RESP, TYPE_MAPPING>;
  };
};

type WithFunctions<
  REPLIES extends Array<unknown>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [L in keyof F]: {
    [C in keyof F[L]]: CommandSignature<REPLIES, F[L][C], M, F, S, RESP, TYPE_MAPPING>;
  };
};

type WithScripts<
  REPLIES extends Array<unknown>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = {
  [P in keyof S]: CommandSignature<REPLIES, S[P], M, F, S, RESP, TYPE_MAPPING>;
};

export type RedisSentinelMultiCommandType<
  REPLIES extends Array<any>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (
  RedisSentinelMultiCommand<REPLIES> &
  WithCommands<REPLIES, M, F, S, RESP, TYPE_MAPPING> & 
  WithModules<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithFunctions<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithScripts<REPLIES, M, F, S, RESP, TYPE_MAPPING>
);

export default class RedisSentinelMultiCommand<REPLIES = []> {
  private static _createCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return function (this: RedisSentinelMultiCommand, ...args: Array<unknown>) {
      let redisArgs: CommandArguments = [];
      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);
        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
      } else {
        redisArgs = command.transformArguments(...args);
      }
      
      return this.addCommand(
        command.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  private static _createModuleCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);
    
    return function (this: { _self: RedisSentinelMultiCommand }, ...args: Array<unknown>) {
      let redisArgs: CommandArguments = [];

      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);
        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
      } else {
        redisArgs = command.transformArguments(...args);
      }

      return this._self.addCommand(
        command.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  private static _createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions) {
    const prefix = functionArgumentsPrefix(name, fn);
    const transformReply = getTransformReply(fn, resp);

    return function (this: { _self: RedisSentinelMultiCommand }, ...args: Array<unknown>) {
      let fnArgs: CommandArguments = [];

      if (fn.parseCommand) {
        const parser = new BasicCommandParser(resp);
        fn.parseCommand(parser, ...args);
        fnArgs = parser.redisArgs;
        fnArgs.preserve = parser.preserve;
      } else {
        fnArgs = fn.transformArguments(...args);
      }
    
      const redisArgs: CommandArguments = prefix.concat(fnArgs);
      redisArgs.preserve = fnArgs.preserve;

      return this._self.addCommand(
        fn.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  private static _createScriptCommand(script: RedisScript, resp: RespVersions) {
    const transformReply = getTransformReply(script, resp);
    
    return function (this: RedisSentinelMultiCommand, ...args: Array<unknown>) {
      let scriptArgs: CommandArguments = [];

      if (script.parseCommand) {
        const parser = new BasicCommandParser(resp);
        script.parseCommand(parser, ...args);
        scriptArgs = parser.redisArgs;
        scriptArgs.preserve = parser.preserve;
      } else {
        scriptArgs = script.transformArguments(...args);
      }

      this._setState(
        script.IS_READ_ONLY
      );
      this._multi.addScript(
        script,
        scriptArgs,
        transformReply
      );
      
      return this;
    };
  }

  static extend<
    M extends RedisModules = Record<string, never>,
    F extends RedisFunctions = Record<string, never>,
    S extends RedisScripts = Record<string, never>,
    RESP extends RespVersions = 2
  >(config?: CommanderConfig<M, F, S, RESP>) {
    return attachConfig({
      BaseClass: RedisSentinelMultiCommand,
      commands: COMMANDS,
      createCommand: RedisSentinelMultiCommand._createCommand,
      createModuleCommand: RedisSentinelMultiCommand._createModuleCommand,
      createFunctionCommand: RedisSentinelMultiCommand._createFunctionCommand,
      createScriptCommand: RedisSentinelMultiCommand._createScriptCommand,
      config
    });
  }

  private readonly _multi = new RedisMultiCommand();
  private readonly _sentinel: RedisSentinelType
  private _isReadonly: boolean | undefined = true;

  constructor(sentinel: RedisSentinelType) {
    this._sentinel = sentinel;
  }

  private _setState(
    isReadonly: boolean | undefined,
  ) {
    this._isReadonly &&= isReadonly;
  }

  addCommand(
    isReadonly: boolean | undefined,
    args: CommandArguments,
    transformReply?: TransformReply
  ) {
    this._setState(isReadonly);
    this._multi.addCommand(args, transformReply);
    return this;
  }

  async exec<T extends MultiReply = MULTI_REPLY['GENERIC']>(execAsPipeline = false) {
    if (execAsPipeline) return this.execAsPipeline<T>();

    return this._multi.transformReplies(
      await this._sentinel._executeMulti(
        this._isReadonly,
        this._multi.queue
      )
    ) as MultiReplyType<T, REPLIES>;
  }

  EXEC = this.exec;

  execTyped(execAsPipeline = false) {
    return this.exec<MULTI_REPLY['TYPED']>(execAsPipeline);
  }

  async execAsPipeline<T extends MultiReply = MULTI_REPLY['GENERIC']>() {
    if (this._multi.queue.length === 0) return [] as MultiReplyType<T, REPLIES>;

    return this._multi.transformReplies(
      await this._sentinel._executePipeline(
        this._isReadonly,
        this._multi.queue
      )
    ) as MultiReplyType<T, REPLIES>;
  }

  execAsPipelineTyped() {
    return this.execAsPipeline<MULTI_REPLY['TYPED']>();
  }
}
