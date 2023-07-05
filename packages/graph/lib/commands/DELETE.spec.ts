import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import DELETE from './DELETE';

describe('', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      DELETE.transformArguments('key'),
      ['GRAPH.DELETE', 'key']
    );
  });

  testUtils.testWithClient('client.graph.delete', async client => {
    await client.graph.query('key', 'RETURN 1');

    assert.equal(
      typeof await client.graph.delete('key'),
      'string'
    );
  }, GLOBAL.SERVERS.OPEN);
});
