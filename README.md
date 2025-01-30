# Node-Redis

[![Tests](https://img.shields.io/github/actions/workflow/status/redis/node-redis/tests.yml?branch=master)](https://github.com/redis/node-redis/actions/workflows/tests.yml)
[![Coverage](https://codecov.io/gh/redis/node-redis/branch/master/graph/badge.svg?token=xcfqHhJC37)](https://codecov.io/gh/redis/node-redis)
[![License](https://img.shields.io/github/license/redis/node-redis.svg)](https://github.com/redis/node-redis/blob/master/LICENSE)

[![Discord](https://img.shields.io/discord/697882427875393627.svg?style=social&logo=discord)](https://discord.gg/redis)
[![Twitch](https://img.shields.io/twitch/status/redisinc?style=social)](https://www.twitch.tv/redisinc)
[![YouTube](https://img.shields.io/youtube/channel/views/UCD78lHSwYqMlyetR0_P4Vig?style=social)](https://www.youtube.com/redisinc)
[![Twitter](https://img.shields.io/twitter/follow/redisinc?style=social)](https://twitter.com/redisinc)

node-redis is a modern, high performance [Redis](https://redis.io) client for Node.js.

## How do I Redis?

[Learn for free at Redis University](https://university.redis.com/)

[Build faster with the Redis Launchpad](https://launchpad.redis.com/)

[Try the Redis Cloud](https://redis.com/try-free/)

[Dive in developer tutorials](https://developer.redis.com/)

[Join the Redis community](https://redis.com/community/)

[Work at Redis](https://redis.com/company/careers/jobs/)

## Installation

Start a redis-server via docker (or any other method you prefer):

```bash
docker run -p 6379:6379 -it redis/redis-stack-server:latest
```

To install node-redis, simply:

```bash
npm install redis
```

> "redis" is the "whole in one" package that includes all the other packages. If you only need a subset of the commands, you can install the individual packages. See the list below.

## Packages

| Name                                           | Description                                                                                 |
|------------------------------------------------|---------------------------------------------------------------------------------------------|
| [`redis`](./packages/redis)                    | The client with all the ["redis-stack"](https://github.com/redis-stack/redis-stack) modules |
| [`@redis/client`](./packages/client)           | The base clients (i.e `RedisClient`, `RedisCluster`, etc.)                                  |
| [`@redis/bloom`](./packages/bloom)             | [Redis Bloom](https://redis.io/docs/data-types/probabilistic/) commands                     |
| [`@redis/graph`](./packages/graph)             | [Redis Graph](https://redis.io/docs/data-types/probabilistic/) commands                     |
| [`@redis/json`](./packages/json)               | [Redis JSON](https://redis.io/docs/data-types/json/) commands                               |
| [`@redis/search`](./packages/search)           | [RediSearch](https://redis.io/docs/interact/search-and-query/) commands                     |
| [`@redis/time-series`](./packages/time-series) | [Redis Time-Series](https://redis.io/docs/data-types/timeseries/) commands                  |
| [`@redis/entraid`](./packages/entraid)         |  Secure token-based authentication for Redis clients using Microsoft Entra ID               |

> Looking for a high-level library to handle object mapping? See [redis-om-node](https://github.com/redis/redis-om-node)!

## Contributing

If you'd like to contribute, check out the [contributing guide](CONTRIBUTING.md).

Thank you to all the people who already contributed to Node Redis!

[![Contributors](https://contrib.rocks/image?repo=redis/node-redis)](https://github.com/redis/node-redis/graphs/contributors)

## License

This repository is licensed under the "MIT" license. See [LICENSE](LICENSE).
