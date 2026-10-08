export function passwordChangeProblem(
    currentPassword: string,
    newPassword: string,
    input: { hasPassword: boolean; currentMatches: boolean },
): string | null {
    if (!input.hasPassword) {
        return 'This account has no password.';
    }

    if (!input.currentMatches) {
        return 'Current password is wrong.';
    }

    if (newPassword.length < 8) {
        return 'Use at least 8 characters.';
    }

    if (newPassword.length > 128) {
        return 'Keep the password under 128 characters.';
    }

    if (currentPassword === newPassword) {
        return 'Choose a different password.';
    }

    return null;
}
