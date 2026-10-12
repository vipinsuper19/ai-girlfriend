export interface ObjectStorage {
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    /** Removes one object. A missing object is not an error. */
    delete(key: string): Promise<void>;
    /** Removes every object under a prefix. Used when an account is deleted. */
    deletePrefix(prefix: string): Promise<void>;
    list(prefix: string): Promise<string[]>;
    signedUrl(key: string): Promise<string>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
