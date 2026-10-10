import {
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

import {
    FIREBASE_ISSUER_PREFIX,
    type GoogleClaims,
    isFirebaseIssuer,
} from './google-identity.js';

const FIREBASE_KEYS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function listEnv(name: string): string[] {
    return (process.env[name] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

/**
 * Verifies a Firebase ID token against FIREBASE_PROJECT_ID, or a Google ID
 * token against GOOGLE_CLIENT_IDS. Unconfigured means 503, never accept.
 */
@Injectable()
export class GoogleTokenService {
    private readonly google = new OAuth2Client();

    async verify(idToken: string): Promise<GoogleClaims> {
        let iss: unknown;
        try {
            iss = decodeJwt(idToken).iss;
        } catch {
            throw new UnauthorizedException('Invalid Google token');
        }

        if (isFirebaseIssuer(iss)) {
            const projectId = process.env['FIREBASE_PROJECT_ID']?.trim();
            if (!projectId) {
                throw new ServiceUnavailableException('Google sign-in is not configured');
            }
            try {
                const { payload } = await jwtVerify(idToken, FIREBASE_KEYS, {
                    issuer: `${FIREBASE_ISSUER_PREFIX}${projectId}`,
                    audience: projectId,
                    algorithms: ['RS256'],
                });
                return payload as GoogleClaims;
            } catch {
                throw new UnauthorizedException('Invalid Google token');
            }
        }

        const audience = listEnv('GOOGLE_CLIENT_IDS');
        if (audience.length === 0) {
            throw new ServiceUnavailableException('Google sign-in is not configured');
        }
        try {
            const ticket = await this.google.verifyIdToken({ idToken, audience });
            return (ticket.getPayload() ?? {}) as GoogleClaims;
        } catch {
            throw new UnauthorizedException('Invalid Google token');
        }
    }
}
