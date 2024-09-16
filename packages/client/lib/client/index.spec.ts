import { strict as assert } from 'assert';
import testUtils, { GLOBAL, waitTillBeenCalled } from '../test-utils';
import RedisClient, { RedisClientType } from '.';
import { RedisClientMultiCommandType } from './multi-command';
import { RedisCommandRawReply, RedisModules, RedisFunctions, RedisScripts } from '../commands';
import { AbortError, ClientClosedError, ClientOfflineError, ConnectionTimeoutError, DisconnectsClientError, ErrorReply, MultiErrorReply, SocketClosedUnexpectedlyError, WatchError } from '../errors';
import { defineScript } from '../lua-script';
import { spy } from 'sinon';
import { once } from 'events';
import { ClientKillFilters } from '../commands/CLIENT_KILL';
import { promisify } from 'util';

import {version} from '../../package.json';

export const SQUARE_SCRIPT = defineScript({
    SCRIPT: 'return ARGV[1] * ARGV[1];',
    NUMBER_OF_KEYS: 0,
    transformArguments(number: number): Array<string> {
        return [number.toString()];
    }
});

export const MATH_FUNCTION = {
    name: 'math',
    engine: 'LUA',
    code: `#!LUA name=math
        redis.register_function{
            function_name = "square",
            callback = function(keys, args) return args[1] * args[1] end,
            flags = { "no-writes" }
        }`,
    library: {
        square: {
            NAME: 'square',
            IS_READ_ONLY: true,
            NUMBER_OF_KEYS: 0,
            transformArguments(number: number): Array<string> {
                return [number.toString()];
            }
        }
    }
};

export async function loadMathFunction(
    client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>
): Promise<void> {
    await client.functionLoad(
        MATH_FUNCTION.code,
        { REPLACE: true }
    );
}

