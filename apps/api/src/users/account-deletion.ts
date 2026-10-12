export type StorageFailure = {
    key: string;
    error: string;
};

export type StorageRemoval = {
    failures: StorageFailure[];
    /**
     * True when a portrait listing failed. The user row must stay, because
     * the missing names are not in `failures` and a later 404 would drop the retry.
     */
    incomplete: boolean;
};

/**
 * Storage goes first. Android treats a later 404 from DELETE /users/me as success,
 * so a user row removed before a failed object delete is never retried by the client.
 * Known failures are recorded, then the row is removed. An incomplete listing or a
 * failed cleanup write leaves the row in place.
 */
export async function deleteAccountStorageFirst(input: {
    removeFiles: () => Promise<StorageRemoval>;
    recordFailures: (failures: readonly StorageFailure[]) => Promise<void>;
    deleteUser: () => Promise<void>;
}): Promise<void> {
    const removal = await input.removeFiles();
    if (removal.failures.length > 0) {
        await input.recordFailures(removal.failures);
    }
    if (removal.incomplete) {
        throw new Error(
            'Account deletion stopped before the user row was removed because some stored files could not be listed',
        );
    }
    await input.deleteUser();
}
