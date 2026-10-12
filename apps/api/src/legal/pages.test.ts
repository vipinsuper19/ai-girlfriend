import assert from 'node:assert/strict';
import test from 'node:test';

import { CONTACT_EMAIL_PLACEHOLDER, DEVELOPER_NAME_PLACEHOLDER } from './contact.js';
import { accountDeletionHtml, privacyHtml } from './pages.js';

const placeholder = {
    contactEmail: CONTACT_EMAIL_PLACEHOLDER,
    developerName: DEVELOPER_NAME_PLACEHOLDER,
};

test('privacy policy describes the data the API processes', () => {
    const html = privacyHtml(placeholder);
    assert.match(html, /<title>AiGirl privacy policy<\/title>/);
    assert.match(html, /account email/i);
    assert.match(html, /password hash/i);
    assert.match(html, /Google sign-in/);
    assert.match(html, /chat/i);
    assert.match(html, /memories/i);
    assert.match(html, /embedding/i);
    assert.match(html, /Google Gemini/);
    assert.match(html, /OpenAI/);
    assert.match(html, /voice/i);
    assert.match(html, /gallery images/i);
    assert.match(html, /Google Play/);
    assert.match(html, /card number/i);
    assert.match(html, /Retention/);
    assert.match(html, /30 days/);
    assert.match(html, /CONTACT_EMAIL/);
    assert.match(html, /DEVELOPER_NAME/);
    assert.match(html, />TODO</);
    assert.match(html, /DELETE \/api\/v1\/users\/me/);
});

test('account deletion page names the app, the steps, and what is kept', () => {
    const html = accountDeletionHtml({
        contactEmail: 'privacy@example.com',
        developerName: 'Example Developer',
    });
    assert.match(html, /Delete your AiGirl account/);
    assert.match(html, /com\.dhama\.mybase/);
    assert.match(html, /Settings and tap Delete account/);
    assert.match(html, /DELETE \/api\/v1\/users\/me/);
    assert.match(html, /method="post" action="\/account-deletion"/);
    assert.match(html, /mailto:privacy%40example.com/);
    assert.match(html, /What is deleted/);
    assert.match(html, /embeddings/);
    assert.match(html, /What is kept/);
    assert.match(html, /30 days/);
    assert.match(html, /Google Play/);
    assert.doesNotMatch(html, /Placeholder\./);
    assert.match(html, /Example Developer/);
});
