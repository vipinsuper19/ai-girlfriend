import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { errorEnvelope } from './filters/http-exception.filter.js';

/** JSON and urlencoded bodies. Larger requests are 413, not a 500. */
export const BODY_LIMIT = '64kb';

type ExpressApp = {
    useBodyParser(parser: 'json' | 'urlencoded', options?: object): unknown;
    use(handler: (error: unknown, request: Request, response: Response, next: NextFunction) => void): unknown;
    getHttpAdapter(): {
        getInstance(): { use(handler: (request: Request, response: Response) => void): void };
    };
};

export function installBodyParsers(app: INestApplication): void {
    const expressApp = app as unknown as ExpressApp;
    expressApp.useBodyParser('json', { limit: BODY_LIMIT });
    expressApp.useBodyParser('urlencoded', { extended: true, limit: BODY_LIMIT });
    expressApp.use((error, request, response, next) => {
        if (response.headersSent || !isPayloadTooLarge(error)) {
            next(error);
            return;
        }
        response.status(413).json(
            errorEnvelope(413, 'Payload too large', request.originalUrl ?? request.url),
        );
    });
}

/** Unmatched paths use the same JSON envelope as handled errors, not the HTML page. */
export function installUnknownRoute(app: INestApplication): void {
    const server = (app as unknown as ExpressApp).getHttpAdapter().getInstance();
    server.use((request, response) => {
        if (response.headersSent) return;
        response.status(404).json(
            errorEnvelope(404, 'Cannot find this route', request.originalUrl ?? request.url),
        );
    });
}

function isPayloadTooLarge(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { status?: unknown; statusCode?: unknown; type?: unknown };
    return record.status === 413 || record.statusCode === 413 || record.type === 'entity.too.large';
}
