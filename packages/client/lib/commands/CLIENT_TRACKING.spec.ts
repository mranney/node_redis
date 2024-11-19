import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import CLIENT_TRACKING from './CLIENT_TRACKING';

describe('CLIENT TRACKING', () => {
  testUtils.isVersionGreaterThanHook([6]);

  describe('transformArguments', () => {
    describe('true', () => {
      it('simple', () => {
        assert.deepEqual(
          CLIENT_TRACKING.transformArguments(true),
          ['CLIENT', 'TRACKING', 'ON']
        );
      });

      it('with REDIRECT', () => {
        assert.deepEqual(
          CLIENT_TRACKING.transformArguments(true, {
            REDIRECT: 1
          }),
          ['CLIENT', 'TRACKING', 'ON', 'REDIRECT', '1']
        );
      });

      describe('with BCAST', () => {
        it('simple', () => {
          assert.deepEqual(
            CLIENT_TRACKING.transformArguments(true, {
              BCAST: true
            }),
            ['CLIENT', 'TRACKING', 'ON', 'BCAST']
          );
        });

        describe('with PREFIX', () => {
          it('string', () => {
            assert.deepEqual(
              CLIENT_TRACKING.transformArguments(true, {
                BCAST: true,
                PREFIX: 'prefix'
              }),
              ['CLIENT', 'TRACKING', 'ON', 'BCAST', 'PREFIX', 'prefix']
            );
          });

          it('array', () => {
            assert.deepEqual(
              CLIENT_TRACKING.transformArguments(true, {
                BCAST: true,
                PREFIX: ['1', '2']
              }),
              ['CLIENT', 'TRACKING', 'ON', 'BCAST', 'PREFIX', '1', 'PREFIX', '2']
            );
          });
        });
      });

      it('with OPTIN', () => {
        assert.deepEqual(
          CLIENT_TRACKING.transformArguments(true, {
            OPTIN: true
          }),
          ['CLIENT', 'TRACKING', 'ON', 'OPTIN']
        );
      });

      it('with OPTOUT', () => {
        assert.deepEqual(
          CLIENT_TRACKING.transformArguments(true, {
            OPTOUT: true
          }),
          ['CLIENT', 'TRACKING', 'ON', 'OPTOUT']
        );
      });

      it('with NOLOOP', () => {
        assert.deepEqual(
          CLIENT_TRACKING.transformArguments(true, {
            NOLOOP: true
          }),
          ['CLIENT', 'TRACKING', 'ON', 'NOLOOP']
        );
      });
    });

    it('false', () => {
      assert.deepEqual(
        CLIENT_TRACKING.transformArguments(false),
        ['CLIENT', 'TRACKING', 'OFF']
      );
    });
  });

  testUtils.testWithClient('client.clientTracking', async client => {
    assert.equal(
      await client.clientTracking(false),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    clientOptions: {
      RESP: 3
    }
  });
});
