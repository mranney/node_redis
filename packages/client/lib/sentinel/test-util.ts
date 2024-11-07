import { createConnection, Socket } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { RedisSentinelOptions, RedisSentinelType } from './types';
import RedisClient from '../client';
import RedisSentinel from '.';
import { RedisArgument, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping } from '../RESP/types';
const execAsync = promisify(exec);
import RedisSentinelModule from './module'

interface ErrorWithCode extends Error {
  code: string;
}

async function isPortAvailable(port: number): Promise<boolean> {
  var socket: Socket | undefined = undefined;
  try {
    socket = createConnection({ port });
    await once(socket, 'connect');
  } catch (err) {
    if (err instanceof Error && (err as ErrorWithCode).code === 'ECONNREFUSED') {
      return true;
    }
  } finally {
    if (socket !== undefined) {
      socket.end();
    }
  }

  return false;
}

const portIterator = (async function* (): AsyncIterableIterator<number> {
  for (let i = 6379; i < 65535; i++) {
    if (await isPortAvailable(i)) {
      yield i;
    }
  }

  throw new Error('All ports are in use');
})();

export interface RedisServerDockerConfig {
  image: string;
  version: string;
}

export interface RedisServerDocker {
  port: number;
  dockerId: string;
}

abstract class DockerBase {
  async spawnRedisServerDocker({ image, version }: RedisServerDockerConfig, serverArguments: Array<string>, environment?: string): Promise<RedisServerDocker> {
    const port = (await portIterator.next()).value;
    let cmdLine = `docker run --init -d --network host `;
    if (environment !== undefined) {
      cmdLine += `-e ${environment} `;
    }
    cmdLine += `${image}:${version} ${serverArguments.join(' ')}`;
    cmdLine = cmdLine.replace('{port}', `--port ${port.toString()}`);
    // console.log("spawnRedisServerDocker: cmdLine = " + cmdLine);
    const { stdout, stderr } = await execAsync(cmdLine);

    if (!stdout) {
      throw new Error(`docker run error - ${stderr}`);
    }

    while (await isPortAvailable(port)) {
      await setTimeout(50);
    }

    return {
      port,
      dockerId: stdout.trim()
    };
  }

  async dockerRemove(dockerId: string): Promise<void> {
    try {
      await this.dockerStop(dockerId); ``
    } catch (err) {
      // its ok if stop failed, as we are just going to remove, will just be slower
      console.log(`dockerStop failed in remove: ${err}`);
    }

    const { stderr } = await execAsync(`docker rm -f ${dockerId}`);
    if (stderr) {
      console.log("docker rm failed");
      throw new Error(`docker rm error - ${stderr}`);
    }
  }

  async dockerStop(dockerId: string): Promise<void> {
    /* this is an optimization to get around slow docker stop times, but will fail if container is already stopped */
    try {
      await execAsync(`docker exec ${dockerId} /bin/bash -c "kill -SIGINT 1"`);
    } catch (err) {
      /* this will fail if container is already not running, can be ignored */
    }

    let ret = await execAsync(`docker stop ${dockerId}`);
    if (ret.stderr) {
      throw new Error(`docker stop error - ${ret.stderr}`);
    }
  }

  async dockerStart(dockerId: string): Promise<void> {
    const { stderr } = await execAsync(`docker start ${dockerId}`);
    if (stderr) {
      throw new Error(`docker start error - ${stderr}`);
    }
  }
}

export interface RedisSentinelConfig {
  numberOfNodes?: number;
  nodeDockerConfig?: RedisServerDockerConfig;
  nodeServerArguments?: Array<string>

  numberOfSentinels?: number;
  sentinelDockerConfig?: RedisServerDockerConfig;
  sentinelServerArgument?: Array<string>

  sentinelName: string;
  sentinelQuorum?: number;

  password?: string;
}

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface SentinelController {
  getMaster(): Promise<string>;
  getMasterPort(): Promise<number>;
  getRandomNode(): string;
  getRandonNonMasterNode(): Promise<string>;
  getNodePort(id: string): number;
  getAllNodesPort(): Array<number>;
  getSentinelPort(id: string): number;
  getAllSentinelsPort(): Array<number>;
  getSetinel(i: number): string;
  stopNode(id: string): Promise<void>;
  restartNode(id: string): Promise<void>;
  stopSentinel(id: string): Promise<void>;
  restartSentinel(id: string): Promise<void>;
  getSentinelClient(opts?: Partial<RedisSentinelOptions<{}, {}, {}, 2, {}>>): RedisSentinelType<{}, {}, {}, 2, {}>;
}

