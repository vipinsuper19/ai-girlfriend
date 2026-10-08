export const DEVICE_PLATFORMS = ['ANDROID', 'WEB', 'IOS'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export type Push = {
    title: string;
    body: string;
    data?: Record<string, string>;
};

export function fcmEndpoint(projectId: string): string {
    return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

export function fcmMessage(token: string, push: Push) {
    return {
        message: {
            token,
            notification: { title: push.title.slice(0, 100), body: push.body.slice(0, 500) },
            ...(push.data && Object.keys(push.data).length ? { data: push.data } : {}),
            android: { priority: 'HIGH' as const },
        },
    };
}

/** FCM answers UNREGISTERED (404) or INVALID_ARGUMENT for tokens that will never work again. */
export function isDeadToken(status: number, body: unknown): boolean {
    if (status === 404) return true;
    const error = (body as { error?: { status?: string; details?: Array<{ errorCode?: string }> } })?.error;
    if (!error) return false;
    const codes = (error.details ?? []).map((detail) => detail?.errorCode);
    return codes.includes('UNREGISTERED')
        || (status === 400 && error.status === 'INVALID_ARGUMENT' && codes.includes('INVALID_ARGUMENT'));
}
