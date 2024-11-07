export { RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping/*, CommandPolicies*/, RedisArgument } from './lib/RESP/types';
export { RESP_TYPES } from './lib/RESP/decoder';
export { VerbatimString } from './lib/RESP/verbatim-string';
export { defineScript } from './lib/lua-script';
// export * from './lib/errors';

import RedisClient, { RedisClientOptions, RedisClientType } from './lib/client';
export { RedisClientOptions, RedisClientType };
export const createClient = RedisClient.create;

import { RedisClientPool, RedisPoolOptions, RedisClientPoolType } from './lib/client/pool';
export { RedisClientPoolType, RedisPoolOptions };
export const createClientPool = RedisClientPool.create;

import RedisCluster, { RedisClusterOptions, RedisClusterType } from './lib/cluster';
export { RedisClusterType, RedisClusterOptions };
export const createCluster = RedisCluster.create;

import RedisSentinel from './lib/sentinel';
export { RedisSentinelOptions, RedisSentinelType } from './lib/sentinel/types';
export const createSentinel = RedisSentinel.create;

import { BasicClientSideCache, BasicPooledClientSideCache } from './lib/client/cache';
export { BasicClientSideCache, BasicPooledClientSideCache };

// export { GeoReplyWith } from './lib/commands/generic-transformers';

// export { SetOptions } from './lib/commands/SET';

// export { RedisFlushModes } from './lib/commands/FLUSHALL';