export class SentinelFramework extends DockerBase {
  #nodeList: Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>> = [];
  /* port -> docker info/client */
  #nodeMap: Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>>>>;
  #sentinelList: Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>> = [];
  /* port -> docker info/client */
  #sentinelMap: Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>>>>;

  config: RedisSentinelConfig;

  #spawned: boolean = false;

  get spawned() {
    return this.#spawned;
  }

  constructor(config: RedisSentinelConfig) {
    super();

    this.config = config;

    this.#nodeMap = new Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelNodes']>>>>();
    this.#sentinelMap = new Map<string, ArrayElement<Awaited<ReturnType<SentinelFramework['spawnRedisSentinelSentinels']>>>>();
  }

  getSentinelClient(opts?: Partial<RedisSentinelOptions<RedisModules, 
    RedisFunctions,
    RedisScripts,
    RespVersions, 
    TypeMapping>>, errors = true) {
    if (opts?.sentinelRootNodes !== undefined) {
      throw new Error("cannot specify sentinelRootNodes here");
    }
    if (opts?.name !== undefined) {
      throw new Error("cannot specify sentinel db name here");
    }

    const options: RedisSentinelOptions<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> = {
      ...opts,
      name: this.config.sentinelName,
      sentinelRootNodes: this.#sentinelList.map((sentinel) => { return { host: '127.0.0.1', port: sentinel.docker.port } }),
      passthroughClientErrorEvents: errors
    }

    if (this.config.password !== undefined) {
      if (!options.nodeClientOptions) {
        options.nodeClientOptions = {};
      }
      options.nodeClientOptions.password = this.config.password;

      if (!options.sentinelClientOptions) {
        options.sentinelClientOptions = {};
      }
      options.sentinelClientOptions = {password: this.config.password};
    }

    return RedisSentinel.create(options);
  }

  async spawnRedisSentinel() {
    if (this.#spawned) {
      return;
    }

    if (this.#nodeMap.size != 0 || this.#sentinelMap.size != 0) {
      throw new Error("inconsistent state with partial setup");
    }

    this.#nodeList = await this.spawnRedisSentinelNodes();
    this.#nodeList.map((value) => this.#nodeMap.set(value.docker.port.toString(), value));

    this.#sentinelList = await this.spawnRedisSentinelSentinels();
    this.#sentinelList.map((value) => this.#sentinelMap.set(value.docker.port.toString(), value));

    this.#spawned = true;
  }

  async cleanup() {
    if (!this.#spawned) {
      return;
    }

    return Promise.all(
      [...this.#nodeMap!.values(), ...this.#sentinelMap!.values()].map(
        async ({ docker, client }) => {
          if (client.isOpen) {
            client.destroy();
          }
          this.dockerRemove(docker.dockerId);
        }
      )
    ).finally(async () => {
      this.#spawned = false;
      this.#nodeMap.clear();
      this.#sentinelMap.clear();
    });
  }

  protected async spawnRedisSentinelNodeDocker() {
    const imageInfo: RedisServerDockerConfig = this.config.nodeDockerConfig ?? { image: "redis/redis-stack-server", version: "latest" };
    const serverArguments: Array<string> = this.config.nodeServerArguments ?? [];
    let environment;
    if (this.config.password !== undefined) {
      environment = `REDIS_ARGS="{port} --requirepass ${this.config.password}"`;
    } else {
      environment = 'REDIS_ARGS="{port}"';
    }
  
    const docker = await this.spawnRedisServerDocker(imageInfo, serverArguments, environment);
    const client = await RedisClient.create({
      password: this.config.password,
      socket: {
        port: docker.port
      }
    }).on("error", () => { }).connect();

    return {
      docker,
      client
    };
  }

  protected async spawnRedisSentinelNodes() {
    const master = await this.spawnRedisSentinelNodeDocker();

    const promises: Array<ReturnType<SentinelFramework['spawnRedisSentinelNodeDocker']>> = [];

    for (let i = 0; i < (this.config.numberOfNodes ?? 0) - 1; i++) {
      promises.push(
        this.spawnRedisSentinelNodeDocker().then(async node => {
          if (this.config.password !== undefined) {
            await node.client.configSet({'masterauth': this.config.password})
          }
          await node.client.replicaOf('127.0.0.1', master.docker.port);
          return node;
        })
      );
    }

    return [
      master,
      ...await Promise.all(promises)
    ];
  }

