import {
  RedisModules,
  RedisFunctions,
  RedisScripts,
  RespVersions,
  TypeMapping,
  // CommandPolicies,
  createClient,
  RedisClientOptions,
  RedisClientType,
  RedisPoolOptions,
  RedisClientPoolType,
  createClientPool,
  createCluster,
  RedisClusterOptions,
  RedisClusterType
} from '@redis/client/index';
import { RedisServerDockerConfig, spawnRedisServer, spawnRedisCluster } from './dockers';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface TestUtilsConfig {
  dockerImageName: string;
  dockerImageVersionArgument: string;
  defaultDockerVersion?: string;
}

interface CommonTestOptions {
  serverArguments: Array<string>;
  minimumDockerVersion?: Array<number>;
}

interface ClientTestOptions<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends CommonTestOptions {
  clientOptions?: Partial<RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>>;
  disableClientSetup?: boolean;
}

interface ClientPoolTestOptions<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
> extends CommonTestOptions {
  clientOptions?: Partial<RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>>;
  poolOptions?: RedisPoolOptions;
}

interface ClusterTestOptions<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
  // POLICIES extends CommandPolicies
> extends CommonTestOptions {
  clusterConfiguration?: Partial<RedisClusterOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>>;
  numberOfMasters?: number;
  numberOfReplicas?: number;
}

interface AllTestOptions<
  M extends RedisModules,
  F extends RedisFunctions,
  S extends RedisScripts,
  RESP extends RespVersions,
  TYPE_MAPPING extends TypeMapping
  // POLICIES extends CommandPolicies
> {
  client: ClientTestOptions<M, F, S, RESP, TYPE_MAPPING>;
  cluster: ClusterTestOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>;
}

interface Version {
  string: string;
  numbers: Array<number>;
}

export default class TestUtils {
  static #parseVersionNumber(version: string): Array<number> {
    if (version === 'latest' || version === 'edge') return [Infinity];

