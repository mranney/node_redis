import { strict as assert } from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { WatchError } from "../errors";
import { RedisSentinelConfig, SentinelFramework } from "./test-util";
import { RedisNode, RedisSentinelClientType, RedisSentinelEvent, RedisSentinelType } from "./types";
import { RedisSentinelFactory } from '.';
import { RedisClientType } from '../client';
import { RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping, NumberReply } from '../RESP/types';

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { RESP_TYPES } from '../RESP/decoder';
import { MATH_FUNCTION } from '../commands/FUNCTION_LOAD.spec';
import RedisBloomModules from '@redis/bloom';
import { BasicPooledClientSideCache } from '../client/cache';
import { RedisTcpSocketOptions } from '../client/socket';
import { SQUARE_SCRIPT } from '../client/index.spec';
import { once } from 'node:events';

const execAsync = promisify(exec);

/* used to ensure test environment resets to normal state
   i.e. 
   - all redis nodes are active and are part of the topology
   before allowing things to continue.
*/

async function steadyState(frame: SentinelFramework) {
  let checkedMaster = false;
  let checkedReplicas = false;
  while (!checkedMaster || !checkedReplicas) {
    if (!checkedMaster) {
      const master = await frame.sentinelMaster();
      if (master?.flags === 'master') {
        checkedMaster = true;
      }
    }

    if (!checkedReplicas) {
      const replicas = (await frame.sentinelReplicas());
      checkedReplicas = true;
      for (const replica of replicas!) {
        checkedReplicas &&= (replica.flags === 'slave');
      }
    }
  }

  let nodeResolve, nodeReject;
  const nodePromise = new Promise((res, rej) => {
    nodeResolve = res;
    nodeReject = rej;
  })

  const seenNodes = new Set<number>();
  let sentinel: RedisSentinelType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> | undefined;
  const tracer = [];

  try {
    sentinel = frame.getSentinelClient({ replicaPoolSize: 1, scanInterval: 2000 }, false)
      .on('topology-change', (event: RedisSentinelEvent) => {
        if (event.type == "MASTER_CHANGE" || event.type == "REPLICA_ADD") {
          seenNodes.add(event.node.port);
          if (seenNodes.size == frame.getAllNodesPort().length) {
            nodeResolve();
          }
        }
      }).on('error', err => { });
    sentinel.setTracer(tracer);
    await sentinel.connect();

    await nodePromise;
    
    await sentinel.flushAll();
  } finally {
    if (sentinel !== undefined) {
      sentinel.destroy();
    }
  }
}

