import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { Test } from '@nestjs/testing';

import { AgeConfirmedGuard } from '../auth/age-confirmed.guard.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

test('SSE stream sends Cache-Control: no-cache', async () => {
    const moduleRef = await Test.createTestingModule({
        controllers: [MessagesController],
        providers: [{
            provide: MessagesService,
            useValue: {
                async assertCanReply() {
                    return undefined;
                },
                async *createAndStream() {
                    yield { type: 'delta', content: 'hi' };
                },
            },
        }],
    })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(AgeConfirmedGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RateLimitGuard)
        .useValue({
            canActivate(context: { switchToHttp(): { getRequest(): { user?: unknown } } }) {
                context.switchToHttp().getRequest().user = { sub: 1 };
                return true;
            },
        })
        .compile();

    const app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');

    try {
        const base = await app.getUrl();
        const response = await fetch(`${base}/conversations/1/messages/stream`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'hi' }),
        });
        const cache = response.headers.get('cache-control') ?? '';
        assert.match(cache, /^no-cache\b/);
        assert.match(cache, /no-transform/);
        await response.text();
    } finally {
        await app.close();
    }
});
