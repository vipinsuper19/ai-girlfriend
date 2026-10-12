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
    assert.match(html, /go to Gemini/);
    assert.match(html, /OpenAI's moderation API/);
    assert.match(html, /OPENAI_API_KEY/);
    assert.match(html, /safety notice/);
    assert.match(html, /age_date_of_birth/);
    assert.match(html, /18\+ confirmation flag/);
    assert.match(html, /dateOfBirth/);
    assert.match(html, /ageConfirmedAt/);
    assert.match(html, /does not send them/);
    assert.match(html, /Firebase Analytics/);
    assert.match(html, /Firebase Crashlytics/);
    assert.match(html, /crash reports, device information, and app events/);
    assert.match(html, /age, email, chat text, and phone/);
    assert.match(html, /snapshot of that message/);
    assert.match(html, /client IP address/);
    assert.match(html, /account id/);
    assert.match(html, /private Supabase Storage/);
    assert.match(html, /uploads\/companions/);
    assert.match(html, /uploads\/images\//);
    assert.match(html, /uploads\/voice\//);
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
    assert.doesNotMatch(html, /Realtime Database/);
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
    assert.match(html, /confirmation link/);
    assert.match(html, /developer verifies the request from the account's email address/);
    assert.match(html, /What is deleted/);
    assert.match(html, /message reports/);
    assert.match(html, /deletion requests stored for that account email/);
    assert.match(html, /Cancel a Play subscription in Google Play/);
    assert.match(html, /embeddings/);
    assert.match(html, /What is kept/);
    assert.match(html, /30 days/);
    assert.match(html, /Google Play/);
    assert.doesNotMatch(html, /Placeholder\./);
    assert.match(html, /Example Developer/);
});
