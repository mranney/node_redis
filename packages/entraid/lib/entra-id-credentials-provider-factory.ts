import { NetworkError } from '@azure/msal-common';
import {
  LogLevel,
  ManagedIdentityApplication,
  ManagedIdentityConfiguration,
  AuthenticationResult,
  PublicClientApplication,
  ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest, CryptoProvider, Configuration, NodeAuthOptions, AccountInfo
} from '@azure/msal-node';
import { RetryPolicy, TokenManager, TokenManagerConfig, ReAuthenticationError } from '@redis/authx';
import { EntraidCredentialsProvider } from './entraid-credentials-provider';
import { MSALIdentityProvider } from './msal-identity-provider';

/**
 * This class is used to create credentials providers for different types of authentication flows.
 */
export class EntraIdCredentialsProviderFactory {

  /**
   * This method is used to create a ManagedIdentityProvider for both system-assigned and user-assigned managed identities.
   *
   * @param params
   * @param userAssignedClientId For user-assigned managed identities, the developer needs to pass either the client ID,
   * full resource identifier, or the object ID of the managed identity when creating ManagedIdentityApplication.
   *
   */
  public static createManagedIdentityProvider(
    params: CredentialParams, userAssignedClientId?: string
  ): EntraidCredentialsProvider {
    const config: ManagedIdentityConfiguration = {
      // For user-assigned identity, include the client ID
      ...(userAssignedClientId && {
        managedIdentityIdParams: {
          userAssignedClientId
        }
      }),
      system: {
        loggerOptions
      }
    };

    const client = new ManagedIdentityApplication(config);

    const idp = new MSALIdentityProvider(
      () => client.acquireToken({
        resource: params.scopes?.[0] ?? REDIS_SCOPE,
        forceRefresh: true
      }).then(x => x === null ? Promise.reject('Token is null') : x)
    );

    return new EntraidCredentialsProvider(
      new TokenManager(idp, params.tokenManagerConfig),
      idp,
      { onReAuthenticationError: params.onReAuthenticationError, credentialsMapper: OID_CREDENTIALS_MAPPER }
    );
  }

  /**
   * This method is used to create a credentials provider for system-assigned managed identities.
   * @param params
   */
  static createForSystemAssignedManagedIdentity(
    params: CredentialParams
  ): EntraidCredentialsProvider {
    return this.createManagedIdentityProvider(params);
  }

  /**
   * This method is used to create a credentials provider for user-assigned managed identities.
   * It will include the client ID as the userAssignedClientId in the ManagedIdentityConfiguration.
   * @param params
   */
  static createForUserAssignedManagedIdentity(
    params: CredentialParams & { userAssignedClientId: string }
  ): EntraidCredentialsProvider {
    return this.createManagedIdentityProvider(params, params.userAssignedClientId);
  }

  static #createForClientCredentials(
    authConfig: NodeAuthOptions,
    params: CredentialParams
  ): EntraidCredentialsProvider {
    const config: Configuration = {
      auth: {
        ...authConfig,
        authority: this.getAuthority(params.authorityConfig ?? { type: 'default' })
      },
      system: {
        loggerOptions
      }
    };

    const client = new ConfidentialClientApplication(config);

    const idp = new MSALIdentityProvider(
      () => client.acquireTokenByClientCredential({
        skipCache: true,
        scopes: params.scopes ?? [REDIS_SCOPE_DEFAULT]
      }).then(x => x === null ? Promise.reject('Token is null') : x)
    );

    return new EntraidCredentialsProvider(new TokenManager(idp, params.tokenManagerConfig), idp,
      {
        onReAuthenticationError: params.onReAuthenticationError,
        credentialsMapper: OID_CREDENTIALS_MAPPER
      });
  }

  /**
   * This method is used to create a credentials provider for service principals using certificate.
   * @param params
   */
  static createForClientCredentialsWithCertificate(
    params: ClientCredentialsWithCertificateParams
  ): EntraidCredentialsProvider {
    return this.#createForClientCredentials(
      {
        clientId: params.clientId,
        clientCertificate: params.certificate
      },
      params
    );
  }

  /**
   * This method is used to create a credentials provider for service principals using client secret.
   * @param params
   */
  static createForClientCredentials(
    params: ClientSecretCredentialsParams
  ): EntraidCredentialsProvider {
    return this.#createForClientCredentials(
      {
        clientId: params.clientId,
        clientSecret: params.clientSecret
      },
      params
    );
  }

  /**
   * This method is used to create a credentials provider for the Authorization Code Flow with PKCE.
   * @param params
   */
  static createForAuthorizationCodeWithPKCE(
    params: AuthCodePKCEParams
  ): {
    getPKCECodes: () => Promise<{
      verifier: string;
      challenge: string;
      challengeMethod: string;
    }>;
    getAuthCodeUrl: (
      pkceCodes: { challenge: string; challengeMethod: string }
    ) => Promise<string>;
    createCredentialsProvider: (
      params: PKCEParams
    ) => EntraidCredentialsProvider;
  } {

    const requiredScopes = ['user.read', 'offline_access'];
    const scopes = [...new Set([...(params.scopes || []), ...requiredScopes])];

    const authFlow = AuthCodeFlowHelper.create({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      scopes: scopes,
      authorityConfig: params.authorityConfig
    });

    return {
      getPKCECodes: AuthCodeFlowHelper.generatePKCE,
      getAuthCodeUrl: (pkceCodes) => authFlow.getAuthCodeUrl(pkceCodes),
      createCredentialsProvider: (pkceParams) => {

        // This is used to store the initial credentials account to be used
        // for silent token acquisition after the initial token acquisition.
        let initialCredentialsAccount: AccountInfo | null = null;

        const idp = new MSALIdentityProvider(
          async () => {
            if (!initialCredentialsAccount) {
              let authResult = await authFlow.acquireTokenByCode(pkceParams);
              initialCredentialsAccount = authResult.account;
              return authResult;
            } else {
              return authFlow.client.acquireTokenSilent({
                forceRefresh: true,
                account: initialCredentialsAccount,
                scopes
              });
            }

          }
        );
        const tm = new TokenManager(idp, params.tokenManagerConfig);
        return new EntraidCredentialsProvider(tm, idp, { onReAuthenticationError: params.onReAuthenticationError });
      }
    };
  }

  static getAuthority(config: AuthorityConfig): string {
    switch (config.type) {
      case 'multi-tenant':
        return `https://login.microsoftonline.com/${config.tenantId}`;
      case 'custom':
        return config.authorityUrl;
      case 'default':
        return 'https://login.microsoftonline.com/common';
      default:
        throw new Error('Invalid authority configuration');
    }
  }

}

