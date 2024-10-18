import COMMANDS from '../commands';
import RedisMultiCommand, { MULTI_REPLY, MultiReply, MultiReplyType, RedisMultiQueuedCommand } from '../multi-command';
import { ReplyWithTypeMapping, CommandReply, Command, CommandArguments, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TransformReply, RedisScript, RedisFunction, TypeMapping } from '../RESP/types';
import { attachConfig, functionArgumentsPrefix, getTransformReply, scriptArgumentsPrefix } from '../commander';
import { BasicCommandParser } from './parser';

type CommandSignature<
  REPLIES extends Array<unknown>,
  C extends Command,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (...args: Parameters<C['transformArguments']>) => RedisClientMultiCommandType<
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

export type RedisClientMultiCommandType<
  REPLIES extends Array<any>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (
  RedisClientMultiCommand<REPLIES> &
  WithCommands<REPLIES, M, F, S, RESP, TYPE_MAPPING> & 
  WithModules<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithFunctions<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithScripts<REPLIES, M, F, S, RESP, TYPE_MAPPING>
);

type ExecuteMulti = (commands: Array<RedisMultiQueuedCommand>, selectedDB?: number) => Promise<Array<unknown>>;

export default class RedisClientMultiCommand<REPLIES = []> {
  static #createCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return function (this: RedisClientMultiCommand, ...args: Array<unknown>) {
      let redisArgs: CommandArguments;

      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);

        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
      } else {
        redisArgs = command.transformArguments(...args);
      }

      return this.addCommand(
        redisArgs,
        transformReply
      );
    };
  }

  static #createModuleCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return function (this: { _self: RedisClientMultiCommand }, ...args: Array<unknown>) {
      let redisArgs: CommandArguments;

      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);

        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
      } else {
        redisArgs = command.transformArguments(...args);
      }

      return this._self.addCommand(
        redisArgs,
        transformReply
      );
    };
  }

  static #createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions) {
    const prefix = functionArgumentsPrefix(name, fn);
    const transformReply = getTransformReply(fn, resp);

    return function (this: { _self: RedisClientMultiCommand }, ...args: Array<unknown>) {
      let fnArgs: CommandArguments;

      if (fn.parseCommand) {
        const parser = new BasicCommandParser(resp);
        parser.pushVariadic(prefix);
        fn.parseCommand(parser, ...args);

        fnArgs = parser.redisArgs;
        fnArgs.preserve = parser.preserve;
      } else {
        fnArgs = fn.transformArguments(...args);
      }

      const redisArgs: CommandArguments = prefix.concat(fnArgs);
      redisArgs.preserve = fnArgs.preserve;

      return this._self.addCommand(
        redisArgs,
        transformReply
      );
    };
  }

  static #createScriptCommand(script: RedisScript, resp: RespVersions) {
    const prefix = scriptArgumentsPrefix(script);
    const transformReply = getTransformReply(script, resp);

    return function (this: RedisClientMultiCommand, ...args: Array<unknown>) {
      let redisArgs: CommandArguments;

      if (script.parseCommand) {
        const parser = new BasicCommandParser(resp);
        parser.pushVariadic(prefix);
        script.parseCommand(parser, ...args);

        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
      } else {
        redisArgs = prefix;
        redisArgs.push(...script.transformArguments(...args));
      }

      return this.addCommand(
        redisArgs,
        transformReply
      );
    };
  }

  static extend<
    M extends RedisModules = Record<string, never>,
    F extends RedisFunctions = Record<string, never>,
    S extends RedisScripts = Record<string, never>,
    RESP extends RespVersions = 2
  >(config?: CommanderConfig<M, F, S, RESP>) {
    return attachConfig({
      BaseClass: RedisClientMultiCommand,
      commands: COMMANDS,
      createCommand: RedisClientMultiCommand.#createCommand,
      createModuleCommand: RedisClientMultiCommand.#createModuleCommand,
      createFunctionCommand: RedisClientMultiCommand.#createFunctionCommand,
      createScriptCommand: RedisClientMultiCommand.#createScriptCommand,
      config
    });
  }

  readonly #multi = new RedisMultiCommand();
  readonly #executeMulti: ExecuteMulti;
  readonly #executePipeline: ExecuteMulti;
  #selectedDB?: number;

  constructor(executeMulti: ExecuteMulti, executePipeline: ExecuteMulti) {
    this.#executeMulti = executeMulti;
    this.#executePipeline = executePipeline;
  }

  SELECT(db: number, transformReply?: TransformReply): this {
    this.#selectedDB = db;
    this.#multi.addCommand(['SELECT', db.toString()], transformReply);
    return this;
  }

  select = this.SELECT;

  addCommand(args: CommandArguments, transformReply?: TransformReply) {
    this.#multi.addCommand(args, transformReply);
    return this;
  }

  async exec<T extends MultiReply = MULTI_REPLY['GENERIC']>(execAsPipeline = false): Promise<MultiReplyType<T, REPLIES>> {
    if (execAsPipeline) return this.execAsPipeline<T>();

    return this.#multi.transformReplies(
      await this.#executeMulti(this.#multi.queue, this.#selectedDB)
    ) as MultiReplyType<T, REPLIES>;
  }

  EXEC = this.exec;

  execTyped(execAsPipeline = false) {
    return this.exec<MULTI_REPLY['TYPED']>(execAsPipeline);
  }

  async execAsPipeline<T extends MultiReply = MULTI_REPLY['GENERIC']>(): Promise<MultiReplyType<T, REPLIES>> {
    if (this.#multi.queue.length === 0) return [] as MultiReplyType<T, REPLIES>;

    return this.#multi.transformReplies(
      await this.#executePipeline(this.#multi.queue, this.#selectedDB)
    ) as MultiReplyType<T, REPLIES>;
  }

  execAsPipelineTyped() {
    return this.execAsPipeline<MULTI_REPLY['TYPED']>();
  }
}