    const dashIndex = version.indexOf('-');
    return (dashIndex === -1 ? version : version.substring(0, dashIndex))
      .split('.')
      .map(x => {
        const value = Number(x);
        if (Number.isNaN(value)) {
          throw new TypeError(`${version} is not a valid redis version`);
        }

        return value;
      });
  }

  static #getVersion(argumentName: string, defaultVersion = 'latest'): Version {
    return yargs(hideBin(process.argv))
      .option(argumentName, {
        type: 'string',
        default: defaultVersion
      })
      .coerce(argumentName, (version: string) => {
        return {
          string: version,
          numbers: TestUtils.#parseVersionNumber(version)
        };
      })
      .demandOption(argumentName)
      .parseSync()[argumentName];
  }

  readonly #VERSION_NUMBERS: Array<number>;
  readonly #DOCKER_IMAGE: RedisServerDockerConfig;

  constructor(config: TestUtilsConfig) {
    const { string, numbers } = TestUtils.#getVersion(config.dockerImageVersionArgument, config.defaultDockerVersion);
    this.#VERSION_NUMBERS = numbers;
    this.#DOCKER_IMAGE = {
      image: config.dockerImageName,
      version: string
    };
  }

  isVersionGreaterThan(minimumVersion: Array<number> | undefined): boolean {
    if (minimumVersion === undefined) return true;

    const lastIndex = Math.min(this.#VERSION_NUMBERS.length, minimumVersion.length) - 1;
    for (let i = 0; i < lastIndex; i++) {
      if (this.#VERSION_NUMBERS[i] > minimumVersion[i]) {
        return true;
      } else if (minimumVersion[i] > this.#VERSION_NUMBERS[i]) {
        return false;
      }
    }

    return this.#VERSION_NUMBERS[lastIndex] >= minimumVersion[lastIndex];
  }

  isVersionGreaterThanHook(minimumVersion: Array<number> | undefined): void {
    const isVersionGreaterThan = this.isVersionGreaterThan.bind(this);
    before(function () {
      if (!isVersionGreaterThan(minimumVersion)) {
        return this.skip();
      }
    });
  }

  testWithClient<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(
    title: string,
    fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING>) => unknown,
    options: ClientTestOptions<M, F, S, RESP, TYPE_MAPPING>
  ): void {
    let dockerPromise: ReturnType<typeof spawnRedisServer>;
    if (this.isVersionGreaterThan(options.minimumDockerVersion)) {
      const dockerImage = this.#DOCKER_IMAGE;
      before(function () {
        this.timeout(30000);

        dockerPromise = spawnRedisServer(dockerImage, options.serverArguments);
        return dockerPromise;
      });
    }

    it(title, async function () {
      if (!dockerPromise) return this.skip();

      const client = createClient({
        ...options.clientOptions,
        socket: {
          ...options.clientOptions?.socket,
          // TODO
          // @ts-ignore
          port: (await dockerPromise).port
        }
      });

      if (options.disableClientSetup) {
        return fn(client);
      }

      await client.connect();

      try {
        await client.flushAll();
        await fn(client);
      } finally {
        if (client.isOpen) {
          await client.flushAll();
          client.destroy();
        }
      }
    });
  }

  testWithClientPool<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
  >(
    title: string,
    fn: (client: RedisClientPoolType<M, F, S, RESP, TYPE_MAPPING>) => unknown,
    options: ClientPoolTestOptions<M, F, S, RESP, TYPE_MAPPING>
  ): void {
    let dockerPromise: ReturnType<typeof spawnRedisServer>;
    if (this.isVersionGreaterThan(options.minimumDockerVersion)) {
      const dockerImage = this.#DOCKER_IMAGE;
      before(function () {
        this.timeout(30000);

        dockerPromise = spawnRedisServer(dockerImage, options.serverArguments);
        return dockerPromise;
      });
    }

    it(title, async function () {
      if (!dockerPromise) return this.skip();

      const pool = createClientPool({
        ...options.clientOptions,
        socket: {
          ...options.clientOptions?.socket,
          // TODO
          // @ts-ignore
          port: (await dockerPromise).port
        }
      }, options.poolOptions);

      await pool.connect();

      try {
        await pool.flushAll();
        await fn(pool);
      } finally {
        await pool.flushAll();
        pool.destroy();
      }
    });
  }

  static async #clusterFlushAll<
    M extends RedisModules,
    F extends RedisFunctions,
    S extends RedisScripts,
    RESP extends RespVersions,
    TYPE_MAPPING extends TypeMapping
    // POLICIES extends CommandPolicies
  >(cluster: RedisClusterType<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>): Promise<unknown> {
    return Promise.all(
      cluster.masters.map(async master => {
        if (master.client) {
          await (await cluster.nodeClient(master)).flushAll();
        }
      })
    );
  }

  testWithCluster<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
    // POLICIES extends CommandPolicies = {}
  >(
    title: string,
    fn: (cluster: RedisClusterType<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>) => unknown,
    options: ClusterTestOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>
  ): void {
    let dockersPromise: ReturnType<typeof spawnRedisCluster>;
    if (this.isVersionGreaterThan(options.minimumDockerVersion)) {
      const dockerImage = this.#DOCKER_IMAGE;
      before(function () {
        this.timeout(30000);

        dockersPromise = spawnRedisCluster({
          ...dockerImage,
          numberOfMasters: options.numberOfMasters,
          numberOfReplicas: options.numberOfReplicas
        }, options.serverArguments,
          options.clusterConfiguration?.defaults);
        return dockersPromise;
      });
    }

    it(title, async function () {
      if (!dockersPromise) return this.skip();
    
      const dockers = await dockersPromise,
        cluster = createCluster({
          rootNodes: dockers.map(({ port }) => ({
            socket: {
              port
            }
          })),
          minimizeConnections: true,
          ...options.clusterConfiguration
        });

      await cluster.connect();

      try {
        await TestUtils.#clusterFlushAll(cluster);
        await fn(cluster);
      } finally {
        await TestUtils.#clusterFlushAll(cluster);
        cluster.destroy();
      }
    });
  }

  testAll<
    M extends RedisModules = {},
    F extends RedisFunctions = {},
    S extends RedisScripts = {},
    RESP extends RespVersions = 2,
    TYPE_MAPPING extends TypeMapping = {}
    // POLICIES extends CommandPolicies = {}
  >(
    title: string,
    fn: (client: RedisClientType<M, F, S, RESP, TYPE_MAPPING> | RedisClusterType<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>) => unknown,
    options: AllTestOptions<M, F, S, RESP, TYPE_MAPPING/*, POLICIES*/>
  ) {
    this.testWithClient(`client.${title}`, fn, options.client);
    this.testWithCluster(`cluster.${title}`, fn, options.cluster);
  }
}