  protected async spawnRedisSentinelSentinelDocker() {
    const imageInfo: RedisServerDockerConfig = this.config.sentinelDockerConfig ?? { image: "redis", version: "latest" }
    let serverArguments: Array<string>;
    if (this.config.password === undefined) {
      serverArguments = this.config.sentinelServerArgument ??
        [
          "/bin/bash",
          "-c",
          "\"touch /tmp/sentinel.conf ; /usr/local/bin/redis-sentinel /tmp/sentinel.conf {port} \""
        ];
    } else {
      serverArguments = this.config.sentinelServerArgument ??
        [
          "/bin/bash",
          "-c",
          `"touch /tmp/sentinel.conf ; /usr/local/bin/redis-sentinel /tmp/sentinel.conf {port} --requirepass ${this.config.password}"`
        ];
    }
    
    const docker = await this.spawnRedisServerDocker(imageInfo, serverArguments);
    const client = await RedisClient.create({
      modules: RedisSentinelModule,
      password: this.config.password,
      socket: {
        port: docker.port
      }
    }).on("error", () => { }).connect();

    return {
      docker,
      client
    };
  }

  protected async spawnRedisSentinelSentinels() {
    const quorum = this.config.sentinelQuorum?.toString() ?? "2";
    const node = this.#nodeList[0];

    const promises: Array<ReturnType<SentinelFramework['spawnRedisSentinelSentinelDocker']>> = [];

    for (let i = 0; i < (this.config.numberOfSentinels ?? 3); i++) {
      promises.push(
        this.spawnRedisSentinelSentinelDocker().then(async sentinel => {
          await sentinel.client.sentinel.sentinelMonitor(this.config.sentinelName, '127.0.0.1', node.docker.port.toString(), quorum);
          const options: Array<{option: RedisArgument, value: RedisArgument}> = [];
          options.push({ option: "down-after-milliseconds", value: "100" });
          options.push({ option: "failover-timeout", value: "5000" });
          if (this.config.password !== undefined) {
            options.push({ option: "auth-pass", value: this.config.password });
          }
          await sentinel.client.sentinel.sentinelSet(this.config.sentinelName, options)
          return sentinel;
        })
      );
    }

    return [
      ...await Promise.all(promises)
    ]
  }

  async getAllRunning() {
    for (const port of this.getAllNodesPort()) {
      let first = true;
      while (await isPortAvailable(port)) {        
        if (!first) {
          console.log(`problematic restart ${port}`);
          await setTimeout(500);
        } else {
          first = false;
        }
        await this.restartNode(port.toString());
      }
    }

    for (const port of this.getAllSentinelsPort()) {
      let first = true;
      while (await isPortAvailable(port)) {        
        if (!first) {
          await setTimeout(500);
        } else {
          first = false;
        }
        await this.restartSentinel(port.toString());
      }
    }
  }

  async addSentinel() {
    const quorum = this.config.sentinelQuorum?.toString() ?? "2";
    const node = this.#nodeList[0];
    const sentinel = await this.spawnRedisSentinelSentinelDocker();

    await sentinel.client.sentinel.sentinelMonitor(this.config.sentinelName, '127.0.0.1', node.docker.port.toString(), quorum);
    const options: Array<{option: RedisArgument, value: RedisArgument}> = [];
    options.push({ option: "down-after-milliseconds", value: "100" });
    options.push({ option: "failover-timeout", value: "5000" });
    if (this.config.password !== undefined) {
      options.push({ option: "auth-pass", value: this.config.password });
    }
    await sentinel.client.sentinel.sentinelSet(this.config.sentinelName, options);

    this.#sentinelList.push(sentinel);
    this.#sentinelMap.set(sentinel.docker.port.toString(), sentinel);
  }

  async addNode() {
    const masterPort = await this.getMasterPort();
    const newNode = await this.spawnRedisSentinelNodeDocker();

    if (this.config.password !== undefined) {
      await newNode.client.configSet({'masterauth': this.config.password})
    }
    await newNode.client.replicaOf('127.0.0.1', masterPort);

    this.#nodeList.push(newNode);
    this.#nodeMap.set(newNode.docker.port.toString(), newNode);
  }

