import { AuthenticationResult } from '@azure/msal-common/node';
import {
  BasicAuth, StreamingCredentialsProvider, IdentityProvider, TokenManager,
  ReAuthenticationError, StreamingCredentialsListener, IDPError, Token
} from '@redis/authx';

/**
 * A streaming credentials provider that uses the Entraid identity provider to provide credentials.
 * Please use one of the factory functions in `entraid-credetfactories.ts` to create an instance of this class for the different
 * type of authentication flows.
 */
export class EntraidCredentialsProvider implements StreamingCredentialsProvider {
  readonly type = 'streaming-credentials-provider';

  readonly #listeners: Set<StreamingCredentialsListener<BasicAuth>> = new Set();

  #tokenManagerDisposable: Disposable | null = null;
  #isStarting: boolean = false;

  #pendingSubscribers: Array<{
    resolve: (value: [BasicAuth, Disposable]) => void;
    reject: (error: Error) => void;
    pendingListener: StreamingCredentialsListener<BasicAuth>;
  }> = [];

  constructor(
    public readonly tokenManager: TokenManager<AuthenticationResult>,
    public readonly idp: IdentityProvider<AuthenticationResult>,
    private readonly options: {
      onReAuthenticationError?: (error: ReAuthenticationError) => void;
      credentialsMapper?: (token: AuthenticationResult) => BasicAuth;
      onRetryableError?: (error: string) => void;
    } = {}
  ) {
    this.onReAuthenticationError = options.onReAuthenticationError ?? DEFAULT_ERROR_HANDLER;
    this.#credentialsMapper = options.credentialsMapper ?? DEFAULT_CREDENTIALS_MAPPER;
  }

  async subscribe(
    listener: StreamingCredentialsListener<BasicAuth>
  ): Promise<[BasicAuth, Disposable]> {

    const currentToken = this.tokenManager.getCurrentToken();

    if (currentToken) {
      return [this.#credentialsMapper(currentToken.value), this.#createDisposable(listener)];
    }

    if (this.#isStarting) {
      return new Promise((resolve, reject) => {
        this.#pendingSubscribers.push({ resolve, reject, pendingListener: listener });
      });
    }

    this.#isStarting = true;
    try {
      const initialToken = await this.#startTokenManagerAndObtainInitialToken();

      this.#pendingSubscribers.forEach(({ resolve, pendingListener }) => {
        resolve([this.#credentialsMapper(initialToken.value), this.#createDisposable(pendingListener)]);
      });
      this.#pendingSubscribers = [];

      return [this.#credentialsMapper(initialToken.value), this.#createDisposable(listener)];
    } finally {
      this.#isStarting = false;
    }
  }

  onReAuthenticationError: (error: ReAuthenticationError) => void;

  #credentialsMapper: (token: AuthenticationResult) => BasicAuth;

  #createTokenManagerListener(subscribers: Set<StreamingCredentialsListener<BasicAuth>>) {
    return {
      onError: (error: IDPError): void => {
        if (!error.isRetryable) {
          subscribers.forEach(listener => listener.onError(error));
        } else {
          this.options.onRetryableError?.(error.message);
        }
      },
      onNext: (token: { value: AuthenticationResult }): void => {
        const credentials = this.#credentialsMapper(token.value);
        subscribers.forEach(listener => listener.onNext(credentials));
      }
    };
  }

  #createDisposable(listener: StreamingCredentialsListener<BasicAuth>): Disposable {
    this.#listeners.add(listener);

    return {
      [Symbol.dispose]: () => {
        this.#listeners.delete(listener);
        if (this.#listeners.size === 0 && this.#tokenManagerDisposable) {
          this.#tokenManagerDisposable[Symbol.dispose]();
          this.#tokenManagerDisposable = null;
        }
      }
    };
  }

  async #startTokenManagerAndObtainInitialToken(): Promise<Token<AuthenticationResult>> {
    const initialResponse = await this.idp.requestToken();
    const token = this.tokenManager.wrapAndSetCurrentToken(initialResponse.token, initialResponse.ttlMs);

    this.#tokenManagerDisposable = this.tokenManager.start(
      this.#createTokenManagerListener(this.#listeners),
      this.tokenManager.calculateRefreshTime(token)
    );
    return token;
  }

  public hasActiveSubscriptions(): boolean {
    return this.#tokenManagerDisposable !== null && this.#listeners.size > 0;
  }

  public getSubscriptionsCount(): number {
    return this.#listeners.size;
  }

  public getTokenManager() {
    return this.tokenManager;
  }

  public getCurrentCredentials(): BasicAuth | null {
    const currentToken = this.tokenManager.getCurrentToken();
    return currentToken ? this.#credentialsMapper(currentToken.value) : null;
  }

}

const DEFAULT_CREDENTIALS_MAPPER = (token: AuthenticationResult): BasicAuth => ({
  username: token.uniqueId,
  password: token.accessToken
});

const DEFAULT_ERROR_HANDLER = (error: ReAuthenticationError) =>
  console.error('ReAuthenticationError', error);