["redis-sentinel-test-password", undefined].forEach(function (password) {
  describe(`Sentinel - password = ${password}`, () => {
    const config: RedisSentinelConfig = { sentinelName: "test", numberOfNodes: 3, password: password };
    const frame = new SentinelFramework(config);
    let tracer = new Array<string>();
    let stopMeasuringBlocking = false;
    let longestDelta = 0;
    let longestTestDelta = 0;
    let last: number;
  
    before(async function () {
      this.timeout(15000);
  
      last = Date.now();
  
      function deltaMeasurer() {
        const delta = Date.now() - last;
        if (delta > longestDelta) {
          longestDelta = delta;
        }
        if (delta > longestTestDelta) {
          longestTestDelta = delta;
        }
        if (!stopMeasuringBlocking) {
          last = Date.now();
          setImmediate(deltaMeasurer);
        }
      }

      setImmediate(deltaMeasurer);

      await frame.spawnRedisSentinel();
    });
  
    after(async function () {
      this.timeout(15000);
  
      stopMeasuringBlocking = true;
  
      await frame.cleanup();
    })
  
    describe('Sentinel Client', function () {
      let sentinel: RedisSentinelType<    RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> | undefined;
  
      beforeEach(async function () {
        this.timeout(0);
  
        await frame.getAllRunning();

        await steadyState(frame);
        longestTestDelta = 0;
      })
  
      afterEach(async function () {
        this.timeout(30000);

        // avoid errors in afterEach that end testing
        if (sentinel !== undefined) {
          sentinel.on('error', () => { });
        }
 
        if (this!.currentTest!.state === 'failed') {          
          console.log(`longest event loop blocked delta: ${longestDelta}`);
          console.log(`longest event loop blocked in failing test: ${longestTestDelta}`);
          console.log("trace:");
          for (const line of tracer) {
            console.log(line);
          }
          console.log(`sentinel object state:`)
          console.log(`master: ${JSON.stringify(sentinel?.getMasterNode())}`)
          console.log(`replicas: ${JSON.stringify(sentinel?.getReplicaNodes().entries)}`)
          const results = await Promise.all([
            frame.sentinelSentinels(),
            frame.sentinelMaster(),
            frame.sentinelReplicas()
          ])
          console.log(`sentinel sentinels:\n${JSON.stringify(results[0], undefined, '\t')}`);
          console.log(`sentinel master:\n${JSON.stringify(results[1], undefined, '\t')}`);
          console.log(`sentinel replicas:\n${JSON.stringify(results[2], undefined, '\t')}`);
          const { stdout, stderr } = await execAsync("docker ps -a");
          console.log(`docker stdout:\n${stdout}`);

          const ids = frame.getAllDockerIds();
          console.log("docker logs");

          for (const [id, port] of ids) {
            console.log(`${id}/${port}\n`);
            const { stdout, stderr } = await execAsync(`docker logs ${id}`, {maxBuffer: 8192 * 8192 * 4});
            console.log(stdout);
          }
        }
        tracer.length = 0;
  
        if (sentinel !== undefined) {
          await sentinel.destroy();
          sentinel = undefined;
        }
      })
  
      it('basic bootstrap', async function () {
        sentinel = frame.getSentinelClient();
        await sentinel.connect();

        await assert.doesNotReject(sentinel.set('x', 1));

      });
  
      it('basic teardown worked', async function () {
        const nodePorts = frame.getAllNodesPort();
        const sentinelPorts = frame.getAllSentinelsPort();
  
        assert.notEqual(nodePorts.length, 0);
        assert.notEqual(sentinelPorts.length, 0);
  
        sentinel = frame.getSentinelClient();
        await sentinel.connect();
  
        await assert.doesNotReject(sentinel.get('x'));
      });
  
      it('try to connect multiple times', async function () {
        sentinel = frame.getSentinelClient();
        const connectPromise = sentinel.connect();
        await assert.rejects(sentinel.connect());
        await connectPromise;
      });
  
      it('with type mapping', async function () {
        const commandOptions = {
          typeMapping: {
            [RESP_TYPES.SIMPLE_STRING]: Buffer
          }
        }
        sentinel = frame.getSentinelClient({ commandOptions: commandOptions });
        await sentinel.connect();
  
        const resp = await sentinel.ping();
        assert.deepEqual(resp, Buffer.from('PONG'))
      })
  
      it('with a script', async function () {  
        const options = {
          scripts: {
            square: SQUARE_SCRIPT
          }
        }
  
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        const [, reply] = await Promise.all([
          sentinel.set('key', '2'),
          sentinel.square('key')
        ]);
  
        assert.equal(reply, 4);
      })

      it('multi with a script', async function () {
        const options = {
          scripts: {
            square: SQUARE_SCRIPT
          }
        }
  
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();

        const reply = await sentinel.multi().set('key', 2).square('key').exec();

        assert.deepEqual(reply, ['OK', 4]);
      })
  
      it('with a function', async function () {
        const options = {
          functions: {
            math: MATH_FUNCTION.library
          }
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        await sentinel.functionLoad(
          MATH_FUNCTION.code,
          { REPLACE: true }
        );
  
        await sentinel.set('key', '2');
        const resp = await sentinel.math.square('key');
  
        assert.equal(resp, 4);
      })

      it('multi with a function', async function () {
        const options = {
          functions: {
            math: MATH_FUNCTION.library
          }
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        await sentinel.functionLoad(
          MATH_FUNCTION.code,
          { REPLACE: true }
        );

        const reply = await sentinel.multi().set('key', 2).math.square('key').exec();
        assert.deepEqual(reply, ['OK', 4]);
      })
  
      it('with a module', async function () {
        const options = {
          modules: RedisBloomModules
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        const resp = await sentinel.bf.add('key', 'item')
        assert.equal(resp, true);
      })

      it('multi with a module', async function () {
        const options = {
          modules: RedisBloomModules
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        const resp = await sentinel.multi().bf.add('key', 'item').exec();
        assert.deepEqual(resp, [true]);
      })
  
      it('many readers', async function () {
        this.timeout(10000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 8 });
        await sentinel.connect();
  
        await sentinel.set("x", 1);
        for (let i = 0; i < 10; i++) {
          if (await sentinel.get("x") == "1") {
            break;
          }
          await setTimeout(1000);
        }
  
        const promises: Array<Promise<string | null>> = [];
        for (let i = 0; i < 500; i++) {
          promises.push(sentinel.get("x"));
        }
  
        const resp = await Promise.all(promises);
        assert.equal(resp.length, 500);
        for (let i = 0; i < 500; i++) {
          assert.equal(resp[i], "1", `failed on match at ${i}`);
        }
      });
  
      it('use', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 1 });
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        await sentinel.use(
          async (client: RedisSentinelClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>, ) => {
            const masterNode = sentinel!.getMasterNode();
            await frame.stopNode(masterNode!.port.toString());
            await assert.doesNotReject(client.get('x'));
          }
        );
      });
  
      it('use with script', async function () {
        this.timeout(10000);
  
        const options = {
          scripts: {
            square: SQUARE_SCRIPT
          }
        }
  
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        const reply = await sentinel.use(
          async (client: RedisSentinelClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => {
            assert.equal(await client.set('key', '2'), 'OK');
            assert.equal(await client.get('key'), '2');
            return client.square('key')
          }
        );
  
        assert.equal(reply, 4);
      })
  
      it('use with a function', async function () {
        this.timeout(10000);
  
        const options = {
          functions: {
            math: MATH_FUNCTION.library
          }
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        await sentinel.functionLoad(
          MATH_FUNCTION.code,
          { REPLACE: true }
        );
  
        const reply = await sentinel.use(
          async (client: RedisSentinelClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => {
            await client.set('key', '2');
            return client.math.square('key');
          }
        );
  
        assert.equal(reply, 4);
      })
  
      it('use with a module', async function () {
        const options = {
          modules: RedisBloomModules
        }
        sentinel = frame.getSentinelClient(options);
        await sentinel.connect();
  
        const reply = await sentinel.use(
          async (client: RedisSentinelClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping>) => {
            return client.bf.add('key', 'item');
          }
        );
  
        assert.equal(reply, true);
      })
  
      it('block on pool', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 1 });
        sentinel.on("error", () => { });
        await sentinel.connect();

        const promise = sentinel.use(
          async client => {
            await setTimeout(1000);
            return await client.get("x");
          }
        )
        
        await sentinel.set("x", 1);
        assert.equal(await promise, null);
      });

      it('reserve client, takes a client out of pool', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2, reserveClient: true });
        await sentinel.connect();

        const promise1 = sentinel.use(
          async client => {
            const val = await client.get("x");
            await client.set("x", 2);
            return val;
          }
        )

        const promise2 = sentinel.use(
          async client => {
            return client.get("x");
          }
        )

        await sentinel.set("x", 1);
        assert.equal(await promise1, "1");
        assert.equal(await promise2, "2");
      })
  
      it('multiple clients', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        let set = false;
  
        const promise = sentinel.use(
          async client => {
            await sentinel!.set("x", 1);
            await client.get("x");
          }
        )
  
        await assert.doesNotReject(promise);
      });
  
      // by taking a lease, we know we will block on master as no clients are available, but as read occuring, means replica read occurs
      it('replica reads', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 1 });
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        const clientLease = await sentinel.aquire();
        clientLease.set('x', 456);
  
        let matched = false;
        /* waits for replication */
        for (let i = 0; i < 15; i++) {
          try {
            assert.equal(await sentinel.get("x"), '456');
            matched = true;
            break;
          } catch (err) {
            await setTimeout(1000);
          }
        }
  
        clientLease.release();
  
        assert.equal(matched, true);
      });
  
      it('pipeline', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 1 });
        await sentinel.connect();
  
        const resp = await sentinel.multi().set('x', 1).get('x').execAsPipeline();
  
        assert.deepEqual(resp, ['OK', '1']);
      })
  
      it('use - watch - clean', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        await sentinel.connect();
  
        let promise = sentinel.use(async (client) => {
          await client.set("x", 1);
          await client.watch("x");
          return client.multi().get("x").exec();
        });
  
        assert.deepEqual(await promise, ['1']);
      });
  
      it('use - watch - dirty', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        await sentinel.connect();
  
        let promise = sentinel.use(async (client) => {
          await client.set('x', 1);
          await client.watch('x');
          await sentinel!.set('x', 2);
          return client.multi().get('x').exec();
        });
  
        await assert.rejects(promise, new WatchError());
      });
  
      it('lease - watch - clean', async function () {
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        await sentinel.connect();
  
        const leasedClient = await sentinel.aquire();
        await leasedClient.set('x', 1);
        await leasedClient.watch('x');
        assert.deepEqual(await leasedClient.multi().get('x').exec(), ['1'])
      });
  
      it('lease - watch - dirty', async function () {
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        await sentinel.connect();
  
        const leasedClient = await sentinel.aquire();
        await leasedClient.set('x', 1);
        await leasedClient.watch('x');
        await leasedClient.set('x', 2);
  
        await assert.rejects(leasedClient.multi().get('x').exec(), new WatchError());
      });
  
  
      it('watch does not carry through leases', async function () {
        this.timeout(10000);
        sentinel = frame.getSentinelClient();
        await sentinel.connect();
 
        // each of these commands is an independent lease
        assert.equal(await sentinel.use(client => client.watch("x")), 'OK')
        assert.equal(await sentinel.use(client => client.set('x', 1)), 'OK');
        assert.deepEqual(await sentinel.use(client => client.multi().get('x').exec()), ['1']);
      });
  
      // stops master to force sentinel to update 
      it('stop master', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        tracer.push(`connected`);
  
        let masterChangeResolve;
        const masterChangePromise = new Promise((res) => {
          masterChangeResolve = res;
        })
  
        const masterNode = await sentinel.getMasterNode();
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            tracer.push(`got expected master change event`);
            masterChangeResolve(event.node);
          }
        });
  
        tracer.push(`stopping master node`);
        await frame.stopNode(masterNode!.port.toString());
        tracer.push(`stopped master node`);
  
        tracer.push(`waiting on master change promise`);
        const newMaster = await masterChangePromise as RedisNode;
        tracer.push(`got new master node of ${newMaster.port}`);
        assert.notEqual(masterNode!.port, newMaster.port);
      });
  
      // if master changes, client should make sure user knows watches are invalid
      it('watch across master change', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        tracer.push("connected");
  
        const client = await sentinel.aquire();
        tracer.push("aquired lease");
  
        await client.set("x", 1);
        await client.watch("x");
  
        tracer.push("did a watch on lease");
  
        let resolve;
        const promise = new Promise((res) => {
          resolve = res;
        })
  
        const masterNode = sentinel.getMasterNode();
        tracer.push(`got masterPort as ${masterNode!.port}`);
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            tracer.push("resolving promise");
            resolve(event.node);
          }
        });
  
        tracer.push("stopping master node");
        await frame.stopNode(masterNode!.port.toString());
        tracer.push("stopped master node and waiting on promise");
  
        const newMaster = await promise as RedisNode;
        tracer.push(`promise returned, newMaster = ${JSON.stringify(newMaster)}`);
        assert.notEqual(masterNode!.port, newMaster.port);
        tracer.push(`newMaster does not equal old master`);
  
        tracer.push(`waiting to assert that a multi/exec now fails`);
        await assert.rejects(async () => { await client.multi().get("x").exec() }, new Error("sentinel config changed in middle of a WATCH Transaction"));
        tracer.push(`asserted that a multi/exec now fails`);
      });
  
      // same as above, but set a watch before and after master change, shouldn't change the fact that watches are invalid
      it('watch before and after master change', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ masterPoolSize: 2 });
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
        tracer.push("connected");
  
        const client = await sentinel.aquire();
        tracer.push("got leased client");
        await client.set("x", 1);
        await client.watch("x");
  
        tracer.push("set and watched x");
  
        let resolve;
        const promise = new Promise((res) => {
          resolve = res;
        })
  
        const masterNode = sentinel.getMasterNode();
        tracer.push(`initial masterPort = ${masterNode!.port} `);
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            tracer.push("got a master change event that is not the same as before");
            resolve(event.node);
          }
        });
  
        tracer.push("stopping master");
        await frame.stopNode(masterNode!.port.toString());
        tracer.push("stopped master");
  
        tracer.push("waiting on master change promise");
        const newMaster = await promise as RedisNode;
        tracer.push(`got master change port as ${newMaster.port}`);
        assert.notEqual(masterNode!.port, newMaster.port);
  
        tracer.push("watching again, shouldn't matter");
        await client.watch("y");
  
        tracer.push("expecting multi to be rejected");
        await assert.rejects(async () => { await client.multi().get("x").exec() }, new Error("sentinel config changed in middle of a WATCH Transaction"));
        tracer.push("multi was rejected");
      });
  
      it('plain pubsub - channel', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        await sentinel.connect();
        tracer.push(`connected`);
  
        let pubSubResolve;
        const pubSubPromise = new Promise((res) => {
          pubSubResolve = res;
        });
  
        let tester = false;
        await sentinel.subscribe('test', () => {
          tracer.push(`got pubsub message`);
          tester = true;
          pubSubResolve(1);
        })
  
        tracer.push(`publishing pubsub message`);
        await sentinel.publish('test', 'hello world');
        tracer.push(`waiting on pubsub promise`);
        await pubSubPromise;
        tracer.push(`got pubsub promise`);
        assert.equal(tester, true);
  
        // now unsubscribe
        tester = false
        tracer.push(`unsubscribing pubsub listener`);
        await sentinel.unsubscribe('test')
        tracer.push(`pubishing pubsub message`);
        await sentinel.publish('test', 'hello world');
        await setTimeout(1000);
  
        tracer.push(`ensuring pubsub was unsubscribed via an assert`);
        assert.equal(tester, false);
      });
  
      it('plain pubsub - pattern', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        await sentinel.connect();
        tracer.push(`connected`);
  
        let pubSubResolve;
        const pubSubPromise = new Promise((res) => {
          pubSubResolve = res;
        });
  
        let tester = false;
        await sentinel.pSubscribe('test*', () => {
          tracer.push(`got pubsub message`);
          tester = true;
          pubSubResolve(1);
        })
  
        tracer.push(`publishing pubsub message`);
        await sentinel.publish('testy', 'hello world');
        tracer.push(`waiting on pubsub promise`);
        await pubSubPromise;
        tracer.push(`got pubsub promise`);
        assert.equal(tester, true);
  
        // now unsubscribe
        tester = false
        tracer.push(`unsubscribing pubsub listener`);
        await sentinel.pUnsubscribe('test*');
        tracer.push(`pubishing pubsub message`);
        await sentinel.publish('testy', 'hello world');
        await setTimeout(1000);
  
        tracer.push(`ensuring pubsub was unsubscribed via an assert`);
        assert.equal(tester, false);
      });
  
      // pubsub continues to work, even with a master change
      it('pubsub - channel - with master change', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
        tracer.push(`connected`);
  
        let pubSubResolve;
        const pubSubPromise = new Promise((res) => {
          pubSubResolve = res;
        })
  
        let tester = false;
        await sentinel.subscribe('test', () => {
          tracer.push(`got pubsub message`);
          tester = true;
          pubSubResolve(1);
        })
  
        let masterChangeResolve;
        const masterChangePromise = new Promise((res) => {
          masterChangeResolve = res;
        })
  
        const masterNode = sentinel.getMasterNode();
        tracer.push(`got masterPort as ${masterNode!.port}`);
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            tracer.push("got a master change event that is not the same as before");
            masterChangeResolve(event.node);
          }
        });
  
        tracer.push("stopping master");
        await frame.stopNode(masterNode!.port.toString());
        tracer.push("stopped master and waiting on change promise");
  
        const newMaster = await masterChangePromise as RedisNode;
        tracer.push(`got master change port as ${newMaster.port}`);
        assert.notEqual(masterNode!.port, newMaster.port);
  
        tracer.push(`publishing pubsub message`);
        await sentinel.publish('test', 'hello world');
        tracer.push(`published pubsub message and waiting pn pubsub promise`);
        await pubSubPromise;
        tracer.push(`got pubsub promise`);
  
        assert.equal(tester, true);
  
        // now unsubscribe
        tester = false
        await sentinel.unsubscribe('test')
        await sentinel.publish('test', 'hello world');
        await setTimeout(1000);
  
        assert.equal(tester, false);
      });
  
      it('pubsub - pattern - with master change', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
        tracer.push(`connected`);
  
        let pubSubResolve;
        const pubSubPromise = new Promise((res) => {
          pubSubResolve = res;
        })
  
        let tester = false;
        await sentinel.pSubscribe('test*', () => {
          tracer.push(`got pubsub message`);
          tester = true;
          pubSubResolve(1);
        })
  
        let masterChangeResolve;
        const masterChangePromise = new Promise((res) => {
          masterChangeResolve = res;
        })
  
        const masterNode = sentinel.getMasterNode();
        tracer.push(`got masterPort as ${masterNode!.port}`);
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            tracer.push("got a master change event that is not the same as before");
            masterChangeResolve(event.node);
          }
        });
  
        tracer.push("stopping master");
        await frame.stopNode(masterNode!.port.toString());
        tracer.push("stopped master and waiting on master change promise");
  
        const newMaster = await masterChangePromise as RedisNode;
        tracer.push(`got master change port as ${newMaster.port}`);
        assert.notEqual(masterNode!.port, newMaster.port);
  
        tracer.push(`publishing pubsub message`);
        await sentinel.publish('testy', 'hello world');
        tracer.push(`published pubsub message and waiting on pubsub promise`);
        await pubSubPromise;
        tracer.push(`got pubsub promise`);
        assert.equal(tester, true);
  
        // now unsubscribe
        tester = false
        await sentinel.pUnsubscribe('test*');
        await sentinel.publish('testy', 'hello world');
        await setTimeout(1000);
  
        assert.equal(tester, false);
      });
  
      // if we stop a node, the comand should "retry" until we reconfigure topology and execute on new topology
      it('command immeaditely after stopping master', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
  
        tracer.push("connected");
  
        let masterChangeResolve;
        const masterChangePromise = new Promise((res) => {
          masterChangeResolve = res;
        })
  
        const masterNode = sentinel.getMasterNode();
        tracer.push(`original master port = ${masterNode!.port}`);
  
        let changeCount = 0;
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "MASTER_CHANGE" && event.node.port != masterNode!.port) {
            changeCount++;
            tracer.push(`got topology-change event we expected`);
            masterChangeResolve(event.node);
          }
        });
  
        tracer.push(`stopping masterNode`);
        await frame.stopNode(masterNode!.port.toString());
        tracer.push(`stopped masterNode`);
        assert.equal(await sentinel.set('x', 123), 'OK');
        tracer.push(`did the set operation`);
        const presumamblyNewMaster = sentinel.getMasterNode();
        tracer.push(`new master node seems to be ${presumamblyNewMaster?.port} and waiting on master change promise`);
  
        const newMaster = await masterChangePromise as RedisNode;
        tracer.push(`got new masternode event saying master is at ${newMaster.port}`);
        assert.notEqual(masterNode!.port, newMaster.port);
  
        tracer.push(`doing the get`);
        const val = await sentinel.get('x');
        tracer.push(`did the get and got ${val}`);
        const newestMaster = sentinel.getMasterNode()
        tracer.push(`after get, we see master as ${newestMaster?.port}`);
  
        switch (changeCount) {
          case 1:
            // if we only changed masters once, we should have the proper value
            assert.equal(val, '123');
            break;
          case 2:
            // we changed masters twice quickly, so probably didn't replicate
            // therefore, this is soewhat flakey, but the above is the common case
            assert(val == '123' || val == null);
            break;
          default:
            assert(false, "unexpected case");
        }
      });
  
      it('shutdown sentinel node', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient();
        sentinel.setTracer(tracer);
        sentinel.on("error", () => { });
        await sentinel.connect();
        tracer.push("connected");
  
        let sentinelChangeResolve;
        const sentinelChangePromise = new Promise((res) => {
          sentinelChangeResolve = res;
        })
  
        const sentinelNode = sentinel.getSentinelNode();
        tracer.push(`sentinelNode = ${sentinelNode?.port}`)
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "SENTINEL_CHANGE") {
            tracer.push("got sentinel change event");
            sentinelChangeResolve(event.node);
          }
        });
  
        tracer.push("Stopping sentinel node");
        await frame.stopSentinel(sentinelNode!.port.toString());
        tracer.push("Stopped sentinel node and waiting on sentinel change promise");
        const newSentinel = await sentinelChangePromise as RedisNode;
        tracer.push("got sentinel change promise");
        assert.notEqual(sentinelNode!.port, newSentinel.port);
      });
  
      it('timer works, and updates sentinel list', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ scanInterval: 1000 });
        sentinel.setTracer(tracer);
        await sentinel.connect();
        tracer.push("connected");
  
        let sentinelChangeResolve;
        const sentinelChangePromise = new Promise((res) => {
          sentinelChangeResolve = res;
        })
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "SENTINE_LIST_CHANGE" && event.size == 4) {
            tracer.push(`got sentinel list change event with right size`);
            sentinelChangeResolve(event.size);
          }
        });
  
        tracer.push(`adding sentinel`);
        await frame.addSentinel();
        tracer.push(`added sentinel and waiting on sentinel change promise`);
        const newSentinelSize = await sentinelChangePromise as number;
  
        assert.equal(newSentinelSize, 4);
      });
  
      it('stop replica, bring back replica', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ replicaPoolSize: 1 });
        sentinel.setTracer(tracer);
        sentinel.on('error', err => { });
        await sentinel.connect();
        tracer.push("connected");
  
        let sentinelRemoveResolve;
        const sentinelRemovePromise = new Promise((res) => {
          sentinelRemoveResolve = res;
        })
  
        const replicaPort = await frame.getRandonNonMasterNode();

        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "REPLICA_REMOVE") {
            if (event.node.port.toString() == replicaPort) {
              tracer.push("got expected replica removed event");
              sentinelRemoveResolve(event.node);
            } else {
              tracer.push(`got replica removed event for a different node: ${event.node.port}`);
            }
          }
        });
  
        tracer.push(`replicaPort = ${replicaPort} and stopping it`);
        await frame.stopNode(replicaPort);
        tracer.push("stopped replica and waiting on sentinel removed promise");
        const stoppedNode = await sentinelRemovePromise as RedisNode;
        tracer.push("got removed promise");
        assert.equal(stoppedNode.port, Number(replicaPort));
  
        let sentinelRestartedResolve;
        const sentinelRestartedPromise = new Promise((res) => {
          sentinelRestartedResolve = res;
        })
  
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "REPLICA_ADD") {
            tracer.push("got replica added event");
            sentinelRestartedResolve(event.node);
          }
        });
  
        tracer.push("restarting replica");
        await frame.restartNode(replicaPort);
        tracer.push("restarted replica and waiting on restart promise");
        const restartedNode = await sentinelRestartedPromise as RedisNode;
        tracer.push("got restarted promise");
        assert.equal(restartedNode.port, Number(replicaPort));
      })
  
      it('add a node / new replica', async function () {
        this.timeout(30000);
  
        sentinel = frame.getSentinelClient({ scanInterval: 2000, replicaPoolSize: 1 });
        sentinel.setTracer(tracer);
        // need to handle errors, as the spawning a new docker node can cause existing connections to time out
        sentinel.on('error', err => { });
        await sentinel.connect();
        tracer.push("connected");
  
        let nodeAddedResolve: (value: RedisNode) => void;
        const nodeAddedPromise = new Promise((res) => {
          nodeAddedResolve = res as (value: RedisNode) => void;
        });
  
        const portSet = new Set<number>();
        for (const port of frame.getAllNodesPort()) {
          portSet.add(port);
        }
  
        // "on" and not "once" as due to connection timeouts, can happen multiple times, and want right one
        sentinel.on('topology-change', (event: RedisSentinelEvent) => {
          tracer.push(`got topology-change event: ${JSON.stringify(event)}`);
          if (event.type === "REPLICA_ADD") {
            if (!portSet.has(event.node.port)) {
              tracer.push("got expected replica added event");
              nodeAddedResolve(event.node);
            }
          }
        });
  
        tracer.push("adding node");
        await frame.addNode();
        tracer.push("added node and waiting on added promise");
        await nodeAddedPromise; 
      })

      it('with client side caching', async function() {     
        this.timeout(30000);
        const csc = new BasicPooledClientSideCache();

        sentinel = frame.getSentinelClient({nodeClientOptions: {RESP: 3}, clientSideCache: csc, masterPoolSize: 5});
        await sentinel.connect();

        await sentinel.set('x', 1);
        await sentinel.get('x');
        await sentinel.get('x');
        await sentinel.get('x');
        await sentinel.get('x');

        assert.equal(1, csc.cacheMisses());
        assert.equal(3, csc.cacheHits());

        const invalidatePromise = once(csc, 'invalidate');
        await sentinel.set('x', 2);
        await invalidatePromise;
        await sentinel.get('x');
        await sentinel.get('x');
        await sentinel.get('x');
        await sentinel.get('x');

        assert.equal(csc.cacheMisses(), 2);
        assert.equal(csc.cacheHits(), 6);
      })
    })
  
    describe('Sentinel Factory', function () {
      let master: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> | undefined;
      let replica: RedisClientType<RedisModules, RedisFunctions, RedisScripts, RespVersions, TypeMapping> | undefined;
  
      beforeEach(async function () {
        this.timeout(0);

        await frame.getAllRunning();
    
        await steadyState(frame);
        longestTestDelta = 0;
      })
  
      afterEach(async function () {
        if (this!.currentTest!.state === 'failed') {
          console.log(`longest event loop blocked delta: ${longestDelta}`);
          console.log(`longest event loop blocked in failing test: ${longestTestDelta}`);
          console.log("trace:");
          for (const line of tracer) {
            console.log(line);
          }
          const results = await Promise.all([
            frame.sentinelSentinels(),
            frame.sentinelMaster(),
            frame.sentinelReplicas()
          ])
          console.log(`sentinel sentinels:\n${JSON.stringify(results[0], undefined, '\t')}`);
          console.log(`sentinel master:\n${JSON.stringify(results[1], undefined, '\t')}`);
          console.log(`sentinel replicas:\n${JSON.stringify(results[2], undefined, '\t')}`);
          const { stdout, stderr } = await execAsync("docker ps -a");
          console.log(`docker stdout:\n${stdout}`);
          console.log(`docker stderr:\n${stderr}`);
        }
        tracer.length = 0;
  
        if (master !== undefined) {
          if (master.isOpen) {
            master.destroy();
          }
          master = undefined;
        }
  
        if (replica !== undefined) {
          if (replica.isOpen) {
            replica.destroy();
          }
          replica = undefined;
        }
      })
  
      it('sentinel factory - master', async function () {
        const sentinelPorts = frame.getAllSentinelsPort();
        const sentinels: Array<RedisNode> = [];
        for (const port of sentinelPorts) {
          sentinels.push({ host: "localhost", port: port });
        }
  
        const factory = new RedisSentinelFactory({ name: frame.config.sentinelName, sentinelRootNodes: sentinels, sentinelClientOptions: {password: password}, nodeClientOptions: {password: password} })
        await factory.updateSentinelRootNodes();
  
        master = await factory.getMasterClient();
        await master.connect();
  
        assert.equal(await master.set("x", 1), 'OK');
      })
  
      it('sentinel factory - replica', async function () {
        const sentinelPorts = frame.getAllSentinelsPort();
        const sentinels: Array<RedisNode> = [];
  
        for (const port of sentinelPorts) {
          sentinels.push({ host: "localhost", port: port });
        }
  
        const factory = new RedisSentinelFactory({ name: frame.config.sentinelName, sentinelRootNodes: sentinels, sentinelClientOptions: {password: password}, nodeClientOptions: {password: password} })
        await factory.updateSentinelRootNodes();
  
        const masterNode = await factory.getMasterNode();
        replica = await factory.getReplicaClient();
        const replicaSocketOptions = replica.options?.socket as unknown as RedisTcpSocketOptions | undefined;
        assert.notEqual(masterNode.port, replicaSocketOptions?.port)
      })
  
      it('sentinel factory - bad node', async function () {
        const factory = new RedisSentinelFactory({ name: frame.config.sentinelName, sentinelRootNodes: [{ host: "locahost", port: 1 }] });
        await assert.rejects(factory.updateSentinelRootNodes(), new Error("Couldn't connect to any sentinel node"));
      })
  
      it('sentinel factory - invalid db name', async function () {
        this.timeout(15000);
  
        const sentinelPorts = frame.getAllSentinelsPort();
        const sentinels: Array<RedisNode> = [];
  
        for (const port of sentinelPorts) {
          sentinels.push({ host: "localhost", port: port });
        }
  
        const factory = new RedisSentinelFactory({ name: "invalid-name", sentinelRootNodes: sentinels, sentinelClientOptions: {password: password}, nodeClientOptions: {password: password} })
        await assert.rejects(factory.updateSentinelRootNodes(), new Error("ERR No such master with that name"));
      })
  
      it('sentinel factory - no available nodes', async function () {
        this.timeout(15000);
  
        const sentinelPorts = frame.getAllSentinelsPort();
        const sentinels: Array<RedisNode> = [];
  
        for (const port of sentinelPorts) {
          sentinels.push({ host: "localhost", port: port });
        }
  
        const factory = new RedisSentinelFactory({ name: frame.config.sentinelName, sentinelRootNodes: sentinels, sentinelClientOptions: {password: password}, nodeClientOptions: {password: password} })
  
        for (const node of frame.getAllNodesPort()) {
          await frame.stopNode(node.toString());
        }
  
        await setTimeout(1000);
  
        await assert.rejects(factory.getMasterNode(), new Error("Master Node Not Enumerated"));
      })
    })
  })
});
