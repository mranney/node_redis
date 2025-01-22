# @redis/entraid

Token-based authentication provider for Redis clients using Microsoft Entra ID (formerly Azure Active Directory).

## Features

- Token-based authentication using Microsoft Entra ID
- Automatic token refresh before expiration
- Automatic re-authentication of all connections after token refresh
- Support for multiple authentication flows:
    - Managed identities (system-assigned and user-assigned)
    - Service principals (with or without certificates)
    - Authorization Code with PKCE flow
- Built-in retry mechanisms for transient failures

## Installation

```bash
npm install @redis/entraid
```

## Usage

### Basic Setup with Client Credentials ( Service Principal )

```typescript
import { createClient } from '@redis/client';
import { EntraIdCredentialsProviderFactory } from '@redis/entraid';

const provider = EntraIdCredentialsProviderFactory.createForClientCredentials({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  authorityConfig: {
    type: 'multi-tenant',
    tenantId: 'your-tenant-id'
  },
  tokenManagerConfig: {
    expirationRefreshRatio: 0.8 // Refresh token after 80% of its lifetime
  }
});

const client = createClient({
  url: 'redis://your-host',
  credentialsProvider: provider
});

await client.connect();
```

## Important Limitations

### RESP2 PUB/SUB Limitations

#### ⚠️ When using RESP2 (Redis Serialization Protocol 2), there are important limitations with PUB/SUB:

- **No Re-Authentication in PUB/SUB Mode**: In RESP2, once a connection enters PUB/SUB mode, the socket is blocked and
  cannot process out-of-band commands like AUTH. This means that connections in PUB/SUB mode cannot be re-authenticated
  when tokens are refreshed.

- **Connection Eviction**: As a result, PUB/SUB connections will be evicted by the Redis proxy when their tokens expire.
  The client will need to establish new connections with fresh tokens.


### Transaction Safety

#### ⚠️ Important Note About Transactions

When using token-based authentication, special care must be taken with Redis transactions.
The token manager runs in the background and may attempt to re-authenticate connections at any time by sending AUTH commands.
This can interfere with manually constructed transactions.

##### ✅ Recommended: Use the Official Transaction API

Always use the official transaction API provided by the client:

```typescript
// Correct way to handle transactions
const multi = client.multi();
multi.set('key1', 'value1');
multi.set('key2', 'value2');
await multi.exec();
```

##### ❌ Avoid: Manual Transaction Construction

Do not manually construct transactions by sending individual MULTI/EXEC commands:

```typescript
// Incorrect and potentially dangerous
await client.sendCommand(['MULTI']);
await client.sendCommand(['SET', 'key1', 'value1']);
await client.sendCommand(['SET', 'key2', 'value2']);
await client.sendCommand(['EXEC']); // Risk of AUTH command being injected before EXEC
```

The official transaction API ensures proper coordination between transaction commands and authentication updates.
It prevents the token manager from injecting AUTH commands in the middle of your transaction, which is particularly
important in applications where transaction atomicity is critical, such as payment processing or inventory management.


## Error Handling

The provider includes built-in retry mechanisms for transient errors:

```typescript
const provider = EntraIdCredentialsProviderFactory.createForClientCredentials({
  // ... other config ...
  tokenManagerConfig: {
    retry: {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    }
  }
});
```

### Other Considerations

- Token refresh operations are asynchronous and may occur in the background
- During token refresh, there is a critical window where all connections must be re-authenticated before the old token
  expires