describe('Client', () => {
    describe('parseURL', () => {
        it('redis://user:secret@localhost:6379/0', () => {
            assert.deepEqual(
                RedisClient.parseURL('redis://user:secret@localhost:6379/0'),
                {
                    socket: {
                        host: 'localhost',
                        port: 6379,
                        tls: false
                    },
                    username: 'user',
                    password: 'secret',
                    database: 0
                }
            );
        });

        it('rediss://user:secret@localhost:6379/0', () => {
            assert.deepEqual(
                RedisClient.parseURL('rediss://user:secret@localhost:6379/0'),
                {
                    socket: {
                        host: 'localhost',
                        port: 6379,
                        tls: true
                    },
                    username: 'user',
                    password: 'secret',
                    database: 0
                }
            );
        });

        it('Invalid protocol', () => {
            assert.throws(
                () => RedisClient.parseURL('redi://user:secret@localhost:6379/0'),
                TypeError
            );
        });

        it('Invalid pathname', () => {
            assert.throws(
                () => RedisClient.parseURL('redis://user:secret@localhost:6379/NaN'),
                TypeError
            );
        });

        it('redis://localhost', () => {
            assert.deepEqual(
                RedisClient.parseURL('redis://localhost'),
                {
                    socket: {
                        host: 'localhost',
                        tls: false
                    }
                }
            );
        });
    });

    describe('parseOptions', () => {
        it('should throw error if tls socket option is set to true and the url protocol is "redis:"', () => {
            assert.throws(
                () => RedisClient.parseOptions({
                    url: 'redis://localhost',
                    socket: {
                        tls: true
                    }
                }),
                TypeError
            );
        });
        it('should throw error if tls socket option is set to false and the url protocol is "rediss:"', () => {
            assert.throws(
                () => RedisClient.parseOptions({
                    url: 'rediss://localhost',
                    socket: {
                        tls: false
                    }
                }),
                TypeError
            );
        });
        it('should not throw when tls socket option and url protocol matches"', () => {
            assert.equal(
                RedisClient.parseOptions({
                    url: 'rediss://localhost',
                    socket: {
                        tls: true
                    }
                }).socket.tls,
                true
            );
            assert.equal(
                RedisClient.parseOptions({
                    url: 'redis://localhost',
                    socket: {
                        tls: false
                    }
                }).socket.tls,
                false
            );
        });
    });

    describe('connect', () => {
        testUtils.testWithClient('connect should return the client instance', async client => {
            try {
                assert.equal(await client.connect(), client);
            } finally {
                if (client.isOpen) await client.disconnect();
            }
        }, {
            ...GLOBAL.SERVERS.PASSWORD,
            disableClientSetup: true
        });

        testUtils.testWithClient('should set default lib name and version', async client => {
            const clientInfo = await client.clientInfo();

            assert.equal(clientInfo.libName, 'node-redis');
            assert.equal(clientInfo.libVer, version);
        }, {
            ...GLOBAL.SERVERS.PASSWORD,
            minimumDockerVersion: [7, 2]
        });

        testUtils.testWithClient('disable sending lib name and version', async client => {
            const clientInfo = await client.clientInfo();

            assert.equal(clientInfo.libName, '');
            assert.equal(clientInfo.libVer, '');
        }, {
            ...GLOBAL.SERVERS.PASSWORD,
            clientOptions: {
                ...GLOBAL.SERVERS.PASSWORD.clientOptions,
                disableClientInfo: true
            },
            minimumDockerVersion: [7, 2]
        });

        testUtils.testWithClient('send client name tag', async client => {
            const clientInfo = await client.clientInfo();

            assert.equal(clientInfo.libName, 'node-redis(test)');
            assert.equal(clientInfo.libVer, version);
        }, {
            ...GLOBAL.SERVERS.PASSWORD,
            clientOptions: {
                ...GLOBAL.SERVERS.PASSWORD.clientOptions,
                clientInfoTag: "test"
            },
            minimumDockerVersion: [7, 2]
        });
    });

    describe('authentication', () => {
        testUtils.testWithClient('Client should be authenticated', async client => {
            assert.equal(
                await client.ping(),
                'PONG'
            );
        }, GLOBAL.SERVERS.PASSWORD);

        testUtils.testWithClient('should execute AUTH before SELECT', async client => {
            assert.equal(
                (await client.clientInfo()).db,
                2
            );
        }, {
            ...GLOBAL.SERVERS.PASSWORD,
            clientOptions: {
                ...GLOBAL.SERVERS.PASSWORD.clientOptions,
                database: 2
            },
            minimumDockerVersion: [6, 2]
        });
    });

    testUtils.testWithClient('should set connection name', async client => {
        assert.equal(
            await client.clientGetName(),
            'name'
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            name: 'name'
        }
    });

    describe('legacyMode', () => {
        testUtils.testWithClient('client.sendCommand should call the callback', async client => {
            assert.equal(
                await promisify(client.sendCommand).call(client, 'PING'),
                'PONG'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.sendCommand should work without callback', async client => {
            client.sendCommand(['PING']);
            await client.v4.ping(); // make sure the first command was replied
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.sendCommand should reply with error', async client => {
            await assert.rejects(
                promisify(client.sendCommand).call(client, '1', '2')
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.hGetAll should reply with error', async client => {
            await assert.rejects(
                promisify(client.hGetAll).call(client)
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.v4.sendCommand should return a promise', async client => {
            assert.equal(
                await client.v4.sendCommand(['PING']),
                'PONG'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.v4.{command} should return a promise', async client => {
            assert.equal(
                await client.v4.ping(),
                'PONG'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.{command} should accept vardict arguments', async client => {
            assert.equal(
                await promisify(client.set).call(client, 'a', 'b'),
                'OK'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.{command} should accept arguments array', async client => {
            assert.equal(
                await promisify(client.set).call(client, ['a', 'b']),
                'OK'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.{command} should accept mix of arrays and arguments', async client => {
            assert.equal(
                await promisify(client.set).call(client, ['a'], 'b', ['EX', 1]),
                'OK'
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.hGetAll should return object', async client => {
            await client.v4.hSet('key', 'field', 'value');
            
            assert.deepEqual(
                await promisify(client.hGetAll).call(client, 'key'),
                Object.create(null, {
                    field: {
                        value: 'value',
                        configurable: true,
                        enumerable: true
                    }
                })
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        function multiExecAsync<
            M extends RedisModules,
            F extends RedisFunctions,
            S extends RedisScripts
        >(multi: RedisClientMultiCommandType<M, F, S>): Promise<Array<RedisCommandRawReply>> {
            return new Promise((resolve, reject) => {
                (multi as any).exec((err: Error | undefined, replies: Array<RedisCommandRawReply>) => {
                    if (err) return reject(err);

                    resolve(replies);
                });
            });
        }

        testUtils.testWithClient('client.multi.ping.exec should call the callback', async client => {
            assert.deepEqual(
                await multiExecAsync(
                    client.multi().ping()
                ),
                ['PONG']
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.multi.ping.exec should call the callback', async client => {
            client.multi()
                .ping()
                .exec();
            await client.v4.ping(); // make sure the first command was replied
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.multi.ping.v4.ping.v4.exec should return a promise', async client => {
            assert.deepEqual(
                await client.multi()
                    .ping()
                    .v4.ping()
                    .v4.exec(),
                ['PONG', 'PONG']
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.{script} should return a promise', async client => {
            assert.equal(
                await client.square(2),
                4
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true,
                scripts: {
                    square: SQUARE_SCRIPT
                }
            }
        });

        testUtils.testWithClient('client.multi.{command}.exec should flatten array arguments', async client => {
            assert.deepEqual(
                await client.multi()
                    .sAdd('a', ['b', 'c'])
                    .v4.exec(),
                [2]
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });

        testUtils.testWithClient('client.multi.hGetAll should return object', async client => { 
            assert.deepEqual(
                await multiExecAsync(
                    client.multi()
                        .hSet('key', 'field', 'value')
                        .hGetAll('key')
                ),
                [
                    1,
                    Object.create(null, {
                        field: {
                            value: 'value',
                            configurable: true,
                            enumerable: true
                        }
                    })
                ]
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                legacyMode: true
            }
        });
    });

    describe('events', () => {
        testUtils.testWithClient('connect, ready, end', async client => {
            await Promise.all([
                once(client, 'connect'),
                once(client, 'ready'),
                client.connect()
            ]);

            await Promise.all([
                once(client, 'end'),
                client.disconnect()
            ]);
        }, {
            ...GLOBAL.SERVERS.OPEN,
            disableClientSetup: true
        });
    });

    describe('sendCommand', () => {
        testUtils.testWithClient('PING', async client => {
            assert.equal(await client.sendCommand(['PING']), 'PONG');
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('returnBuffers', async client => {
            assert.deepEqual(
                await client.sendCommand(['PING'], {
                    returnBuffers: true
                }),
                Buffer.from('PONG')
            );
        }, GLOBAL.SERVERS.OPEN);

        describe('AbortController', () => {
            before(function () {
                if (!global.AbortController) {
                    this.skip();
                }
            });

            testUtils.testWithClient('success', async client => {
                await client.sendCommand(['PING'], {
                    signal: new AbortController().signal
                });
            }, GLOBAL.SERVERS.OPEN);

            testUtils.testWithClient('AbortError', client => {
                const controller = new AbortController();
                controller.abort();

                return assert.rejects(
                    client.sendCommand(['PING'], {
                        signal: controller.signal
                    }),
                    AbortError
                );
            }, GLOBAL.SERVERS.OPEN);
        });

        testUtils.testWithClient('undefined and null should not break the client', async client => {
            await assert.rejects(
                client.sendCommand([null as any, undefined as any]),
                TypeError
            );

            assert.equal(
                await client.ping(),
                'PONG'
            );
        }, GLOBAL.SERVERS.OPEN);
    });

    describe('multi', () => {
        testUtils.testWithClient('simple', async client => {
            assert.deepEqual(
                await client.multi()
                    .ping()
                    .set('key', 'value')
                    .get('key')
                    .exec(),
                ['PONG', 'OK', 'value']
            );
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should reject the whole chain on error', client => {
            return assert.rejects(
                client.multi()
                    .ping()
                    .addCommand(['INVALID COMMAND'])
                    .ping()
                    .exec()
            );
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should reject the whole chain upon client disconnect', async client => {
            await client.disconnect();

            return assert.rejects(
                client.multi()
                    .ping()
                    .set('key', 'value')
                    .get('key')
                    .exec(),
                ClientClosedError
            );
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('with script', async client => {
            assert.deepEqual(
                await client.multi()
                    .square(2)
                    .exec(),
                [4]
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            clientOptions: {
                scripts: {
                    square: SQUARE_SCRIPT
                }
            }
        });

        testUtils.testWithClient('WatchError', async client => {
            await client.watch('key');

            await client.set(
                RedisClient.commandOptions({
                    isolated: true
                }),
                'key',
                '1'
            );

            await assert.rejects(
                client.multi()
                    .decr('key')
                    .exec(),
                WatchError
            );
        }, GLOBAL.SERVERS.OPEN);

        describe('execAsPipeline', () => {
            testUtils.testWithClient('exec(true)', async client => {
                assert.deepEqual(
                    await client.multi()
                        .ping()
                        .exec(true),
                    ['PONG']
                );
            }, GLOBAL.SERVERS.OPEN);

            testUtils.testWithClient('empty execAsPipeline', async client => {
                assert.deepEqual(
                    await client.multi().execAsPipeline(),
                    []
                );
            }, GLOBAL.SERVERS.OPEN);
        });

        testUtils.testWithClient('should remember selected db', async client => {
            await client.multi()
                .select(1)
                .exec();
            await killClient(client);
            assert.equal(
                (await client.clientInfo()).db,
                1
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            minimumDockerVersion: [6, 2] // CLIENT INFO
        });

        testUtils.testWithClient('should handle error replies (#2665)', async client => {
            await assert.rejects(
                client.multi()
                    .set('key', 'value')
                    .hGetAll('key')
                    .exec(),
                err => {
                    assert.ok(err instanceof MultiErrorReply);
                    assert.equal(err.replies.length, 2);
                    assert.deepEqual(err.errorIndexes, [1]);
                    assert.ok(err.replies[1] instanceof ErrorReply);
                    assert.deepEqual([...err.errors()], [err.replies[1]]);
                    return true;
                }
            );
        }, GLOBAL.SERVERS.OPEN);
    });

    testUtils.testWithClient('scripts', async client => {
        assert.equal(
            await client.square(2),
            4
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            scripts: {
                square: SQUARE_SCRIPT
            }
        }
    });

    const module = {
        echo: {
            transformArguments(message: string): Array<string> {
                return ['ECHO', message];
            },
            transformReply(reply: string): string {
                return reply;
            }
        }
    };

    testUtils.testWithClient('modules', async client => {
        assert.equal(
            await client.module.echo('message'),
            'message'
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            modules: {
                module
            }
        }
    });

    testUtils.testWithClient('functions', async client => {
        await loadMathFunction(client);

        assert.equal(
            await client.math.square(2),
            4
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        minimumDockerVersion: [7, 0],
        clientOptions: {
            functions: {
                math: MATH_FUNCTION.library
            }
        }
    });

    describe('isolationPool', () => {
        testUtils.testWithClient('executeIsolated', async client => {
            const id = await client.clientId(),
                isolatedId = await client.executeIsolated(isolatedClient => isolatedClient.clientId());
            assert.ok(id !== isolatedId);
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should be able to use pool even before connect', async client => {
            await client.executeIsolated(() => Promise.resolve());
            // make sure to destroy isolation pool
            await client.connect();
            await client.disconnect();
        }, {
            ...GLOBAL.SERVERS.OPEN,
            disableClientSetup: true
        });

        testUtils.testWithClient('should work after reconnect (#2406)', async client => {
            await client.disconnect();
            await client.connect();
            await client.executeIsolated(() => Promise.resolve());
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should throw ClientClosedError after disconnect', async client => {
            await client.connect();
            await client.disconnect();
            await assert.rejects(
                client.executeIsolated(() => Promise.resolve()),
                ClientClosedError
            );
        }, {
            ...GLOBAL.SERVERS.OPEN,
            disableClientSetup: true
        });
    });

    async function killClient<
        M extends RedisModules,
        F extends RedisFunctions,
        S extends RedisScripts
    >(
        client: RedisClientType<M, F, S>,
        errorClient: RedisClientType<M, F, S> = client
    ): Promise<void> {
        const onceErrorPromise = once(errorClient, 'error');
        await client.sendCommand(['QUIT']);
        await Promise.all([
            onceErrorPromise,
            assert.rejects(client.ping(), SocketClosedUnexpectedlyError)
        ]);
    }

    testUtils.testWithClient('should reconnect when socket disconnects', async client => {
        await killClient(client);
        await assert.doesNotReject(client.ping());
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('should remember selected db', async client => {
        await client.select(1);
        await killClient(client);
        assert.equal(
            (await client.clientInfo()).db,
            1
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        minimumDockerVersion: [6, 2] // CLIENT INFO
    });

    testUtils.testWithClient('should propagated errors from "isolated" clients', client => {
        client.on('error', () => {
            // ignore errors
        });
        return client.executeIsolated(isolated => killClient(isolated, client));
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('scanIterator', async client => {
        const promises = [],
            keys = new Set();
        for (let i = 0; i < 100; i++) {
            const key = i.toString();
            keys.add(key);
            promises.push(client.set(key, ''));
        }

        await Promise.all(promises);

        const results = new Set();
        for await (const key of client.scanIterator()) {
            results.add(key);
        }

        assert.deepEqual(keys, results);
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('hScanIterator', async client => {
        const hash: Record<string, string> = {};
        for (let i = 0; i < 100; i++) {
            hash[i.toString()] = i.toString();
        }

        await client.hSet('key', hash);

        const results: Record<string, string> = {};
        for await (const { field, value } of client.hScanIterator('key')) {
            results[field] = value;
        }

        assert.deepEqual(hash, results);
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('hScanNoValuesIterator', async client => {
        const hash: Record<string, string> = {};
        const expectedKeys: Array<string> = [];
        for (let i = 0; i < 100; i++) {
            hash[i.toString()] = i.toString();
            expectedKeys.push(i.toString());
        }

        await client.hSet('key', hash);

        const keys: Array<string> = [];
        for await (const key of client.hScanNoValuesIterator('key')) {
            keys.push(key);
        }

        function sort(a: string, b: string) {
            return Number(a) - Number(b);
        }

        assert.deepEqual(keys.sort(sort), expectedKeys);
    }, {
        ...GLOBAL.SERVERS.OPEN,
        minimumDockerVersion: [7, 4]
    });

    testUtils.testWithClient('sScanIterator', async client => {
        const members = new Set<string>();
        for (let i = 0; i < 100; i++) {
            members.add(i.toString());
        }

        await client.sAdd('key', Array.from(members));

        const results = new Set<string>();
        for await (const key of client.sScanIterator('key')) {
            results.add(key);
        }

        assert.deepEqual(members, results);
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('zScanIterator', async client => {
        const members = [];
        for (let i = 0; i < 100; i++) {
            members.push({
                score: 1,
                value: i.toString()
            });
        }

        await client.zAdd('key', members);

        const map = new Map<string, number>();
        for await (const member of client.zScanIterator('key')) {
            map.set(member.value, member.score);
        }

        type MemberTuple = [string, number];

        function sort(a: MemberTuple, b: MemberTuple) {
            return Number(b[0]) - Number(a[0]);
        }

        assert.deepEqual(
            [...map.entries()].sort(sort),
            members.map<MemberTuple>(member => [member.value, member.score]).sort(sort)
        );
    }, GLOBAL.SERVERS.OPEN);
    
    describe('PubSub', () => {
        testUtils.testWithClient('should be able to publish and subscribe to messages', async publisher => {
            function assertStringListener(message: string, channel: string) {
                assert.equal(typeof message, 'string');
                assert.equal(typeof channel, 'string');
            }

            function assertBufferListener(message: Buffer, channel: Buffer) {
                assert.ok(Buffer.isBuffer(message));
                assert.ok(Buffer.isBuffer(channel));
            }

            const subscriber = publisher.duplicate();

            await subscriber.connect();

            try {
                const channelListener1 = spy(assertBufferListener),
                    channelListener2 = spy(assertStringListener),
                    patternListener = spy(assertStringListener);

                await Promise.all([
                    subscriber.subscribe('channel', channelListener1, true),
                    subscriber.subscribe('channel', channelListener2),
                    subscriber.pSubscribe('channel*', patternListener)
                ]);
                await Promise.all([
                    waitTillBeenCalled(channelListener1),
                    waitTillBeenCalled(channelListener2),
                    waitTillBeenCalled(patternListener),
                    publisher.publish(Buffer.from('channel'), Buffer.from('message'))
                ]);

                assert.ok(channelListener1.calledOnceWithExactly(Buffer.from('message'), Buffer.from('channel')));
                assert.ok(channelListener2.calledOnceWithExactly('message', 'channel'));
                assert.ok(patternListener.calledOnceWithExactly('message', 'channel'));

                await subscriber.unsubscribe('channel', channelListener1, true);
                await Promise.all([
                    waitTillBeenCalled(channelListener2),
                    waitTillBeenCalled(patternListener),
                    publisher.publish('channel', 'message')
                ]);
                assert.ok(channelListener1.calledOnce);
                assert.ok(channelListener2.calledTwice);
                assert.ok(channelListener2.secondCall.calledWithExactly('message', 'channel'));
                assert.ok(patternListener.calledTwice);
                assert.ok(patternListener.secondCall.calledWithExactly('message', 'channel'));
                await subscriber.unsubscribe('channel');
                await Promise.all([
                    waitTillBeenCalled(patternListener),
                    publisher.publish('channel', 'message')
                ]);
                assert.ok(channelListener1.calledOnce);
                assert.ok(channelListener2.calledTwice);
                assert.ok(patternListener.calledThrice);
                assert.ok(patternListener.thirdCall.calledWithExactly('message', 'channel'));
                await subscriber.pUnsubscribe();
                await publisher.publish('channel', 'message');
                assert.ok(channelListener1.calledOnce);
                assert.ok(channelListener2.calledTwice);
                assert.ok(patternListener.calledThrice);
                // should be able to send commands when unsubsribed from all channels (see #1652)
                await assert.doesNotReject(subscriber.ping());
            } finally {
                await subscriber.disconnect();
            }
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should resubscribe', async publisher => {
            const subscriber = publisher.duplicate();

            await subscriber.connect();

            try {
                const channelListener = spy();
                await subscriber.subscribe('channel', channelListener);

                const patternListener = spy();
                await subscriber.pSubscribe('channe*', patternListener);

                await Promise.all([
                    once(subscriber, 'error'),
                    publisher.clientKill({
                        filter: ClientKillFilters.SKIP_ME,
                        skipMe: true
                    })
                ]);

                await once(subscriber, 'ready');

                await Promise.all([
                    waitTillBeenCalled(channelListener),
                    waitTillBeenCalled(patternListener),
                    publisher.publish('channel', 'message')
                ]);
            } finally {
                await subscriber.disconnect();
            }
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should not fail when message arrives right after subscribe', async publisher => {
            const subscriber = publisher.duplicate();

            await subscriber.connect();

            try {
                await assert.doesNotReject(Promise.all([
                    subscriber.subscribe('channel', () => {
                        // noop
                    }),
                    publisher.publish('channel', 'message')
                ]));
            } finally {
                await subscriber.disconnect();
            }
        }, GLOBAL.SERVERS.OPEN);

        testUtils.testWithClient('should be able to quit in PubSub mode', async client => {
            await client.subscribe('channel', () => {
                // noop
            });

            await assert.doesNotReject(client.quit());

            assert.equal(client.isOpen, false);
        }, GLOBAL.SERVERS.OPEN);
    });

    testUtils.testWithClient('ConnectionTimeoutError', async client => {
        const promise = assert.rejects(client.connect(), ConnectionTimeoutError),
            start = process.hrtime.bigint();

        while (process.hrtime.bigint() - start < 1_000_000) {
            // block the event loop for 1ms, to make sure the connection will timeout
        }

        await promise;
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            socket: {
                connectTimeout: 1
            }
        },
        disableClientSetup: true
    });

    testUtils.testWithClient('client.quit', async client => {
        await client.connect();

        const pingPromise = client.ping(),
            quitPromise = client.quit();
        assert.equal(client.isOpen, false);

        const [ping, quit] = await Promise.all([
            pingPromise,
            quitPromise,
            assert.rejects(client.ping(), ClientClosedError)
        ]);

        assert.equal(ping, 'PONG');
        assert.equal(quit, 'OK');
    }, {
        ...GLOBAL.SERVERS.OPEN,
        disableClientSetup: true
    });

    testUtils.testWithClient('client.disconnect', async client => {
        const pingPromise = client.ping(),
            disconnectPromise = client.disconnect();
        assert.equal(client.isOpen, false);
        await Promise.all([
            assert.rejects(pingPromise, DisconnectsClientError),
            assert.doesNotReject(disconnectPromise),
            assert.rejects(client.ping(), ClientClosedError)
        ]);
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('should be able to connect after disconnect (see #1801)', async client => {
        await client.disconnect();
        await client.connect();
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('should be able to use ref and unref', client => {
        client.unref();
        client.ref();
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('pingInterval', async client => {
        assert.deepEqual(
            await once(client, 'ping-interval'),
            ['PONG']
        );
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            pingInterval: 1
        }
    });

    testUtils.testWithClient('should reject commands in connect phase when `disableOfflineQueue`', async client => {
        const connectPromise = client.connect();
        await assert.rejects(
            client.ping(),
            ClientOfflineError
        );
        await connectPromise;
        await client.disconnect();
    }, {
        ...GLOBAL.SERVERS.OPEN,
        clientOptions: {
            disableOfflineQueue: true
        },
        disableClientSetup: true
    });
});
