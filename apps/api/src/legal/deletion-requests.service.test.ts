import assert from 'node:assert/strict';
import test from 'node:test';

import { MailService } from '../mail/mail.service.js';
import { DeletionRequestsService } from './deletion-requests.service.js';
import { MemoryDeletionRequestStore } from './deletion-request.store.js';
import { SlidingWindowLimiter } from './rate-limit.js';

test('a deletion request is stored, emailed, and then rate limited', async () => {
    const previousEmail = process.env['CONTACT_EMAIL'];
    const previousName = process.env['DEVELOPER_NAME'];
    process.env['CONTACT_EMAIL'] = 'privacy@example.com';
    process.env['DEVELOPER_NAME'] = 'Example Developer';

    const store = new MemoryDeletionRequestStore();
    const sent: Array<{ to: string; subject: string; text: string }> = [];
    const mail = {
        send: async (message: { to: string; subject: string; text: string }) => {
            sent.push(message);
            return true;
        },
    } as unknown as MailService;
    const service = new DeletionRequestsService(
        store,
        new SlidingWindowLimiter(1, 60_000, () => 1_000),
        mail,
    );

    try {
        const ok = await service.submit(
            { email: ' User@Example.com ', note: '  phone lost  ' },
            '203.0.113.5',
        );
        assert.equal(ok.status, 200);
        assert.match(ok.html, /Request received/);
        assert.equal(store.saved.length, 1);
        assert.equal(store.saved[0]?.email, 'user@example.com');
        assert.equal(store.saved[0]?.note, 'phone lost');
        assert.equal(sent.length, 1);
        assert.equal(sent[0]?.to, 'privacy@example.com');
        assert.match(sent[0]?.text ?? '', /user@example.com/);

        const limited = await service.submit(
            { email: 'user@example.com', note: '' },
            '203.0.113.5',
        );
        assert.equal(limited.status, 429);
        assert.match(limited.html, /Too many requests/);
        assert.equal(store.saved.length, 1);

        const invalid = await service.submit({ email: 'not-an-email' }, '203.0.113.9');
        assert.equal(invalid.status, 400);
        assert.equal(store.saved.length, 1);
    } finally {
        if (previousEmail === undefined) delete process.env['CONTACT_EMAIL'];
        else process.env['CONTACT_EMAIL'] = previousEmail;
        if (previousName === undefined) delete process.env['DEVELOPER_NAME'];
        else process.env['DEVELOPER_NAME'] = previousName;
    }
});

test('a placeholder contact address is not emailed', async () => {
    const previousEmail = process.env['CONTACT_EMAIL'];
    delete process.env['CONTACT_EMAIL'];
    const store = new MemoryDeletionRequestStore();
    let mailed = 0;
    const mail = {
        send: async () => {
            mailed += 1;
            return true;
        },
    } as unknown as MailService;
    const service = new DeletionRequestsService(
        store,
        new SlidingWindowLimiter(5, 60_000),
        mail,
    );

    try {
        const ok = await service.submit({ email: 'user@example.com' }, '198.51.100.4');
        assert.equal(ok.status, 200);
        assert.equal(store.saved.length, 1);
        assert.equal(mailed, 0);
        assert.match(ok.html, /mailto:TODO/);
    } finally {
        if (previousEmail === undefined) delete process.env['CONTACT_EMAIL'];
        else process.env['CONTACT_EMAIL'] = previousEmail;
    }
});
