import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { API_BASE_PATH, UNPREFIXED_ROUTES } from '../common/constants/api.constants.js';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor.js';
import { MailService } from '../mail/mail.service.js';
import { DeletionRequestsService } from './deletion-requests.service.js';
import { DELETION_REQUEST_STORE, MemoryDeletionRequestStore } from './deletion-request.store.js';
import { LegalController } from './legal.controller.js';
import { SlidingWindowLimiter } from './rate-limit.js';

test('Play Store pages are HTML outside /api/v1 and the form stores a request', async () => {
    const previousEmail = process.env['CONTACT_EMAIL'];
    const previousName = process.env['DEVELOPER_NAME'];
    delete process.env['CONTACT_EMAIL'];
    delete process.env['DEVELOPER_NAME'];

    const store = new MemoryDeletionRequestStore();
    const sent: Array<{ to: string; text: string }> = [];
    const moduleRef = await Test.createTestingModule({
        controllers: [LegalController],
        providers: [
            DeletionRequestsService,
            { provide: DELETION_REQUEST_STORE, useValue: store },
            { provide: SlidingWindowLimiter, useValue: new SlidingWindowLimiter(5, 60_000) },
            {
                provide: MailService,
                useValue: {
                    send: async (message: { to: string; text: string }) => {
                        sent.push(message);
                        return true;
                    },
                    configured: false,
                },
            },
        ],
    }).compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_BASE_PATH, { exclude: [...UNPREFIXED_ROUTES] });
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');

    try {
        const base = await app.getUrl();
        const privacy = await fetch(`${base}/privacy`);
        assert.equal(privacy.status, 200);
        const privacyHtml = await privacy.text();
        assert.match(privacy.headers.get('content-type') ?? '', /text\/html/);
        assert.match(privacyHtml, /AiGirl privacy policy/);
        assert.match(privacyHtml, /TODO/);
        assert.equal(privacyHtml.includes('"success"'), false);

        const prefixed = await fetch(`${base}/${API_BASE_PATH}/privacy`);
        assert.equal(prefixed.status, 404);

        const deletion = await fetch(`${base}/account-deletion`);
        assert.equal(deletion.status, 200);
        const deletionHtml = await deletion.text();
        assert.match(deletionHtml, /Delete your AiGirl account/);
        assert.match(deletionHtml, /mailto:TODO/);

        const posted = await fetch(`${base}/account-deletion`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email: 'ada@example.com', note: 'lost phone' }),
        });
        assert.equal(posted.status, 200);
        const postedHtml = await posted.text();
        assert.match(postedHtml, /Check your email/);
        assert.match(postedHtml, /confirmation link/);
        assert.equal(store.saved[0]?.email, 'ada@example.com');
        assert.equal(store.saved[0]?.note, 'lost phone');
        assert.equal(store.saved[0]?.confirmedAt, null);
        assert.equal(sent[0]?.to, 'ada@example.com');
        const token = decodeURIComponent(sent[0]?.text.match(/token=([^\s]+)/)?.[1] ?? '');
        assert.ok(token);

        const confirmed = await fetch(`${base}/account-deletion/confirm?token=${encodeURIComponent(token)}`);
        assert.equal(confirmed.status, 200);
        assert.match(await confirmed.text(), /Deletion confirmed/);
        assert.equal(store.saved[0]?.confirmedAt === null, false);

        const prefixedConfirm = await fetch(`${base}/${API_BASE_PATH}/account-deletion/confirm?token=nope`);
        assert.equal(prefixedConfirm.status, 404);
    } finally {
        await app.close();
        if (previousEmail === undefined) delete process.env['CONTACT_EMAIL'];
        else process.env['CONTACT_EMAIL'] = previousEmail;
        if (previousName === undefined) delete process.env['DEVELOPER_NAME'];
        else process.env['DEVELOPER_NAME'] = previousName;
    }
});
