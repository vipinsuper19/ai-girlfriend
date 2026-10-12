import { createHmac, timingSafeEqual } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';

import type { NextFunction, Request, Response } from 'express';

import { contentTypeForKey } from './content-type.js';
import { isObjectKey, isObjectPrefix } from './object-key.js';
import type { ObjectStorage } from './object-storage.js';

export interface LocalStorageOptions {
    root: string;
    signingSecret: string;
    ttlSeconds: number;
    now?: () => number;
}

export class LocalObjectStorage implements ObjectStorage {
    private readonly root: string;
    private readonly signingSecret: string;
    readonly ttlSeconds: number;
    private readonly now: () => number;

    constructor(options: LocalStorageOptions) {
        this.root = resolve(options.root);
        this.signingSecret = options.signingSecret;
        this.ttlSeconds = options.ttlSeconds;
        this.now = options.now ?? (() => Date.now());
    }

    async put(key: string, body: Buffer, _contentType: string): Promise<void> {
        const filePath = this.resolveKey(key);
        await mkdir(join(filePath, '..'), { recursive: true });
        await writeFile(filePath, body);
    }

    async delete(key: string): Promise<void> {
        await rm(this.resolveKey(key), { force: true });
    }

    async deletePrefix(prefix: string): Promise<void> {
        const directory = this.resolvePrefix(prefix);
        await rm(directory, { recursive: true, force: true });
    }

    async list(prefix: string): Promise<string[]> {
        const directory = this.resolvePrefix(prefix);
        const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return [] as string[];
            throw error;
        });
        const folder = prefix.endsWith('/') ? prefix : `${prefix}/`;
        return names
            .filter((name) => isObjectKey(`${folder}${name}`))
            .map((name) => `${folder}${name}`);
    }

    async signedUrl(key: string): Promise<string> {
        this.resolveKey(key);
        const exp = Math.floor(this.now() / 1000) + this.ttlSeconds;
        const sig = signLocalDownload(key, exp, this.signingSecret);
        return `/uploads/${key}?exp=${exp}&sig=${sig}`;
    }

    absolutePath(key: string): string {
        return this.resolveKey(key);
    }

    /** True when exp is still in the future and sig matches this key. */
    authorize(key: string, exp: string, sig: string): boolean {
        if (!isObjectKey(key)) return false;
        if (!/^\d{1,12}$/.test(exp)) return false;
        const expiresAt = Number(exp);
        if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= this.now()) return false;
        const expected = signLocalDownload(key, expiresAt, this.signingSecret);
        const actual = Buffer.from(sig);
        const wanted = Buffer.from(expected);
        if (actual.length !== wanted.length) return false;
        return timingSafeEqual(actual, wanted);
    }

    private resolveKey(key: string): string {
        if (!isObjectKey(key)) throw new Error('Invalid storage key');
        return this.contain(key);
    }

    private resolvePrefix(prefix: string): string {
        if (!isObjectPrefix(prefix)) throw new Error('Invalid storage prefix');
        return this.contain(prefix);
    }

    private contain(relative: string): string {
        const filePath = resolve(this.root, relative);
        const rootWithSep = this.root.endsWith(sep) ? this.root : this.root + sep;
        if (filePath !== this.root && !filePath.startsWith(rootWithSep)) {
            throw new Error('Invalid storage key');
        }
        return filePath;
    }
}

export function signLocalDownload(key: string, exp: number, secret: string): string {
    return createHmac('sha256', secret).update(`${exp}\n${key}`).digest('base64url');
}

/**
 * Mount at `/uploads`. Unsigned requests are rejected; the file is not public.
 */
export function createLocalDownloadHandler(storage: LocalObjectStorage) {
    return (req: Request, res: Response, next: NextFunction): void => {
        void serveLocalDownload(storage, req, res).catch(next);
    };
}

async function serveLocalDownload(
    storage: LocalObjectStorage,
    req: Request,
    res: Response,
): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.end();
        return;
    }

    const url = new URL(req.url ?? '/', 'http://local');
    const key = keyFromPathname(url.pathname);
    const exp = url.searchParams.get('exp') ?? '';
    const sig = url.searchParams.get('sig') ?? '';
    if (!key || !storage.authorize(key, exp, sig)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Forbidden');
        return;
    }

    const filePath = storage.absolutePath(key);
    let size: number;
    try {
        const info = await stat(filePath);
        if (!info.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }
        size = info.size;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }
        throw error;
    }

    sendFile(req, res, filePath, contentTypeForKey(key), size, storage.ttlSeconds);
}

function keyFromPathname(pathname: string): string | null {
    const raw = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    if (!raw) return null;
    let key: string;
    try {
        key = raw.split('/').map((part) => decodeURIComponent(part)).join('/');
    } catch {
        return null;
    }
    return isObjectKey(key) ? key : null;
}

function sendFile(
    req: Request,
    res: Response,
    filePath: string,
    contentType: string,
    size: number,
    ttlSeconds: number,
): void {
    const cache = `private, max-age=${ttlSeconds}`;
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;

    if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        const start = match ? Number(match[1]) : NaN;
        const end = match && match[2] ? Number(match[2]) : size - 1;
        if (!match || start >= size || end >= size || start > end) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${size}`);
            res.end();
            return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', String(end - start + 1));
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', cache);
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        pipeFile(filePath, res, start, end);
        return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', cache);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    pipeFile(filePath, res);
}

function pipeFile(filePath: string, res: Response, start?: number, end?: number): void {
    const stream = createReadStream(filePath, start == null ? undefined : { start, end });
    stream.on('error', () => {
        if (!res.headersSent) res.statusCode = 404;
        res.end();
    });
    stream.pipe(res);
}
