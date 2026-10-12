/** Shown on the public pages until Vipin sets the env var. */
export const CONTACT_EMAIL_PLACEHOLDER = 'TODO';

/** Shown on the public pages until Vipin sets the env var. */
export const DEVELOPER_NAME_PLACEHOLDER = 'TODO';

export const APP_NAME = 'AiGirl';
export const ANDROID_PACKAGE = 'com.dhama.mybase';

/** How long a web deletion request is kept after it is recorded. */
export const DELETION_REQUEST_RETENTION_DAYS = 30;

export function contactEmail(): string {
    const value = process.env['CONTACT_EMAIL']?.trim();
    return value ? value : CONTACT_EMAIL_PLACEHOLDER;
}

export function developerName(): string {
    const value = process.env['DEVELOPER_NAME']?.trim();
    return value ? value : DEVELOPER_NAME_PLACEHOLDER;
}

export function contactEmailIsConfigured(email: string): boolean {
    return email !== CONTACT_EMAIL_PLACEHOLDER && email.includes('@');
}
