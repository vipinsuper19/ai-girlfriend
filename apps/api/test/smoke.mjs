// End-to-end smoke run against a real database.
//   npx tsc --outDir /tmp/apidist && DATABASE_URL=... API_DIST=/tmp/apidist node test/smoke.mjs
// Chat and embedding providers are replaced so no AI key is needed.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve(process.env.API_DIST ?? 'dist');
const load = (path) => import(pathToFileURL(join(dist, path)).href);

process.env.JWT_ACCESS_SECRET ??= 'smoke-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'smoke-refresh-secret-0123456789abcdef';
process.env.GEMINI_API_KEY ??= 'smoke-placeholder';

const { Test } = await import('@nestjs/testing');
const { ValidationPipe } = await import('@nestjs/common');
const { AppModule } = await load('app.module.js');
const { CHAT_PROVIDER } = await load('ai/interfaces/chat-provider.interface.js');
const { EMBEDDING_PROVIDER } = await load('ai/interfaces/embedding.provider.js');
const { HttpExceptionFilter } = await load('common/filters/http-exception.filter.js');
const { ResponseInterceptor } = await load('common/interceptors/response.interceptor.js');
const { MailService } = await load('mail/mail.service.js');
const { GooglePlayService } = await load('subscriptions/google-play.service.js');
const { PrismaService } = await load('prisma/prisma.service.js');
const { BadRequestException } = await import('@nestjs/common');

let replies = 0;
const chat = {
    async generateChat({ messages }) {
        const last = messages.at(-1)?.content ?? '';
        if (messages[0]?.content?.includes('memory extraction')) return '{"memories":[]}';
        replies += 1;
        return `reply ${replies} to ${last}`;
    },
    async *streamChat() {
        yield 'hi';
    },
};
const embedding = {
    async generateEmbedding() {
        return { embedding: Array(1536).fill(0.01), provider: 'GEMINI', model: 'smoke', dimensions: 1536 };
    },
};
const { IMAGE_PROVIDER } = await load('images/image.provider.js');
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
);
const images = {
    async generateImage() {
        return { bytes: PNG, mimeType: 'image/png', provider: 'GEMINI', model: 'smoke' };
    },
};
const outbox = [];
const mail = {
    configured: true,
    async send(message) {
        outbox.push(message);
        return true;
    },
};

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CHAT_PROVIDER).useValue(chat)
    .overrideProvider(EMBEDDING_PROVIDER).useValue(embedding)
    .overrideProvider(MailService).useValue(mail)
    .overrideProvider(IMAGE_PROVIDER).useValue(images)
    .compile();

const app = moduleRef.createNestApplication({ logger: ['error'] });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
}));
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(new ResponseInterceptor());
await app.listen(0);
const base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');

