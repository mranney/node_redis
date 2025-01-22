import { AuthenticationResult } from '@azure/msal-node';
import { IdentityProvider, TokenManager, TokenResponse, BasicAuth } from '@redis/authx';
import { EntraidCredentialsProvider } from './entraid-credentials-provider';
import { setTimeout } from 'timers/promises';
import { strict as assert } from 'node:assert';
import { GLOBAL, testUtils } from './test-utils'


describe('EntraID authentication in cluster mode', () => {

  testUtils.testWithCluster('sendCommand', async cluster => {
    assert.equal(
      await cluster.sendCommand(undefined, true, ['PING']),
      'PONG'
    );
  }, GLOBAL.CLUSTERS.PASSWORD_WITH_REPLICAS);
})

describe('EntraID CredentialsProvider Subscription Behavior', () => {

  it('should properly handle token refresh sequence for multiple subscribers', async () => {
    const networkDelay = 20;
    const tokenTTL = 100;
    const refreshRatio = 0.5; // Refresh at 50% of TTL

    const idp = new SequenceEntraIDProvider(tokenTTL, networkDelay);
    const tokenManager = new TokenManager<AuthenticationResult>(idp, {
      expirationRefreshRatio: refreshRatio
    });
    const entraid = new EntraidCredentialsProvider(tokenManager, idp);

    // Create two initial subscribers
    const subscriber1 = new TestSubscriber('subscriber1');
    const subscriber2 = new TestSubscriber('subscriber2');

    assert.equal(entraid.hasActiveSubscriptions(), false, 'There should be no active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 0, 'There should be 0 subscriptions');

    // Start the first two subscriptions almost simultaneously
    const [sub1Initial, sub2Initial] = await Promise.all([
      entraid.subscribe(subscriber1),
      entraid.subscribe(subscriber2)]
    );

    assertCredentials(sub1Initial[0], 'initial-token', 'Subscriber 1 should receive initial token');
    assertCredentials(sub2Initial[0], 'initial-token', 'Subscriber 2 should receive initial token');

    assert.equal(entraid.hasActiveSubscriptions(), true, 'There should be active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 2, 'There should be 2 subscriptions');

    // add a third subscriber after a very short delay
    const subscriber3 = new TestSubscriber('subscriber3');
    await setTimeout(1);
    const sub3Initial = await entraid.subscribe(subscriber3)

    assert.equal(entraid.hasActiveSubscriptions(), true, 'There should be active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 3, 'There should be 3 subscriptions');

    // make sure the third subscriber gets the initial token as well
    assertCredentials(sub3Initial[0], 'initial-token', 'Subscriber 3 should receive initial token');

    // Wait for first refresh (50% of TTL + network delay + small buffer)
    await setTimeout((tokenTTL * refreshRatio) + networkDelay + 15);

    // All 3 subscribers should receive refresh-token-1
    assertCredentials(subscriber1.credentials[0], 'refresh-token-1', 'Subscriber 1 should receive first refresh token');
    assertCredentials(subscriber2.credentials[0], 'refresh-token-1', 'Subscriber 2 should receive first refresh token');
    assertCredentials(subscriber3.credentials[0], 'refresh-token-1', 'Subscriber 3 should receive first refresh token');

    // Add a late subscriber - should immediately get refresh-token-1
    const subscriber4 = new TestSubscriber('subscriber4');
    const sub4Initial = await entraid.subscribe(subscriber4);

    assert.equal(entraid.hasActiveSubscriptions(), true, 'There should be active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 4, 'There should be 4 subscriptions');

    assertCredentials(sub4Initial[0], 'refresh-token-1', 'Late subscriber should receive refresh-token-1');

    // Wait for second refresh
    await setTimeout((tokenTTL * refreshRatio) + networkDelay + 15);

    assertCredentials(subscriber1.credentials[1], 'refresh-token-2', 'Subscriber 1 should receive second refresh token');
    assertCredentials(subscriber2.credentials[1], 'refresh-token-2', 'Subscriber 2 should receive second refresh token');
    assertCredentials(subscriber3.credentials[1], 'refresh-token-2', 'Subscriber 3 should receive second refresh token');

    assertCredentials(subscriber4.credentials[0], 'refresh-token-2', 'Subscriber 4 should receive second refresh token');

    // Verify refreshes happen after minimum expected time
    const minimumRefreshInterval = tokenTTL * 0.4; // 40% of TTL as safety margin

    verifyRefreshTiming(subscriber1, minimumRefreshInterval);
    verifyRefreshTiming(subscriber2, minimumRefreshInterval);
    verifyRefreshTiming(subscriber3, minimumRefreshInterval);
    verifyRefreshTiming(subscriber4, minimumRefreshInterval);

    // Cleanup

    assert.equal(tokenManager.isRunning(), true);
    sub1Initial[1][Symbol.dispose]();
    sub2Initial[1][Symbol.dispose]();
    sub3Initial[1][Symbol.dispose]();
    assert.equal(entraid.hasActiveSubscriptions(), true, 'There should be active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 1, 'There should be 1 subscriptions');
    sub4Initial[1][Symbol.dispose]();
    assert.equal(entraid.hasActiveSubscriptions(), false, 'There should be no active subscriptions');
    assert.equal(entraid.getSubscriptionsCount(), 0, 'There should be 0 subscriptions');
    assert.equal(tokenManager.isRunning(), false)
  });

  const verifyRefreshTiming = (
    subscriber: TestSubscriber,
    expectedMinimumInterval: number,
    message?: string
  ) => {
    const intervals = [];
    for (let i = 1; i < subscriber.timestamps.length; i++) {
      intervals.push(subscriber.timestamps[i] - subscriber.timestamps[i - 1]);
    }

    intervals.forEach((interval, index) => {
      assert.ok(
        interval > expectedMinimumInterval,
        message || `Refresh ${index + 1} for ${subscriber.name} should happen after minimum interval of ${expectedMinimumInterval}ms`
      );
    });
  };

  class SequenceEntraIDProvider implements IdentityProvider<AuthenticationResult> {
    private currentIndex = 0;

    constructor(
      private readonly tokenTTL: number = 100,
      private tokenDeliveryDelayMs: number = 0,
      private readonly tokenSequence: AuthenticationResult[] = [
        {
          accessToken: 'initial-token',
          uniqueId: 'test-user'
        } as AuthenticationResult,
        {
          accessToken: 'refresh-token-1',
          uniqueId: 'test-user'
        } as AuthenticationResult,
        {
          accessToken: 'refresh-token-2',
          uniqueId: 'test-user'
        } as AuthenticationResult
      ]
    ) {}

    setTokenDeliveryDelay(delayMs: number): void {
      this.tokenDeliveryDelayMs = delayMs;
    }

    async requestToken(): Promise<TokenResponse<AuthenticationResult>> {
      if (this.tokenDeliveryDelayMs > 0) {
        await setTimeout(this.tokenDeliveryDelayMs);
      }

      if (this.currentIndex >= this.tokenSequence.length) {
        throw new Error('No more tokens in sequence');
      }

      return {
        token: this.tokenSequence[this.currentIndex++],
        ttlMs: this.tokenTTL
      };
    }
  }

  class TestSubscriber {
    public readonly credentials: Array<BasicAuth> = [];
    public readonly errors: Error[] = [];
    public readonly timestamps: number[] = [];

    constructor(public readonly name: string = 'unnamed') {}

    onNext = (creds: BasicAuth) => {
      this.credentials.push(creds);
      this.timestamps.push(Date.now());
    }

    onError = (error: Error) => {
      this.errors.push(error);
    }
  }

  /**
   * Assert that the actual credentials match the expected token
   * @param actual
   * @param expectedToken
   * @param message
   */
  const assertCredentials = (actual: BasicAuth, expectedToken: string, message: string) => {
    assert.deepEqual(actual, {
      username: 'test-user',
      password: expectedToken
    }, message);
  };
});