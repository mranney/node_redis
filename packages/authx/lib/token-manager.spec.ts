import { strict as assert } from 'node:assert';
import { Token } from './token';
import { IDPError, RetryPolicy, TokenManager, TokenManagerConfig, TokenStreamListener } from './token-manager';
import { IdentityProvider, TokenResponse } from './identity-provider';
import { setTimeout } from 'timers/promises';

describe('TokenManager', () => {

  /**
   * Helper function to delay execution for a given number of milliseconds.
   * @param ms
   */
  const delay = (ms: number) => {
    return setTimeout(ms);
  }

  /**
   * IdentityProvider that returns a fixed test token for testing and doesn't handle TTL.
   */
  class TestIdentityProvider implements IdentityProvider<string> {
    requestToken(): Promise<TokenResponse<string>> {
      return Promise.resolve({ token: 'test-token 1', ttlMs: 1000 });
    }
  }

  /**
   * Helper function to create a test token with a given TTL .
   * @param ttlMs Time-to-live in milliseconds
   */
  const createToken = (ttlMs: number): Token<string> => {
    return new Token('test-token', ttlMs, 0);
  };

  /**
   * Listener that records received tokens and errors for testing.
   */
  class TestListener implements TokenStreamListener<string> {

    public readonly receivedTokens: Token<string>[] = [];
    public readonly errors: IDPError[] = [];

    onNext(token: Token<string>): void {
      this.receivedTokens.push(token);
    }

    onError(error: IDPError): void {
      this.errors.push(error);
    }
  }

  /**
   * IdentityProvider that returns a sequence of tokens with a fixed delay simulating network latency.
   * Used for testing token refresh scenarios.
   */
  class ControlledIdentityProvider implements IdentityProvider<string> {
    private tokenIndex = 0;
    private readonly delayMs: number;
    private readonly ttlMs: number;

    constructor(
      private readonly tokens: string[],
      delayMs: number = 0,
      tokenTTlMs: number = 100
    ) {
      this.delayMs = delayMs;
      this.ttlMs = tokenTTlMs;
    }

    async requestToken(): Promise<TokenResponse<string>> {

      if (this.tokenIndex >= this.tokens.length) {
        throw new Error('No more test tokens available');
      }

      if (this.delayMs > 0) {
        await setTimeout(this.delayMs);
      }

      return { token: this.tokens[this.tokenIndex++], ttlMs: this.ttlMs };
    }

  }

  /**
   * IdentityProvider that simulates various error scenarios with configurable behavior
   */
  class ErrorSimulatingProvider implements IdentityProvider<string> {
    private requestCount = 0;

    constructor(
      private readonly errorSequence: Array<Error | string>,
      private readonly delayMs: number = 0,
      private readonly ttlMs: number = 100
    ) {}

    async requestToken(): Promise<TokenResponse<string>> {

      if (this.delayMs > 0) {
        await delay(this.delayMs);
      }

      const result = this.errorSequence[this.requestCount];
      this.requestCount++;

      if (result instanceof Error) {
        throw result;
      } else if (typeof result === 'string') {
        return { token: result, ttlMs: this.ttlMs };
      } else {
        throw new Error('No more responses configured');
      }
    }

    getRequestCount(): number {
      return this.requestCount;
    }
  }

  describe('constructor validation', () => {
    it('should throw error if ratio is greater than 1', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 1.1
      };

      assert.throws(
        () => new TokenManager(new TestIdentityProvider(), config),
        /expirationRefreshRatio must be less than or equal to 1/
      );
    });

    it('should throw error if ratio is negative', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: -0.1
      };

      assert.throws(
        () => new TokenManager(new TestIdentityProvider(), config),
        /expirationRefreshRatio must be greater or equal to 0/
      );
    });

    it('should accept ratio of 1', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 1
      };

      assert.doesNotThrow(
        () => new TokenManager(new TestIdentityProvider(), config)
      );
    });

    it('should accept ratio of 0', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0
      };

      assert.doesNotThrow(
        () => new TokenManager(new TestIdentityProvider(), config)
      );
    });
  });

  describe('calculateRefreshTime', () => {
    it('should calculate correct refresh time with 0.8 ratio', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0.8
      };

      const manager = new TokenManager(new TestIdentityProvider(), config);
      const token = createToken(1000);
      const refreshTime = manager.calculateRefreshTime(token, 0);

      // With 1000s TTL and 0.8 ratio, should refresh at 800s
      assert.equal(refreshTime, 800);
    });

    it('should return 0 for ratio of 0', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0
      };

      const manager = new TokenManager(new TestIdentityProvider(), config);
      const token = createToken(1000);
      const refreshTime = manager.calculateRefreshTime(token, 0);

      assert.equal(refreshTime, 0);
    });

    it('should refresh at expiration time with ratio of 1', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 1
      };

      const manager = new TokenManager(new TestIdentityProvider(), config);
      const token = createToken(1000);
      const refreshTime = manager.calculateRefreshTime(token, 0);

      assert.equal(refreshTime, 1000);
    });

    it('should handle short TTL tokens', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0.8
      };

      const manager = new TokenManager(new TestIdentityProvider(), config);
      const token = createToken(5);
      const refreshTime = manager.calculateRefreshTime(token, 0);

      assert.equal(refreshTime, 4);
    });

    it('should handle expired tokens', () => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0.8
      };

      const manager = new TokenManager(new TestIdentityProvider(), config);
      // Create token that expired 100s ago
      const token = createToken(-100);
      const refreshTime = manager.calculateRefreshTime(token, 0);

      // Should return refresh time of 0 for expired tokens
      assert.equal(refreshTime, 0);
    });
    describe('token refresh scenarios', () => {

      describe('token refresh', () => {
        it('should handle token refresh', async () => {
          const networkDelay = 20;
          const tokenTtl = 100;

          const config: TokenManagerConfig = {
            expirationRefreshRatio: 0.8
          };

          const identityProvider = new ControlledIdentityProvider(['token1', 'token2', 'token3'], networkDelay, tokenTtl);
          const manager = new TokenManager(identityProvider, config);
          const listener = new TestListener();
          const disposable = manager.start(listener);

          assert.equal(manager.getCurrentToken(), null, 'Should not have token yet');
          // Wait for the first token request to complete ( it should be immediate, and we should wait only for the network delay)
          await delay(networkDelay)

          assert.equal(listener.receivedTokens.length, 1, 'Should receive initial token');
          assert.equal(listener.receivedTokens[0].value, 'token1', 'Should have correct token value');
          assert.equal(listener.receivedTokens[0].expiresAtMs - listener.receivedTokens[0].receivedAtMs,
            tokenTtl, 'Should have correct TTL');
          assert.equal(listener.errors.length, 0, 'Should not have any errors: ' + listener.errors);
          assert.equal(manager.getCurrentToken().value, 'token1', 'Should have current token');

          await delay(80);

          assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token yet');
          assert.equal(listener.errors.length, 0, 'Should not have any errors');

          await delay(networkDelay);

          assert.equal(listener.receivedTokens.length, 2, 'Should receive second token');
          assert.equal(listener.receivedTokens[1].value, 'token2', 'Should have correct token value');
          assert.equal(listener.receivedTokens[1].expiresAtMs - listener.receivedTokens[1].receivedAtMs,
            tokenTtl, 'Should have correct TTL');
          assert.equal(listener.errors.length, 0, 'Should not have any errors');
          assert.equal(manager.getCurrentToken().value, 'token2', 'Should have current token');

          await delay(80);

          assert.equal(listener.receivedTokens.length, 2, 'Should not receive new token yet');
          assert.equal(listener.errors.length, 0, 'Should not have any errors');

          await delay(networkDelay);

          assert.equal(listener.receivedTokens.length, 3, 'Should receive third token');
          assert.equal(listener.receivedTokens[2].value, 'token3', 'Should have correct token value');
          assert.equal(listener.receivedTokens[2].expiresAtMs - listener.receivedTokens[2].receivedAtMs,
            tokenTtl, 'Should have correct TTL');
          assert.equal(listener.errors.length, 0, 'Should not have any errors');
          assert.equal(manager.getCurrentToken().value, 'token3', 'Should have current token');

          disposable?.[Symbol.dispose]();
        });
      });
    });
  });

  describe('TokenManager error handling', () => {

    describe('error scenarios', () => {
      it('should not recover if retries are not enabled', async () => {

        const networkDelay = 20;
        const tokenTtl = 100;

        const config: TokenManagerConfig = {
          expirationRefreshRatio: 0.8
        };

        const identityProvider = new ErrorSimulatingProvider(
          [
            'token1',
            new Error('Fatal error'),
            'token3'
          ],
          networkDelay,
          tokenTtl
        );

        const manager = new TokenManager(identityProvider, config);
        const listener = new TestListener();
        const disposable = manager.start(listener);

        await delay(networkDelay);

        assert.equal(listener.receivedTokens.length, 1, 'Should receive initial token');
        assert.equal(listener.receivedTokens[0].value, 'token1', 'Should have correct initial token');
        assert.equal(listener.receivedTokens[0].expiresAtMs - listener.receivedTokens[0].receivedAtMs,
          tokenTtl, 'Should have correct TTL');
        assert.equal(listener.errors.length, 0, 'Should not have errors yet');

        await delay(80);

        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token yet');
        assert.equal(listener.errors.length, 0, 'Should not have any errors');

        await delay(networkDelay);

        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token after failure');
        assert.equal(listener.errors.length, 1, 'Should receive error');
        assert.equal(listener.errors[0].message, 'Fatal error', 'Should have correct error message');
        assert.equal(listener.errors[0].isRetryable, false, 'Should be a fatal error');

        // verify that the token manager is stopped and no more requests are made after the error and expected refresh time
        await delay(80);

        assert.equal(identityProvider.getRequestCount(), 2, 'Should not make more requests after error');
        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token after error');
        assert.equal(listener.errors.length, 1, 'Should not receive more errors after error');
        assert.equal(manager.isRunning(), false, 'Should stop token manager after error');

        disposable?.[Symbol.dispose]();
      });

      it('should handle retries with exponential backoff', async () => {
        const networkDelay = 20;
        const tokenTtl = 100;

        const config: TokenManagerConfig = {
          expirationRefreshRatio: 0.8,
          retry: {
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
            isRetryable: (error: unknown) => error instanceof Error && error.message === 'Temporary failure'
          }
        };

        const identityProvider = new ErrorSimulatingProvider(
          [
            'initial-token',
            new Error('Temporary failure'),  // First attempt fails
            new Error('Temporary failure'),  // First retry fails
            'recovery-token'                 // Second retry succeeds
          ],
          networkDelay,
          tokenTtl
        );

        const manager = new TokenManager(identityProvider, config);
        const listener = new TestListener();
        const disposable = manager.start(listener);

        // Wait for initial token
        await delay(networkDelay);
        assert.equal(listener.receivedTokens.length, 1, 'Should receive initial token');
        assert.equal(listener.receivedTokens[0].value, 'initial-token', 'Should have correct initial token');
        assert.equal(listener.receivedTokens[0].expiresAtMs - listener.receivedTokens[0].receivedAtMs,
          tokenTtl, 'Should have correct TTL');
        assert.equal(listener.errors.length, 0, 'Should not have errors yet');

        await delay(80);

        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token yet');
        assert.equal(listener.errors.length, 0, 'Should not have any errors');

        await delay(networkDelay);

        // Should have first error but not stop due to retry config
        assert.equal(listener.errors.length, 1, 'Should have first error');
        assert.ok(listener.errors[0].message.includes('attempt 1'), 'Error should indicate first attempt');
        assert.equal(listener.errors[0].isRetryable, true, 'Should not be a fatal error');
        assert.equal(manager.isRunning(), true, 'Should continue running during retries');

        // Advance past first retry (delay: 100ms due to backoff)
        await delay(100);

        assert.equal(listener.errors.length, 1, 'Should not have the second error yet');

        await delay(networkDelay);

        assert.equal(listener.errors.length, 2, 'Should have second error');
        assert.ok(listener.errors[1].message.includes('attempt 2'), 'Error should indicate second attempt');
        assert.equal(listener.errors[0].isRetryable, true, 'Should not be a fatal error');
        assert.equal(manager.isRunning(), true, 'Should continue running during retries');

        // Advance past second retry (delay: 200ms due to backoff)
        await delay(200);

        assert.equal(listener.errors.length, 2, 'Should not have another error');
        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token yet');

        await delay(networkDelay);

        // Should have recovered
        assert.equal(listener.receivedTokens.length, 2, 'Should receive recovery token');
        assert.equal(listener.receivedTokens[1].value, 'recovery-token', 'Should have correct recovery token');
        assert.equal(listener.receivedTokens[1].expiresAtMs - listener.receivedTokens[1].receivedAtMs,
          tokenTtl, 'Should have correct TTL');
        assert.equal(manager.isRunning(), true, 'Should continue running after recovery');
        assert.equal(identityProvider.getRequestCount(), 4, 'Should have made exactly 4 requests');

        disposable?.[Symbol.dispose]();
      });

      it('should stop after max retries exceeded', async () => {
        const networkDelay = 20;
        const tokenTtl = 100;

        const config: TokenManagerConfig = {
          expirationRefreshRatio: 0.8,
          retry: {
            maxAttempts: 2,  // Only allow 2 retries
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
            jitterPercentage: 0,
            isRetryable: (error: unknown) => error instanceof Error && error.message === 'Temporary failure'
          }
        };

        // All attempts must fail
        const identityProvider = new ErrorSimulatingProvider(
          [
            'initial-token',
            new Error('Temporary failure'),
            new Error('Temporary failure'),
            new Error('Temporary failure')
          ],
          networkDelay,
          tokenTtl
        );

        const manager = new TokenManager(identityProvider, config);
        const listener = new TestListener();
        const disposable = manager.start(listener);

        // Wait for initial token
        await delay(networkDelay);
        assert.equal(listener.receivedTokens.length, 1, 'Should receive initial token');

        await delay(80);

        assert.equal(listener.receivedTokens.length, 1, 'Should not receive new token yet');
        assert.equal(listener.errors.length, 0, 'Should not have any errors');

        //wait for the "network call" to complete
        await delay(networkDelay);

        // First error
        assert.equal(listener.errors.length, 1, 'Should have first error');
        assert.equal(manager.isRunning(), true, 'Should continue running after first error');
        assert.equal(listener.errors[0].isRetryable, true, 'Should not be a fatal error');

        // Advance past first retry
        await delay(100);

        assert.equal(listener.errors.length, 1, 'Should not have second error yet');

        //wait for the "network call" to complete
        await delay(networkDelay);

        // Second error
        assert.equal(listener.errors.length, 2, 'Should have second error');
        assert.equal(manager.isRunning(), true, 'Should continue running after second error');
        assert.equal(listener.errors[1].isRetryable, true, 'Should not be a fatal error');

        // Advance past second retry
        await delay(200);

        assert.equal(listener.errors.length, 2, 'Should not have third error yet');

        //wait for the "network call" to complete
        await delay(networkDelay);

        // Should stop after max retries
        assert.equal(listener.errors.length, 3, 'Should have final error');
        assert.equal(listener.errors[2].isRetryable, false, 'Should be a fatal error');
        assert.equal(manager.isRunning(), false, 'Should stop after max retries exceeded');
        assert.equal(identityProvider.getRequestCount(), 4, 'Should have made exactly 4 requests');

        disposable?.[Symbol.dispose]();

      });
    });
  });

  describe('TokenManager retry delay calculations', () => {
    const createManager = (retryConfig: Partial<RetryPolicy>) => {
      const config: TokenManagerConfig = {
        expirationRefreshRatio: 0.8,
        retry: {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
          ...retryConfig
        }
      };
      return new TokenManager(new TestIdentityProvider(), config);
    };

    describe('calculateRetryDelay', () => {

      it('should apply exponential backoff', () => {
        const manager = createManager({
          initialDelayMs: 100,
          backoffMultiplier: 2,
          jitterPercentage: 0
        });

        // Test multiple retry attempts
        const expectedDelays = [
          [1, 100],    // First attempt: initialDelay * (2^0) = 100
          [2, 200],    // Second attempt: initialDelay * (2^1) = 200
          [3, 400],    // Third attempt: initialDelay * (2^2) = 400
          [4, 800],    // Fourth attempt: initialDelay * (2^3) = 800
          [5, 1000]    // Fifth attempt: would be 1600, but capped at maxDelay (1000)
        ];

        for (const [attempt, expectedDelay] of expectedDelays) {
          manager['retryAttempt'] = attempt;
          assert.equal(
            manager.calculateRetryDelay(),
            expectedDelay,
            `Incorrect delay for attempt ${attempt}`
          );
        }
      });

      it('should respect maxDelayMs', () => {
        const manager = createManager({
          initialDelayMs: 100,
          maxDelayMs: 300,
          backoffMultiplier: 2,
          jitterPercentage: 0
        });

        // Test that delays are capped at maxDelayMs
        const expectedDelays = [
          [1, 100],    // First attempt: 100
          [2, 200],    // Second attempt: 200
          [3, 300],    // Third attempt: would be 400, capped at 300
          [4, 300],    // Fourth attempt: would be 800, capped at 300
          [5, 300]     // Fifth attempt: would be 1600, capped at 300
        ];

        for (const [attempt, expectedDelay] of expectedDelays) {
          manager['retryAttempt'] = attempt;
          assert.equal(
            manager.calculateRetryDelay(),
            expectedDelay,
            `Incorrect delay for attempt ${attempt}`
          );
        }
      });

      it('should return 0 when no retry config is present', () => {
        const manager = new TokenManager(new TestIdentityProvider(), {
          expirationRefreshRatio: 0.8
        });
        manager['retryAttempt'] = 1;
        assert.equal(manager.calculateRetryDelay(), 0);
      });
    });
  });
});