async function call(method, path, { token, body } = {}) {
    const response = await fetch(`${base}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: response.status, data: json?.data ?? json, raw: json };
}

const results = [];
async function step(name, fn) {
    try {
        await fn();
        results.push(`ok   ${name}`);
    } catch (error) {
        results.push(`FAIL ${name}: ${error.message}`);
    }
}

const stamp = Date.now();
const email = `smoke${stamp}@example.com`;
let token;
let refresh;
let companionId;
let conversationId;

await step('register and session guard', async () => {
    const r = await call('POST', '/auth/register', { body: { email, password: 'password-one', displayName: 'Smoke' } });
    assert.equal(r.status, 201, JSON.stringify(r.raw));
    token = r.data.accessToken;
    refresh = r.data.refreshToken;
    assert.equal((await call('GET', '/users/me', { token })).status, 200);
});

await step('companion fields cannot point at another companion', async () => {
    const r = await call('POST', '/avatars', {
        token,
        body: {
            name: 'Aria',
            gender: 'FEMALE',
            appearance: { hairColor: 'Black', companionId: 999999 },
            personality: { traits: ['warm'], humorLevel: 6 },
            voice: { provider: 'GEMINI', voiceId: 'Kore' },
        },
    });
    assert.equal(r.status, 201, JSON.stringify(r.raw));
    companionId = r.data.id;
    assert.equal(r.data.appearance.companionId, companionId);
    const bad = await call('PATCH', `/avatars/${companionId}`, { token, body: { appearance: { age: 'old' } } });
    assert.equal(bad.status, 400);
    const foreign = await call('PATCH', `/avatars/${companionId}`, {
        token,
        body: { appearance: { avatarUrl: 'https://evil.example/x.png' } },
    });
    assert.equal(foreign.status, 200);
    assert.equal(foreign.data.appearance.avatarUrl, null);
});

await step('add, list, and pause memories', async () => {
    const created = await call('POST', '/memories', {
        token,
        body: { companionId, content: 'Likes jasmine tea', type: 'PREFERENCE' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.raw));
    assert.equal(created.data.source, 'USER_INPUT');
    assert.equal(created.data.importance, 7);
    const listed = await call('GET', `/memories?companionId=${companionId}`, { token });
    assert.equal(listed.data.length, 1);
    const blank = await call('POST', '/memories', { token, body: { companionId, content: '  ', type: 'FACT' } });
    assert.equal(blank.status, 400);
    const paused = await call('PATCH', '/users/me', { token, body: { memoryPaused: true } });
    assert.equal(paused.data.memoryPaused, true);
    const resumed = await call('PATCH', '/users/me', { token, body: { memoryPaused: false } });
    assert.equal(resumed.data.memoryPaused, false);
});

await step('message, then regenerate her latest reply', async () => {
    const conversation = await call('POST', '/conversations', { token, body: { companionId, title: 'Smoke' } });
    conversationId = conversation.data.id;
    const sent = await call('POST', `/conversations/${conversationId}/messages`, { token, body: { content: 'hello' } });
    assert.equal(sent.status, 201, JSON.stringify(sent.raw));
    const firstReply = sent.data.assistantMessage;
    const userLine = sent.data.userMessage;
    assert.equal((await call('POST', `/messages/${userLine.id}/regenerate`, { token })).status, 400);
    const again = await call('POST', `/messages/${firstReply.id}/regenerate`, { token });
    assert.equal(again.status, 201, JSON.stringify(again.raw));
    assert.equal(again.data.replacedId, firstReply.id);
    assert.notEqual(again.data.assistantMessage.content, firstReply.content);
    const thread = await call('GET', `/conversations/${conversationId}/messages`, { token });
    assert.deepEqual(thread.data.map((m) => m.role), ['USER', 'ASSISTANT']);
    assert.equal((await call('POST', `/messages/${firstReply.id}/regenerate`, { token })).status, 404);
    const media = await call('POST', `/conversations/${conversationId}/messages`, {
        token,
        body: { content: 'x', audioUrl: 'https://evil.example/a.mp3' },
    });
    assert.equal(media.status, 400);
});

await step('images: create, list, open, delete', async () => {
    const made = await call('POST', '/images', { token, body: { companionId, prompt: 'on a beach at sunset' } });
    assert.equal(made.status, 201, JSON.stringify(made.raw));
    assert.equal(made.data.status, 'COMPLETED');
    assert.match(made.data.imageUrl, /^\/uploads\/images\//);
    const onDisk = join(process.cwd(), made.data.imageUrl);
    assert.equal(existsSync(onDisk), true);
    const listed = await call('GET', `/images?companionId=${companionId}`, { token });
    assert.deepEqual(listed.data.map((i) => i.id), [made.data.id]);
    assert.equal((await call('GET', `/images/${made.data.id}`, { token })).status, 200);
    const usage = await call('GET', '/usage/summary', { token });
    assert.ok(JSON.stringify(usage.data).includes('IMAGE_GENERATIONS'), JSON.stringify(usage.raw));
    assert.equal((await call('DELETE', `/images/${made.data.id}`, { token })).status, 200);
    assert.equal((await call('GET', `/images/${made.data.id}`, { token })).status, 404);
    assert.equal(existsSync(onDisk), false);

    const young = await call('POST', '/avatars', {
        token,
        body: { name: 'Teen', gender: 'FEMALE', appearance: { age: 16 } },
    });
    assert.equal(young.status, 201, JSON.stringify(young.raw));
    const refused = await call('POST', '/images', { token, body: { companionId: young.data.id } });
    assert.equal(refused.status, 400);
    assert.equal((await call('DELETE', `/avatars/${young.data.id}`, { token })).status, 200);
});

await step('notification devices', async () => {
    const status = await call('GET', '/notifications/status', { token });
    assert.equal(status.data.pushConfigured, false);
    const device = `fcm-${stamp}`;
    const added = await call('POST', '/notifications/devices', { token, body: { token: device, platform: 'ANDROID' } });
    assert.equal(added.status, 201, JSON.stringify(added.raw));
    const again = await call('POST', '/notifications/devices', { token, body: { token: device, platform: 'ANDROID' } });
    assert.equal(again.data.id, added.data.id);
    assert.equal((await call('POST', '/notifications/devices', { token, body: { token: 'a b', platform: 'ANDROID' } })).status, 400);
    assert.equal((await call('POST', '/notifications/test', { token })).status, 503);
    assert.equal((await call('DELETE', `/notifications/devices/${device}`, { token })).status, 200);
    assert.equal((await call('DELETE', `/notifications/devices/${device}`, { token })).status, 404);
});

await step('google play purchase is verified before the plan changes', async () => {
    const off = await call('GET', '/subscriptions/google-play', { token });
    assert.equal(off.data.configured, false);
    const body = { productId: 'premium_monthly', purchaseToken: `play-${stamp}` };
    assert.equal((await call('POST', '/subscriptions/google-play', { token, body })).status, 503);

    const play = moduleRef.get(GooglePlayService);
    play.play = { auth: null, packageName: 'com.example.app', products: new Map([['premium_monthly', 'PREMIUM']]) };
    const config = await call('GET', '/subscriptions/google-play', { token });
    const purchases = new Map();
    const acknowledged = [];
    play.publisher = async (_play, method, path) => {
        if (method === 'POST') { acknowledged.push(path); return {}; }
        const found = purchases.get(decodeURIComponent(path.split('/').at(-1)));
        if (!found) throw new BadRequestException('Google Play refused this purchase');
        return found;
    };
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
    purchases.set(body.purchaseToken, {
        subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
        acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
        lineItems: [{ productId: 'premium_monthly', expiryTime: expiry }],
        externalAccountIdentifiers: { obfuscatedExternalAccountId: 'someone-else' },
    });
    assert.equal((await call('POST', '/subscriptions/google-play', { token, body })).status, 400);
    assert.equal((await call('GET', '/subscriptions/current', { token })).data.plan, 'FREE');

    purchases.get(body.purchaseToken).externalAccountIdentifiers.obfuscatedExternalAccountId = config.data.accountId;
    const ok = await call('POST', '/subscriptions/google-play', { token, body });
    assert.equal(ok.status, 201, JSON.stringify(ok.raw));
    assert.equal(ok.data.plan, 'PREMIUM');
    assert.equal(acknowledged.length, 1);
    const cur = await call('GET', '/subscriptions/current', { token });
    assert.equal(cur.data.plan, 'PREMIUM');
    assert.equal((await call('POST', '/subscriptions/google-play', { token, body: { ...body, purchaseToken: 'unknown' } })).status, 400);

    const other = await call('POST', '/auth/register', { body: { email: `other${stamp}@example.com`, password: 'password-one', displayName: 'Other' } });
    assert.equal((await call('POST', '/subscriptions/google-play', { token: other.data.accessToken, body })).status, 409);

    await moduleRef.get(PrismaService).client.orm.public.Subscription
        .where({ providerSubscriptionId: body.purchaseToken })
        .update({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await call('GET', '/subscriptions/current', { token })).data.plan, 'FREE');
    play.play = null;
});

await step('export leaves out secrets', async () => {
    const r = await call('GET', '/users/me/export', { token });
    assert.equal(r.status, 200, JSON.stringify(r.raw));
    const text = JSON.stringify(r.data);
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(r.data.memories.length, 1);
    assert.equal(r.data.messages.length, 2);
    assert.deepEqual(r.data.companions.filter((c) => c.status === 'ACTIVE').map((c) => c.id), [companionId]);
    assert.equal(r.data.images.length, 0);
});

await step('forgot and reset password, once', async () => {
    const r = await call('POST', '/auth/password/forgot', { body: { email } });
    assert.equal(r.status, 200);
    const unknown = await call('POST', '/auth/password/forgot', { body: { email: `nobody${stamp}@example.com` } });
    assert.equal(unknown.status, 200);
    assert.equal(unknown.data.message, r.data.message);
    assert.equal(outbox.length, 1);
    const link = /token=([^\s]+)/.exec(outbox[0].text)?.[1];
    assert.ok(link);
    const resetToken = decodeURIComponent(link);
    const reset = await call('POST', '/auth/password/reset', { body: { token: resetToken, newPassword: 'password-two' } });
    assert.equal(reset.status, 200, JSON.stringify(reset.raw));
    assert.equal((await call('POST', '/auth/password/reset', { body: { token: resetToken, newPassword: 'password-three' } })).status, 400);
    assert.equal((await call('GET', '/users/me', { token })).status, 401);
    assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: refresh } })).status, 401);
    const login = await call('POST', '/auth/login', { body: { email, password: 'password-two' } });
    assert.equal(login.status, 201);
    token = login.data.accessToken;
});

await step('change email', async () => {
    const wrong = await call('POST', '/auth/email', { token, body: { password: 'nope', newEmail: `new${stamp}@example.com` } });
    assert.equal(wrong.status, 400);
    const r = await call('POST', '/auth/email', { token, body: { password: 'password-two', newEmail: `New${stamp}@Example.com` } });
    assert.equal(r.status, 201, JSON.stringify(r.raw));
    assert.equal(r.data.email, `new${stamp}@example.com`);
    assert.equal((await call('POST', '/auth/login', { body: { email: `new${stamp}@example.com`, password: 'password-two' } })).status, 201);
});

await step('google sign-in needs configuration', async () => {
    const r = await call('POST', '/auth/google', { body: { idToken: 'not-a-jwt' } });
    assert.equal(r.status, 401);
});

await step('logout ends the access token', async () => {
    const out = await call('POST', '/auth/logout', { token });
    assert.equal(out.status, 201);
    assert.equal((await call('GET', '/users/me', { token })).status, 401);
});


await app.close();
console.log(results.join('\n'));
process.exit(results.some((line) => line.startsWith('FAIL')) ? 1 : 0);
