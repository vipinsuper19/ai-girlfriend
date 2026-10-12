export function isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const name = 'name' in error ? String(error.name) : '';
    if (
        name === 'AbortError'
        || name === 'APIUserAbortError'
        || name === 'ClientDisconnectedError'
    ) {
        return true;
    }
    const code = 'code' in error ? error.code : undefined;
    if (code === 20 || code === 'ABORT_ERR' || code === 'ERR_STREAM_PREMATURE_CLOSE') {
        return true;
    }
    const cause = 'cause' in error ? error.cause : undefined;
    if (cause && cause !== error) return isAbortError(cause);
    return false;
}