const REDIS_SCOPE_DEFAULT = 'https://redis.azure.com/.default';
const REDIS_SCOPE = 'https://redis.azure.com'

export type AuthorityConfig =
  | { type: 'multi-tenant'; tenantId: string }
  | { type: 'custom'; authorityUrl: string }
  | { type: 'default' };

export type PKCEParams = {
  code: string;
  verifier: string;
  clientInfo?: string;
}

export type CredentialParams = {
  clientId: string;
  scopes?: string[];
  authorityConfig?: AuthorityConfig;

  tokenManagerConfig: TokenManagerConfig
  onReAuthenticationError?: (error: ReAuthenticationError) => void;
}

export type AuthCodePKCEParams = CredentialParams & {
  redirectUri: string;
};

export type ClientSecretCredentialsParams = CredentialParams & {
  clientSecret: string;
};

export type ClientCredentialsWithCertificateParams = CredentialParams & {
  certificate: {
    thumbprint: string;
    privateKey: string;
    x5c?: string;
  };
};

const loggerOptions = {
  loggerCallback(loglevel: LogLevel, message: string, containsPii: boolean) {
    if (!containsPii) console.log(message);
  },
  piiLoggingEnabled: false,
  logLevel: LogLevel.Error
}

/**
 * The most important part of the RetryPolicy is the `isRetryable` function. This function is used to determine if a request should be retried based
 * on the error returned from the identity provider. The default for is to retry on network errors only.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  // currently only retry on network errors
  isRetryable: (error: unknown) => error instanceof NetworkError,
  maxAttempts: 10,
  initialDelayMs: 100,
  maxDelayMs: 100000,
  backoffMultiplier: 2,
  jitterPercentage: 0.1

};

export const DEFAULT_TOKEN_MANAGER_CONFIG: TokenManagerConfig = {
  retry: DEFAULT_RETRY_POLICY,
  expirationRefreshRatio: 0.7 // Refresh token when 70% of the token has expired
}

/**
 * This class is used to help with the Authorization Code Flow with PKCE.
 * It provides methods to generate PKCE codes, get the authorization URL, and create the credential provider.
 */
export class AuthCodeFlowHelper {
  private constructor(
    readonly client: PublicClientApplication,
    readonly scopes: string[],
    readonly redirectUri: string
  ) {}

  async getAuthCodeUrl(pkceCodes: {
    challenge: string;
    challengeMethod: string;
  }): Promise<string> {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: this.scopes,
      redirectUri: this.redirectUri,
      codeChallenge: pkceCodes.challenge,
      codeChallengeMethod: pkceCodes.challengeMethod
    };

    return this.client.getAuthCodeUrl(authCodeUrlParameters);
  }

  async acquireTokenByCode(params: PKCEParams): Promise<AuthenticationResult> {
    const tokenRequest: AuthorizationCodeRequest = {
      code: params.code,
      scopes: this.scopes,
      redirectUri: this.redirectUri,
      codeVerifier: params.verifier,
      clientInfo: params.clientInfo
    };

    return this.client.acquireTokenByCode(tokenRequest);
  }

  static async generatePKCE(): Promise<{
    verifier: string;
    challenge: string;
    challengeMethod: string;
  }> {
    const cryptoProvider = new CryptoProvider();
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
    return {
      verifier,
      challenge,
      challengeMethod: 'S256'
    };
  }

  static create(params: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    authorityConfig?: AuthorityConfig;
  }): AuthCodeFlowHelper {
    const config = {
      auth: {
        clientId: params.clientId,
        authority: EntraIdCredentialsProviderFactory.getAuthority(params.authorityConfig ?? { type: 'default' })
      },
      system: {
        loggerOptions
      }
    };

    return new AuthCodeFlowHelper(
      new PublicClientApplication(config),
      params.scopes ?? ['user.read'],
      params.redirectUri
    );
  }
}

const OID_CREDENTIALS_MAPPER = (token: AuthenticationResult) => {

  // Client credentials flow is app-only authentication (no user context),
  // so only access token is provided without user-specific claims (uniqueId, idToken, ...)
  // this means that we need to extract the oid from the access token manually
  const accessToken = JSON.parse(Buffer.from(token.accessToken.split('.')[1], 'base64').toString());

  return ({
    username: accessToken.oid,
    password: token.accessToken
  })

}
