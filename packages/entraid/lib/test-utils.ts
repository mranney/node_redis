import { AuthenticationResult } from '@azure/msal-node';
import { IdentityProvider, StreamingCredentialsProvider, TokenManager, TokenResponse } from '@redis/authx';
import TestUtils from '@redis/test-utils';
import { EntraidCredentialsProvider } from './entraid-credentials-provider';

export const testUtils = new TestUtils({
  dockerImageName: 'redis/redis-stack',
  dockerImageVersionArgument: 'redis-version',
  defaultDockerVersion: '7.4.0-v1'
});

const DEBUG_MODE_ARGS = testUtils.isVersionGreaterThan([7]) ?
  ['--enable-debug-command', 'yes'] :
  [];

const idp: IdentityProvider<AuthenticationResult> = {
  requestToken(): Promise<TokenResponse<AuthenticationResult>> {
    // @ts-ignore
    return Promise.resolve({
      ttlMs: 100000,
      token: {
        accessToken: 'password'
      }
    })
  }
}

const tokenManager = new TokenManager<AuthenticationResult>(idp, { expirationRefreshRatio: 0.8 });
const entraIdCredentialsProvider: StreamingCredentialsProvider = new EntraidCredentialsProvider(tokenManager, idp)

const PASSWORD_WITH_REPLICAS = {
  serverArguments: ['--requirepass', 'password', ...DEBUG_MODE_ARGS],
  numberOfMasters: 2,
  numberOfReplicas: 1,
  clusterConfiguration: {
    defaults: {
      credentialsProvider: entraIdCredentialsProvider
    }
  }
}

export const GLOBAL = {
  CLUSTERS: {
    PASSWORD_WITH_REPLICAS
  }
}
