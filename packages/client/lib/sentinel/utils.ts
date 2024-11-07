import { ArrayReply, Command, RedisFunction, RedisScript, RespVersions, UnwrapReply } from '../RESP/types';
import { BasicCommandParser } from '../client/parser';
import { RedisSocketOptions, RedisTcpSocketOptions } from '../client/socket';
import { functionArgumentsPrefix, getTransformReply, scriptArgumentsPrefix } from '../commander';
import { NamespaceProxySentinel, NamespaceProxySentinelClient, ProxySentinel, ProxySentinelClient, RedisNode } from './types';

/* TODO: should use map interface, would need a transform reply probably? as resp2 is list form, which this depends on */
export function parseNode(node: Record<string, string>): RedisNode | undefined{
 
  if (node.flags.includes("s_down") || node.flags.includes("disconnected") || node.flags.includes("failover_in_progress")) {
    return undefined;
  }

  return { host: node.ip, port: Number(node.port) };
}

export function createNodeList(nodes: UnwrapReply<ArrayReply<Record<string, string>>>) {
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
    const parser = new BasicCommandParser();
    command.parseCommand(parser, ...args);

    return this._self._execute(
      command.IS_READ_ONLY,
      client => client._executeCommand(command, parser, this.commandOptions, transformReply)
    );
  };
}

export function createFunctionCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(name: string, fn: RedisFunction, resp: RespVersions) {
  const prefix = functionArgumentsPrefix(name, fn);
  const transformReply = getTransformReply(fn, resp);

  return async function (this: T, ...args: Array<unknown>) {
    const parser = new BasicCommandParser();
    parser.push(...prefix);
    fn.parseCommand(parser, ...args);

    return this._self._execute(
      fn.IS_READ_ONLY,
      client => client._executeCommand(fn, parser, this._self.commandOptions, transformReply)
    );
  }
};

export function createModuleCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(command: Command, resp: RespVersions) {
  const transformReply = getTransformReply(command, resp);

  return async function (this: T, ...args: Array<unknown>) {
    const parser = new BasicCommandParser();
    command.parseCommand(parser, ...args);

    return this._self._execute(
      command.IS_READ_ONLY,
      client => client._executeCommand(command, parser, this._self.commandOptions, transformReply)
    );
  }
};

export function createScriptCommand<T extends ProxySentinel | ProxySentinelClient>(script: RedisScript, resp: RespVersions) {
  const prefix = scriptArgumentsPrefix(script);
  const transformReply = getTransformReply(script, resp);

  return async function (this: T, ...args: Array<unknown>) {
    const parser = new BasicCommandParser();
    parser.push(...prefix);
    script.parseCommand(parser, ...args);

    return this._self._execute(
      script.IS_READ_ONLY,
      client => client._executeScript(script, parser, this.commandOptions, transformReply)
    );
  };
}
