import express, { Request, Response } from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import { DEFAULT_TOKEN_MANAGER_CONFIG, EntraIdCredentialsProviderFactory } from '../../lib/entra-id-credentials-provider-factory';

dotenv.config();

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable must be set');
}

interface PKCESession extends session.Session {
  pkceCodes?: {
    verifier: string;
    challenge: string;
    challengeMethod: string;
  };
}

interface AuthRequest extends Request {
  session: PKCESession;
}

const app = express();

const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only use secure in production
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600000 // 1 hour
  }
} as const;

app.use(session(sessionConfig));

if (!process.env.MSAL_CLIENT_ID || !process.env.MSAL_TENANT_ID) {
  throw new Error('MSAL_CLIENT_ID and MSAL_TENANT_ID environment variables must be set');
}

// Initialize MSAL provider with authorization code PKCE flow
const {
  getPKCECodes,
  createCredentialsProvider,
  getAuthCodeUrl
} = EntraIdCredentialsProviderFactory.createForAuthorizationCodeWithPKCE({
  clientId: process.env.MSAL_CLIENT_ID,
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/redirect',
  authorityConfig: { type: 'multi-tenant', tenantId: process.env.MSAL_TENANT_ID },
  tokenManagerConfig: DEFAULT_TOKEN_MANAGER_CONFIG
});

app.get('/login', async (req: AuthRequest, res: Response) => {
  try {
    // Generate PKCE Codes before starting the authorization flow
    const pkceCodes = await getPKCECodes();

    // Store PKCE codes in session
    req.session.pkceCodes = pkceCodes

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const authUrl = await getAuthCodeUrl({
      challenge: pkceCodes.challenge,
      challengeMethod: pkceCodes.challengeMethod
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Login flow failed:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/redirect', async (req: AuthRequest, res: Response) => {
  try {

    // The authorization code is in req.query.code
    const { code, client_info } = req.query;
    const { pkceCodes } = req.session;

    if (!pkceCodes) {
      console.error('Session state:', {
        hasSession: !!req.session,
        sessionID: req.sessionID,
        pkceCodes: req.session.pkceCodes
      });
      return res.status(400).send('PKCE codes not found in session');
    }

    // Check both possible error scenarios
    if (req.query.error) {
      console.error('OAuth error:', req.query.error, req.query.error_description);
      return res.status(400).send(`OAuth error: ${req.query.error_description || req.query.error}`);
    }

    if (!code) {
      console.error('Missing authorization code. Query parameters received:', req.query);
      return res.status(400).send('Authorization code not found in request. Query params: ' + JSON.stringify(req.query));
    }

    // Configure with the received code
    const entraidCredentialsProvider = createCredentialsProvider(
      {
        code: code as string,
        verifier: pkceCodes.verifier,
        clientInfo: client_info as string | undefined
      },
    );

    const initialCredentials = entraidCredentialsProvider.subscribe({
      onNext: (token) => {
        console.log('Token acquired:', token);
      },
      onError: (error) => {
        console.error('Token acquisition failed:', error);
      }
    });

    const [credentials] = await initialCredentials;

    console.log('Credentials acquired:', credentials)

    // Clear sensitive data
    delete req.session.pkceCodes;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Authentication successful' });
  } catch (error) {
    console.error('Token acquisition failed:', error);
    res.status(500).send('Failed to acquire token');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Login URL: http://localhost:${PORT}/login`);
});