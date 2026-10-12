import assert from 'node:assert/strict';
import test from 'node:test';

import { MailService } from '../mail/mail.service.js';
import { hashDeletionToken } from './deletion-link.js';
import { DeletionRequestsService } from './deletion-requests.service.js';
import { MemoryDeletionRequestStore } from './deletion-request.store.js';
import { SlidingWindowLimiter } from './rate-limit.js';

const ORIGIN = 'https://api.example.test';

test('a deletion request is stored, confirmation is emailed, and then rate limited', async () => {
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
            ORIGIN,
        );
        assert.equal(ok.status, 200);
        assert.match(ok.html, /Check your email/);
        assert.match(ok.html, /confirmation link/);
        assert.equal(store.saved.length, 1);
        assert.equal(store.saved[0]?.email, 'user@example.com');
        assert.equal(store.saved[0]?.note, 'phone lost');
        assert.equal(store.saved[0]?.confirmedAt, null);
        assert.equal(sent.length, 1);
        assert.equal(sent[0]?.to, 'user@example.com');
        assert.match(sent[0]?.text ?? '', /https:\/\/api\.example\.test\/account-deletion\/confirm\?token=/);
        assert.equal(store.saved[0]?.tokenHash, hashDeletionToken(tokenFrom(sent[0]?.text ?? '')));

        const limited = await service.submit(
            { email: 'user@example.com', note: '' },
            '203.0.113.5',
            ORIGIN,
        );
        assert.equal(limited.status, 429);
        assert.match(limited.html, /Too many requests/);
        assert.equal(store.saved.length, 1);

        const invalid = await service.submit({ email: 'not-an-email' }, '203.0.113.9', ORIGIN);
        assert.equal(invalid.status, 400);
        assert.equal(store.saved.length, 1);

        const confirmed = await service.confirm(tokenFrom(sent[0]?.text ?? ''));
        assert.equal(confirmed.status, 200);
        assert.match(confirmed.html, /Deletion confirmed/);
        assert.equal(sent.length, 2);
        assert.equal(sent[1]?.to, 'privacy@example.com');
        assert.match(sent[1]?.text ?? '', /user@example.com/);
        assert.match(sent[1]?.text ?? '', /opened the link/);
        assert.equal(store.saved[0]?.confirmedAt === null, false);

        const again = await service.confirm(tokenFrom(sent[0]?.text ?? ''));
        assert.match(again.html, /Already confirmed/);
        assert.equal(sent.length, 2);
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
    const sent: string[] = [];
    const mail = {
        send: async (message: { to: string }) => {
            sent.push(message.to);
            return true;
        },
    } as unknown as MailService;
    const service = new DeletionRequestsService(
        store,
        new SlidingWindowLimiter(5, 60_000),
        mail,
    );

    try {
        const ok = await service.submit({ email: 'user@example.com' }, '198.51.100.4', ORIGIN);
        assert.equal(ok.status, 200);
        assert.equal(store.saved.length, 1);
        assert.deepEqual(sent, ['user@example.com']);
        assert.match(ok.html, /mailto:TODO/);
        const confirmed = await service.confirm('not-a-real-token');
        assert.equal(confirmed.status, 400);
        assert.deepEqual(sent, ['user@example.com']);
    } finally {
        if (previousEmail === undefined) delete process.env['CONTACT_EMAIL'];
        else process.env['CONTACT_EMAIL'] = previousEmail;
    }
});

test('a failed confirmation email says the developer verifies the account email', async () => {
    const previousEmail = process.env['CONTACT_EMAIL'];
    process.env['CONTACT_EMAIL'] = 'privacy@example.com';
    const store = new MemoryDeletionRequestStore();
    const sent: string[] = [];
    const mail = {
        send: async (message: { to: string }) => {
            sent.push(message.to);
            return message.to !== 'user@example.com';
        },
    } as unknown as MailService;
    const service = new DeletionRequestsService(
        store,
        new SlidingWindowLimiter(5, 60_000),
        mail,
    );

    try {
        const ok = await service.submit({ email: 'user@example.com', note: 'lost' }, '198.51.100.8', ORIGIN);
        assert.equal(ok.status, 200);
        assert.match(ok.html, /developer verifies the request from the account's email address/);
        assert.equal(store.saved[0]?.confirmedAt, null);
        assert.deepEqual(sent, ['user@example.com', 'privacy@example.com']);
    } finally {
        if (previousEmail === undefined) delete process.env['CONTACT_EMAIL'];
        else process.env['CONTACT_EMAIL'] = previousEmail;
    }
});

function tokenFrom(text: string): string {
    const match = text.match(/token=([^\s]+)/);
    assert.ok(match?.[1]);
    return decodeURIComponent(match[1]);
}
