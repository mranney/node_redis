import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import INCRBY from './INCRBY';

describe('TS.INCRBY', () => {
  describe('transformArguments', () => {
    it('without options', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1),
        ['TS.INCRBY', 'key', '1']
      );
    });

    it('with TIMESTAMP', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          TIMESTAMP: '*'
        }),
        ['TS.INCRBY', 'key', '1', 'TIMESTAMP', '*']
      );
    });

    it('with RETENTION', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          RETENTION: 1
        }),
        ['TS.INCRBY', 'key', '1', 'RETENTION', '1']
      );
    });

    it('with UNCOMPRESSED', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          UNCOMPRESSED: true
        }),
        ['TS.INCRBY', 'key', '1', 'UNCOMPRESSED']
      );
    });

    it('without UNCOMPRESSED', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          UNCOMPRESSED: false
        }),
        ['TS.INCRBY', 'key', '1']
      );
    });

    it('with CHUNK_SIZE', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          CHUNK_SIZE: 1
        }),
        ['TS.INCRBY', 'key', '1', 'CHUNK_SIZE', '1']
      );
    });

    it('with LABELS', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          LABELS: { label: 'value' }
        }),
        ['TS.INCRBY', 'key', '1', 'LABELS', 'label', 'value']
      );
    });

    it ('with IGNORE', () => {
      testUtils.isVersionGreaterThanHook([7, 4]);
      
      it('no values', () => {
        assert.deepEqual(
          INCRBY.transformArguments('key', 1, {
            IGNORE: { }
          }),
          ['TS.INCRBY', 'key', '1', 'IGNORE', '0', '0']
        )
      });
  
      it('MAX_TIME_DIFF', () => {
        assert.deepEqual(
          INCRBY.transformArguments('key', 1, {
            IGNORE: { MAX_TIME_DIFF: 1}
          }),
          ['TS.INCRBY', 'key', '1', 'IGNORE', '1', '0']
        )
      });
  
      it('MAX_VAL_DIFF', () => {
        assert.deepEqual(
          INCRBY.transformArguments('key', 1, {
            IGNORE: { MAX_VAL_DIFF: 1}
          }),
          ['TS.INCRBY', 'key', '1', 'IGNORE', '0', '1']
        )
      });
    });

    it('with TIMESTAMP, RETENTION, UNCOMPRESSED, CHUNK_SIZE and LABELS', () => {
      assert.deepEqual(
        INCRBY.transformArguments('key', 1, {
          TIMESTAMP: '*',
          RETENTION: 1,
          UNCOMPRESSED: true,
          CHUNK_SIZE: 1,
          LABELS: { label: 'value' }
        }),
        ['TS.INCRBY', 'key', '1', 'TIMESTAMP', '*', 'RETENTION', '1', 'UNCOMPRESSED',
          'CHUNK_SIZE', '1', 'LABELS', 'label', 'value']
      );
    });
  });

  testUtils.testWithClient('client.ts.incrBy', async client => {
    assert.equal(
      typeof await client.ts.incrBy('key', 1),
      'number'
    );
  }, GLOBAL.SERVERS.OPEN);
});
