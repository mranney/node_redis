# Clustering

## Basic Example

Connecting to a cluster is a bit different. Create the client by specifying some (or all) of the nodes in your cluster and then use it like a regular client instance:

```javascript
import { createCluster } from 'redis';

const cluster = await createCluster({
    rootNodes: [{
      url: 'redis://10.0.0.1:30001'
    }, {
      url: 'redis://10.0.0.2:30002'
    }]
  })
  .on('error', err => console.log('Redis Cluster Error', err))
  .connect();

await cluster.set('key', 'value');
const value = await cluster.get('key');
await cluster.close();
```

## `createCluster` configuration

> See the [client configuration](./client-configuration.md) page for the `rootNodes` and `defaults` configuration schemas.

| Property               | Default | Description                                                                                                                                                                                                                                                                                                         |
|------------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| rootNodes              |         | An array of root nodes that are part of the cluster, which will be used to get the cluster topology. Each element in the array is a client configuration object. There is no need to specify every node in the cluster: 3 should be enough to reliably connect and obtain the cluster configuration from the server |
| defaults               |         | The default configuration values for every client in the cluster.  Use this for example when specifying an ACL user to connect with                                                                                                                                                                                 |
| useReplicas            | `false` | When `true`, distribute load by executing readonly commands (such as `GET`, `GEOSEARCH`, etc.) across all cluster nodes. When `false`, only use master nodes                                                                                                                                                        |
| minimizeConnections    | `false` | When `true`, `.connect()` will only discover the cluster topology, without actually connecting to all the nodes. Useful for short-term or Pub/Sub-only connections.                                                                                                                                                 |
| maxCommandRedirections | `16`    | The maximum number of times a command will be redirected due to `MOVED` or `ASK` errors                                                                                                                                                                                                                             |
| nodeAddressMap         |         | Defines the [node address mapping](#node-address-map)                                                                                                                                                                                                                                                               |
| modules                |         | Included [Redis Modules](../README.md#packages)                                                                                                                                                                                                                                                                     |
| scripts                |         | Script definitions (see [Lua Scripts](../README.md#lua-scripts))                                                                                                                                                                                                                                                    |
| functions              |         | Function definitions (see [Functions](../README.md#functions))                                                                                                                                                                                                                                                      |

## Auth with password and username

Specifying the password in the URL or a root node will only affect the connection to that specific node. In case you want to set the password for all the connections being created from a cluster instance, use the `defaults` option.

```javascript
createCluster({
  rootNodes: [{
    url: 'redis://10.0.0.1:30001'
  }, {
    url: 'redis://10.0.0.2:30002'
  }],
  defaults: {
    username: 'username',
    password: 'password'
  }
});
```

## Node Address Map

A mapping between the addresses in the cluster (see `CLUSTER SHARDS`) and the addresses the client should connect to.
Useful when the cluster is running on a different network to the client.

```javascript
const rootNodes = [{
  url: 'external-host-1.io:30001'
}, {
  url: 'external-host-2.io:30002'
}];

// Use either a static mapping:
createCluster({
  rootNodes,
  nodeAddressMap: {
    '10.0.0.1:30001': {
      host: 'external-host.io',
      port: 30001
    },
    '10.0.0.2:30002': {
      host: 'external-host.io',
      port: 30002
    }
  }
});

// or create the mapping dynamically, as a function:
createCluster({
  rootNodes,
  nodeAddressMap(address) {
    const indexOfDash = address.lastIndexOf('-'),
      indexOfDot = address.indexOf('.', indexOfDash),
      indexOfColons = address.indexOf(':', indexOfDot);
    
    return {
      host: `external-host-${address.substring(indexOfDash + 1, indexOfDot)}.io`,
      port: Number(address.substring(indexOfColons + 1))
    };
  }
});
```

> This is a common problem when using ElastiCache. See [Accessing ElastiCache from outside AWS](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/accessing-elasticache.html) for more information on that.


### Aws Elasticache Clusters with TLS

```javascript
const redisCluster = createCluster({
  rootNodes: [{
    socket: {
      host: 'redis cluster/server address', // for example 'clustercfg.your-redis-cluster-name.xiko.euw1.cache.amazonaws.com'
      port: 6379
    }
  }],
  defaults: {
    socket: {
      tls: true
    },
    password: 'token'
  }
});
redisCluster
    .on('connect', () => console.log('Connected to Redis DB'))
    .on('ready', () => console.log('Client ready to use Redis DB'))
    .on('end', () => console.log('Client disconnected from Redis DB'))
    .on('error', (err) => console.log('Redis Client Error', err))

  await redisCluster.connect()
```

## Command Routing

### Commands that operate on Redis Keys

Commands such as `GET`, `SET`, etc. are routed by the first key specified. For example `MGET 1 2 3` will be routed by the key `1`.

### [Server Commands](https://redis.io/commands#server)

Admin commands such as `MEMORY STATS`, `FLUSHALL`, etc. are not attached to the cluster, and must be executed on a specific node via `.getSlotMaster()`.

### "Forwarded Commands"

Certain commands (e.g. `PUBLISH`) are forwarded to other cluster nodes by the Redis server. The client sends these commands to a random node in order to spread the load across the cluster.
