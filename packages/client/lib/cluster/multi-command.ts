import COMMANDS from '../commands';
import RedisMultiCommand, { MULTI_REPLY, MultiReply, MultiReplyType, RedisMultiQueuedCommand } from '../multi-command';
import { ReplyWithTypeMapping, CommandReply, Command, CommandArguments, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TransformReply, RedisScript, RedisFunction, TypeMapping, RedisArgument } from '../RESP/types';
import { attachConfig, functionArgumentsPrefix, getTransformReply } from '../commander';
import RedisCluster from '.';
import { BasicCommandParser } from '../client/parser';

type CommandSignature<
  REPLIES extends Array<unknown>,
  C extends Command,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (...args: Parameters<C['transformArguments']>) => RedisClusterMultiCommandType<
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

export type RedisClusterMultiCommandType<
  REPLIES extends Array<any>,
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> = (
  RedisClusterMultiCommand<REPLIES> &
  WithCommands<REPLIES, M, F, S, RESP, TYPE_MAPPING> & 
  WithModules<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithFunctions<REPLIES, M, F, S, RESP, TYPE_MAPPING> &
  WithScripts<REPLIES, M, F, S, RESP, TYPE_MAPPING>
);

export type ClusterMultiExecute = (
  firstKey: RedisArgument | undefined,
  isReadonly: boolean | undefined,
  commands: Array<RedisMultiQueuedCommand>
) => Promise<Array<unknown>>;

export default class RedisClusterMultiCommand<REPLIES = []> {
  static #createCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return function (this: RedisClusterMultiCommand, ...args: Array<unknown>) {
      let redisArgs: CommandArguments = [];
      let firstKey: RedisArgument | undefined;

      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);
        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
        firstKey = parser.firstKey;
      } else {
        redisArgs = command.transformArguments(...args);
        firstKey = RedisCluster.extractFirstKey(
          command,
          args,
          redisArgs
        );
      }
      
      return this.addCommand(
        firstKey,
        command.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  static #createModuleCommand(command: Command, resp: RespVersions) {
    const transformReply = getTransformReply(command, resp);

    return function (this: { _self: RedisClusterMultiCommand }, ...args: Array<unknown>) {
      let redisArgs: CommandArguments = [];
      let firstKey: RedisArgument | undefined;

      if (command.parseCommand) {
        const parser = new BasicCommandParser(resp);
        command.parseCommand(parser, ...args);
        redisArgs = parser.redisArgs;
        redisArgs.preserve = parser.preserve;
        firstKey = parser.firstKey;
      } else {
        redisArgs = command.transformArguments(...args);
        firstKey = RedisCluster.extractFirstKey(
          command,
          args,
          redisArgs
        );
      }
      return this._self.addCommand(
        firstKey,
        command.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  static #createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions) {
    const prefix = functionArgumentsPrefix(name, fn);
    const transformReply = getTransformReply(fn, resp);

    return function (this: { _self: RedisClusterMultiCommand }, ...args: Array<unknown>) {
      let fnArgs: CommandArguments = [];
      let firstKey: RedisArgument | undefined;

      if (fn.parseCommand) {
        const parser = new BasicCommandParser(resp);
        fn.parseCommand(parser, ...args);
        fnArgs = parser.redisArgs;
        fnArgs.preserve = parser.preserve;
        firstKey = parser.firstKey;
      } else {
        fnArgs = fn.transformArguments(...args);
        firstKey = RedisCluster.extractFirstKey(
          fn,
          args,
          fnArgs
        );
      }

      const redisArgs: CommandArguments = prefix.concat(fnArgs);
      redisArgs.preserve = fnArgs.preserve;

      return this._self.addCommand(
        firstKey,
        fn.IS_READ_ONLY,
        redisArgs,
        transformReply
      );
    };
  }

  static #createScriptCommand(script: RedisScript, resp: RespVersions) {
    const transformReply = getTransformReply(script, resp);

    return function (this: RedisClusterMultiCommand, ...args: Array<unknown>) {
      let scriptArgs: CommandArguments = [];
      let firstKey: RedisArgument | undefined;

      if (script.parseCommand) {
        const parser = new BasicCommandParser(resp);
        script.parseCommand(parser, ...args);
        scriptArgs = parser.redisArgs;
        scriptArgs.preserve = parser.preserve;
        firstKey = parser.firstKey;
      } else {
        scriptArgs = script.transformArguments(...args);
        firstKey = RedisCluster.extractFirstKey(
          script,
          args,
          scriptArgs
        )
      }

      this.#setState(
        firstKey,
        script.IS_READ_ONLY
      );
      this.#multi.addScript(
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
      BaseClass: RedisClusterMultiCommand,
      commands: COMMANDS,
      createCommand: RedisClusterMultiCommand.#createCommand,
      createModuleCommand: RedisClusterMultiCommand.#createModuleCommand,
      createFunctionCommand: RedisClusterMultiCommand.#createFunctionCommand,
      createScriptCommand: RedisClusterMultiCommand.#createScriptCommand,
      config
    });
  }

  readonly #multi = new RedisMultiCommand();
  readonly #executeMulti: ClusterMultiExecute;
  readonly #executePipeline: ClusterMultiExecute;
  #firstKey: RedisArgument | undefined;
  #isReadonly: boolean | undefined = true;

  constructor(
    executeMulti: ClusterMultiExecute,
    executePipeline: ClusterMultiExecute,
    routing: RedisArgument | undefined
  ) {
    this.#executeMulti = executeMulti;
    this.#executePipeline = executePipeline;
    this.#firstKey = routing;
  }

  #setState(
    firstKey: RedisArgument | undefined,
    isReadonly: boolean | undefined,
  ) {
    this.#firstKey ??= firstKey;
    this.#isReadonly &&= isReadonly;
  }

  addCommand(
    firstKey: RedisArgument | undefined,
    isReadonly: boolean | undefined,
    args: CommandArguments,
    transformReply?: TransformReply
  ) {
    this.#setState(firstKey, isReadonly);
    this.#multi.addCommand(args, transformReply);
    return this;
  }

  async exec<T extends MultiReply = MULTI_REPLY['GENERIC']>(execAsPipeline = false) {
    if (execAsPipeline) return this.execAsPipeline<T>();

    return this.#multi.transformReplies(
      await this.#executeMulti(
        this.#firstKey,
        this.#isReadonly,
        this.#multi.queue
      )
    ) as MultiReplyType<T, REPLIES>;
  }

  EXEC = this.exec;

  execTyped(execAsPipeline = false) {
    return this.exec<MULTI_REPLY['TYPED']>(execAsPipeline);
  }

  async execAsPipeline<T extends MultiReply = MULTI_REPLY['GENERIC']>() {
    if (this.#multi.queue.length === 0) return [] as MultiReplyType<T, REPLIES>;

    return this.#multi.transformReplies(
      await this.#executePipeline(
        this.#firstKey,
        this.#isReadonly,
        this.#multi.queue
      )
    ) as MultiReplyType<T, REPLIES>;
  }

  execAsPipelineTyped() {
    return this.execAsPipeline<MULTI_REPLY['TYPED']>();
  }
}
