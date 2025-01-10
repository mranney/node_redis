import {
  AuthenticationResult
} from '@azure/msal-node';
import { IdentityProvider, TokenResponse } from '@redis/authx';

export class MSALIdentityProvider implements IdentityProvider<AuthenticationResult> {
  private readonly getToken: () => Promise<AuthenticationResult>;

  constructor(getToken: () => Promise<AuthenticationResult>) {
    this.getToken = getToken;
  }

  async requestToken(): Promise<TokenResponse<AuthenticationResult>> {
    try {
      const result = await this.getToken();

      if (!result?.accessToken || !result?.expiresOn) {
        throw new Error('Invalid token response');
      }
      return {
        token: result,
        ttlMs: result.expiresOn.getTime() - Date.now()
      };
    } catch (error) {
      throw error;
    }
  }

}


