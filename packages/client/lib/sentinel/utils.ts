import { Command, RedisFunction, RedisScript, RespVersions } from '../RESP/types';
import { BasicCommandParser } from '../client/parser';
import { RedisSocketOptions, RedisTcpSocketOptions } from '../client/socket';
import { functionArgumentsPrefix, getTransformReply, scriptArgumentsPrefix } from '../commander';
import { NamespaceProxySentinel, NamespaceProxySentinelClient, NodeInfo, ProxySentinel, ProxySentinelClient, RedisNode } from './types';

/* TODO: should use map interface, would need a transform reply probably? as resp2 is list form, which this depends on */
export function parseNode(node: NodeInfo): RedisNode | undefined{
  if (node.flags.includes("s_down") || node.flags.includes("disconnected") || node.flags.includes("failover_in_progress")) {
    return undefined;
  }

  return { host: node.ip, port: Number(node.port) };
}

export function createNodeList(nodes: Array<NodeInfo>) {
  var nodeList: Array<RedisNode> = [];

  for (const nodeData of nodes) {
    const node = parseNode(nodeData)
    if (node === undefined) {
      continue;
    }
    nodeList.push(node);
  }

  return nodeList;
}

export function clientSocketToNode(socket: RedisSocketOptions): RedisNode {
  const s = socket as RedisTcpSocketOptions;

  return {
    host: s.host!,
    port: s.port!
  }
}

export function createCommand<T extends ProxySentinel | ProxySentinelClient>(command: Command, resp: RespVersions) {
  const transformReply = getTransformReply(command, resp);

  return async function (this: T, ...args: Array<unknown>) {
    if (command.parseCommand) {
      const parser = new BasicCommandParser(resp);
      command.parseCommand(parser, ...args);

      return this._self._execute(
        command.IS_READ_ONLY,
        client => client.executeCommand(parser, this.commandOptions, transformReply)
      );
    } else {
      const redisArgs = command.transformArguments(...args);
      const reply = await this._self.sendCommand(
          command.IS_READ_ONLY,
          redisArgs,
          this._self.commandOptions
        );

      return transformReply ?
        transformReply(reply, redisArgs.preserve) :
        reply;
    }
  };
}

export function createFunctionCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(name: string, fn: RedisFunction, resp: RespVersions) {
  const prefix = functionArgumentsPrefix(name, fn);
  const transformReply = getTransformReply(fn, resp);

  return async function (this: T, ...args: Array<unknown>) {
    if (fn.parseCommand) {
      const parser = new BasicCommandParser(resp);
      parser.pushVariadic(prefix);
      fn.parseCommand(parser, ...args);

      return this._self._execute(
        fn.IS_READ_ONLY,
        client => client.executeCommand(parser, this._self.commandOptions, transformReply)
      );
    } else {
      const fnArgs = fn.transformArguments(...args),
        redisArgs = prefix.concat(fnArgs),
        reply = await this._self._self.sendCommand(
          fn.IS_READ_ONLY,
          redisArgs,
          this._self._self.commandOptions
        );

      return transformReply ?
        transformReply(reply, fnArgs.preserve) :
        reply;
    }
  }
};

export function createModuleCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(command: Command, resp: RespVersions) {
  const transformReply = getTransformReply(command, resp);

  return async function (this: T, ...args: Array<unknown>) {
    if (command.parseCommand) {
      const parser = new BasicCommandParser(resp);
      command.parseCommand(parser, ...args);

      return this._self._execute(
        command.IS_READ_ONLY,
        client => client.executeCommand(parser, this._self.commandOptions, transformReply)
      );
    } else {
      const redisArgs = command.transformArguments(...args),
        reply = await this._self._self.sendCommand(
          command.IS_READ_ONLY,
          redisArgs,
          this._self._self.commandOptions
        );

      return transformReply ?
        transformReply(reply, redisArgs.preserve) :
        reply;
    }
  }
};

export function createScriptCommand<T extends ProxySentinel | ProxySentinelClient>(script: RedisScript, resp: RespVersions) {
  const prefix = scriptArgumentsPrefix(script);
  const transformReply = getTransformReply(script, resp);

  return async function (this: T, ...args: Array<unknown>) {
    if (script.parseCommand) {
      const parser = new BasicCommandParser(resp);
      parser.pushVariadic(prefix);
      script.parseCommand(parser, ...args);

      return this._self._execute(
        script.IS_READ_ONLY,
        client => client.executeCommand(parser, this.commandOptions, transformReply)
      );
    } else {
      const scriptArgs = script.transformArguments(...args),
        redisArgs = prefix.concat(scriptArgs),
        reply = await this._self.executeScript(
          script,
          script.IS_READ_ONLY,
          redisArgs,
          this._self.commandOptions
        );

      return transformReply ?
        transformReply(reply, scriptArgs.preserve) :
        reply;
    }
  };
}
