import {strict as assert} from 'assert';
import testUtils, {GLOBAL} from '../test-utils';
import { transformArguments } from './LATENCY_HISTOGRAM';

describe('LATENCY HISTOGRAM', () => {
    it('transformArguments', () => {
        assert.deepEqual(
            transformArguments('command'),
            ['LATENCY', 'HISTOGRAM', 'command']
        );
    });

    testUtils.testWithClient('client.latencyHistory', async client => {
        await Promise.all([
            client.set('sample-key', 'sample-value'),
            client.get('sample-key')
        ]);

        const commandNames = ['set', 'get'];
        const latencyHistograms = await client.latencyHistogram(...commandNames);

        for (const commandName of commandNames) {
            const commandInfo = latencyHistograms[commandName];
            assert.ok(Number.isInteger(commandInfo['calls']));
            assert.ok(Array.isArray(commandInfo['histogram_usec']));
        }
    }, GLOBAL.SERVERS.OPEN);
});
