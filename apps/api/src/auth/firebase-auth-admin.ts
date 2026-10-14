import { parseServiceAccount } from '../common/google-service-account.js';

/** The Admin Auth client account deletion needs. Tests pass a fake. */
export interface FirebaseAuthAdmin {
    deleteUser(uid: string): Promise<void>;
    getUserByEmail(email: string): Promise<{ uid: string }>;
}

export type LinkedAccount = {
    provider?: unknown;
    providerData?: unknown;
};

export type FirebaseDeletionTargets = {
    uids: string[];
    /** Google-linked account with no stored Firebase uid. Look this email up once. */
    lookupEmail: string | null;
};

const APP_NAME = 'ai-girlfriend-auth';

export function isFirebaseUserNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: unknown }).code;
    return code === 'auth/user-not-found';
}

export function firebaseErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object') return 'Error';
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && code.trim() ? code.trim() : 'Error';
}

function hasBlankOrNul(value: string): boolean {
    return value.includes('\u0000') || /\s/.test(value);
}

/** Firebase Auth uids are short tokens. `email:` is reserved for the retry key. */
export function isFirebaseUid(uid: string): boolean {
    return uid.length > 0
        && uid.length <= 128
        && !uid.startsWith('email:')
        && !hasBlankOrNul(uid);
}

export function firebaseUidFromProviderData(data: unknown): string | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const uid = (data as { firebaseUid?: unknown }).firebaseUid;
    if (typeof uid !== 'string') return null;
    const trimmed = uid.trim();
    return isFirebaseUid(trimmed) ? trimmed : null;
}

/**
 * Uids already stored on the account, plus one email lookup when a Google
 * link predates that field. Password accounts are skipped.
 */
export function firebaseDeletionTargets(
    accounts: readonly LinkedAccount[],
    email: unknown,
): FirebaseDeletionTargets {
    const uids = new Set<string>();
    let needsLookup = false;
    for (const account of accounts) {
        const uid = firebaseUidFromProviderData(account.providerData);
        if (uid) uids.add(uid);
        else if (account.provider === 'GOOGLE') needsLookup = true;
    }
    const lookupEmail = needsLookup && typeof email === 'string' && email.includes('@')
        ? email.trim().toLowerCase()
        : null;
    return { uids: [...uids], lookupEmail };
}

export function emailCleanupSubject(email: string): string | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || normalized.length > 320 || hasBlankOrNul(normalized)) {
        return null;
    }
    return `email:${normalized}`;
}

/**
 * Firebase ID tokens are verified with Google's public keys, not Admin.
 * This client is only for deleteUser. Missing credentials return null.
 */
export async function createFirebaseAuthAdmin(
    env: NodeJS.ProcessEnv = process.env,
): Promise<FirebaseAuthAdmin | null> {
    const account = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = env.FIREBASE_PROJECT_ID?.trim() || account?.project_id;
    if (!account || !projectId) return null;

    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const existing = getApps().find((app) => app.name === APP_NAME);
    const app = existing ?? initializeApp({
        credential: cert({
            projectId,
            clientEmail: account.client_email,
            privateKey: account.private_key,
        }),
        projectId,
    }, APP_NAME);
    const auth = getAuth(app);
    return {
        deleteUser: (uid) => auth.deleteUser(uid),
        getUserByEmail: async (email) => {
            const user = await auth.getUserByEmail(email);
            return { uid: user.uid };
        },
    };
}

/**
 * Production with Firebase sign-in and no Admin key still boots.
 * The message is for the process log, not the client.
 */
export function firebaseAdminConfigProblem(env: NodeJS.ProcessEnv = process.env): string | null {
    if (env.NODE_ENV !== 'production') return null;
    if (!env.FIREBASE_PROJECT_ID?.trim()) return null;
    if (parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON)) return null;
    return 'FIREBASE_PROJECT_ID is set but FIREBASE_SERVICE_ACCOUNT_JSON is missing or invalid. Account deletion will not remove Firebase Auth users until it is set.';
}
