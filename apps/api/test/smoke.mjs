// End-to-end smoke run against a real database.
//   npx tsc --outDir /tmp/apidist && DATABASE_URL=... API_DIST=/tmp/apidist node test/smoke.mjs
// Chat and embedding providers are replaced so no AI key is needed.
import 'reflect-metadata';
import assert from 'node:assert/strict';
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

await step('export leaves out secrets', async () => {
    const r = await call('GET', '/users/me/export', { token });
    assert.equal(r.status, 200, JSON.stringify(r.raw));
    const text = JSON.stringify(r.data);
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(r.data.memories.length, 1);
    assert.equal(r.data.messages.length, 2);
    assert.equal(r.data.companions.length, 1);
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