  async getMaster(tracer?: Array<string>): Promise<string | undefined> {
    for (const sentinel of this.#sentinelMap!.values()) {
      let info;

      try {
        if (!sentinel.client.isReady) {
          continue;
        }

        info = await sentinel.client.sentinel.sentinelMaster(this.config.sentinelName);
        if (tracer) {
          tracer.push('getMaster: master data returned from sentinel');
          tracer.push(JSON.stringify(info, undefined, '\t'))
        }
      } catch (err) {
        console.log("getMaster: sentinelMaster call failed: " + err);
        continue;
      }

      const master = this.#nodeMap.get(info.port); 
      if (master === undefined) {
        throw new Error(`couldn't find master node for ${info.port}`);
      }

      if (tracer) {
        tracer.push(`getMaster: master port is either ${info.port} or ${master.docker.port}`);
      }

      if (!master.client.isOpen) {
        throw new Error(`Sentinel's expected master node (${info.port}) is now down`);
      }

      return info.port;
    }

    throw new Error("Couldn't get master");
  }

  async getMasterPort(tracer?: Array<string>): Promise<number> {
    const data = await this.getMaster(tracer)

    return this.#nodeMap.get(data!)!.docker.port;
  }

  getRandomNode() {
    return this.#nodeList[Math.floor(Math.random() * this.#nodeList.length)].docker.port.toString();
  }

  async getRandonNonMasterNode(): Promise<string> {
    const masterPort = await this.getMasterPort();
    while (true) {
      const node = this.#nodeList[Math.floor(Math.random() * this.#nodeList.length)];
      if (node.docker.port != masterPort) {
        return node.docker.port.toString();
      }
    }
  }

  async stopNode(id: string) {
//    console.log(`stopping node ${id}`);
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    if (node.client.isOpen) {
      node.client.destroy();
    }

    return await this.dockerStop(node.docker.dockerId);
  }

  async restartNode(id: string) {
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    await this.dockerStart(node.docker.dockerId);
    if (!node.client.isOpen) {
      node.client = await RedisClient.create({
        password: this.config.password,
        socket: {
          port: node.docker.port
        }
      }).on("error", () => { }).connect();
    }
  }

  async stopSentinel(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    if (sentinel.client.isOpen) {
      sentinel.client.destroy();
    }

    return await this.dockerStop(sentinel.docker.dockerId);
  }

  async restartSentinel(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    await this.dockerStart(sentinel.docker.dockerId);
    if (!sentinel.client.isOpen) {
      sentinel.client = await RedisClient.create({
        modules: RedisSentinelModule,
        password: this.config.password,
        socket: {
          port: sentinel.docker.port
        }
      }).on("error", () => { }).connect();
    }
  }

  getNodePort(id: string) {
    let node = this.#nodeMap.get(id);
    if (node === undefined) {
      throw new Error("unknown node: " + id);
    }

    return node.docker.port;
  }

  getAllNodesPort() {
    let ports: Array<number> = [];
    for (const node of this.#nodeList) {
      ports.push(node.docker.port);
    }

    return ports
  }

  getAllDockerIds() {
    let ids = new Map<string, number>();
    for (const node of this.#nodeList) {
      ids.set(node.docker.dockerId, node.docker.port);
    }

    return ids;
  }

  getSentinelPort(id: string) {
    let sentinel = this.#sentinelMap.get(id);
    if (sentinel === undefined) {
      throw new Error("unknown sentinel: " + id);
    }

    return sentinel.docker.port;
  }

  getAllSentinelsPort() {
    let ports: Array<number> = [];
    for (const sentinel of this.#sentinelList) {
      ports.push(sentinel.docker.port);
    }

    return ports
  }

  getSetinel(i: number): string {
    return this.#sentinelList[i].docker.port.toString();
  }

  sentinelSentinels() {
    for (const sentinel of this.#sentinelList) {
      if (sentinel.client.isReady) {
        return sentinel.client.sentinel.sentinelSentinels(this.config.sentinelName);
      }
    }
  }

  sentinelMaster() {
    for (const sentinel of this.#sentinelList) {
      if (sentinel.client.isReady) {
        return sentinel.client.sentinel.sentinelMaster(this.config.sentinelName);
      }
    }
  }

  sentinelReplicas() {
    for (const sentinel of this.#sentinelList) {
      if (sentinel.client.isReady) {
        return sentinel.client.sentinel.sentinelReplicas(this.config.sentinelName);
      }
    }
  }
}
