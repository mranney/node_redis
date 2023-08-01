import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import ALTER from './ALTER';
import { SCHEMA_FIELD_TYPE } from './CREATE';

describe('FT.ALTER', () => {
  describe('transformArguments', () => {
    it('with NOINDEX', () => {
      assert.deepEqual(
        ALTER.transformArguments('index', {
          field: {
            type: SCHEMA_FIELD_TYPE.TEXT,
            NOINDEX: true,
            SORTABLE: 'UNF',
            AS: 'text'
          }
        }),
        ['FT.ALTER', 'index', 'SCHEMA', 'ADD', 'field', 'AS', 'text', 'TEXT', 'SORTABLE', 'UNF', 'NOINDEX']
      );
    });
  });

  testUtils.testWithClient('client.ft.create', async client => {
    const [, reply] = await Promise.all([
      client.ft.create('index', {
        title: SCHEMA_FIELD_TYPE.TEXT
      }),
      client.ft.alter('index', {
        body: SCHEMA_FIELD_TYPE.TEXT
      })
    ]);

    assert.equal(reply, 'OK');
  }, GLOBAL.SERVERS.OPEN);
});
