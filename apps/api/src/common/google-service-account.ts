import { GoogleAuth } from 'google-auth-library';

export type ServiceAccount = {
    client_email: string;
    private_key: string;
    project_id?: string;
};

/** Accepts the key file as raw JSON or base64. Anything incomplete is null. */
export function parseServiceAccount(value: string | undefined | null): ServiceAccount | null {
    const raw = value?.trim();
    if (!raw) return null;

    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    try {
        const parsed = JSON.parse(text) as Partial<ServiceAccount>;
        if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
            return null;
        }
        return {
            client_email: parsed.client_email,
            private_key: parsed.private_key,
            ...(typeof parsed.project_id === 'string' ? { project_id: parsed.project_id } : {}),
        };
    } catch {
        return null;
    }
}

export function googleAuthFor(account: ServiceAccount, scope: string): GoogleAuth {
    return new GoogleAuth({
        credentials: { client_email: account.client_email, private_key: account.private_key },
        scopes: [scope],
    });
}
