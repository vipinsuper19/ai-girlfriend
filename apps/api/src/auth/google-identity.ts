export type GoogleClaims = {
    iss?: unknown;
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    firebase?: {
        sign_in_provider?: unknown;
        identities?: Record<string, unknown>;
    };
};

export type GoogleIdentity = {
    googleId: string;
    email: string;
    name: string | null;
};

export const FIREBASE_ISSUER_PREFIX = 'https://securetoken.google.com/';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export function isFirebaseIssuer(iss: unknown): boolean {
    return typeof iss === 'string' && iss.startsWith(FIREBASE_ISSUER_PREFIX);
}

/**
 * Reads a verified token's claims. A Firebase token must come from a Google
 * sign-in, and either kind needs a verified email.
 */
export function googleIdentity(
    claims: GoogleClaims,
): { identity: GoogleIdentity | null; problem: string | null } {
    const fail = (problem: string) => ({ identity: null, problem });

    let googleId: unknown = claims.sub;
    if (isFirebaseIssuer(claims.iss)) {
        if (claims.firebase?.sign_in_provider !== 'google.com') {
            return fail('This token is not from Google sign-in');
        }
        const ids = claims.firebase.identities?.['google.com'];
        googleId = Array.isArray(ids) && typeof ids[0] === 'string' ? ids[0] : claims.sub;
    }

    if (typeof googleId !== 'string' || !googleId) {
        return fail('Google account id is missing');
    }
    if (typeof claims.email !== 'string' || !claims.email.includes('@')) {
        return fail('Google account has no email');
    }
    if (claims.email_verified !== true) {
        return fail('Google email is not verified');
    }

    return {
        identity: {
            googleId,
            email: claims.email.trim().toLowerCase(),
            name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null,
        },
        problem: null,
    };
}

export type GoogleSignInPlan =
    | { kind: 'existing'; userId: number }
    | { kind: 'create' }
    | { kind: 'conflict' };

/** Google never takes over an account that already exists under that email. */
export function googleSignInPlan(
    linkedUserId: number | null | undefined,
    emailOwnerId: number | null | undefined,
): GoogleSignInPlan {
    if (linkedUserId != null) return { kind: 'existing', userId: linkedUserId };
    if (emailOwnerId != null) return { kind: 'conflict' };
    return { kind: 'create' };
}

export function googleDisplayName(identity: GoogleIdentity): string {
    const name = identity.name ?? identity.email.split('@')[0] ?? '';
    const trimmed = name.slice(0, 100);
    return trimmed.length >= 2 ? trimmed : 'Friend';
}
