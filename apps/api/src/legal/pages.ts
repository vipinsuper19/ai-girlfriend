import {
    ANDROID_PACKAGE,
    APP_NAME,
    CONTACT_EMAIL_PLACEHOLDER,
    DELETION_REQUEST_RETENTION_DAYS,
    DEVELOPER_NAME_PLACEHOLDER,
    contactEmailIsConfigured,
} from './contact.js';
import { escapeHtml, page } from './html.js';

export type LegalIdentity = {
    contactEmail: string;
    developerName: string;
};

function placeholderNote(identity: LegalIdentity): string {
    const missing: string[] = [];
    if (identity.contactEmail === CONTACT_EMAIL_PLACEHOLDER) {
        missing.push('CONTACT_EMAIL');
    }
    if (identity.developerName === DEVELOPER_NAME_PLACEHOLDER) {
        missing.push('DEVELOPER_NAME');
    }
    if (missing.length === 0) return '';
    return `<p><strong>Placeholder.</strong> ${missing.map((name) => `<code>${name}</code>`).join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set. The value below marked TODO has to be replaced before this page is used as the Play Store URL.</p>`;
}

function contactBlock(identity: LegalIdentity): string {
    const email = escapeHtml(identity.contactEmail);
    const developer = escapeHtml(identity.developerName);
    const mailto = contactEmailIsConfigured(identity.contactEmail)
        ? `mailto:${encodeURIComponent(identity.contactEmail)}?subject=${encodeURIComponent(`${APP_NAME} account deletion`)}`
        : 'mailto:TODO';
    return `${placeholderNote(identity)}
<p>Developer: ${developer}</p>
<p>Contact: <a href="${mailto}">${email}</a></p>`;
}

export function privacyHtml(identity: LegalIdentity): string {
    const days = String(DELETION_REQUEST_RETENTION_DAYS);
    return page(`${APP_NAME} privacy policy`, `
<h1>${APP_NAME} privacy policy</h1>
<p>This policy describes the ${APP_NAME} Android app (package ${ANDROID_PACKAGE}) and the API that serves it.</p>
${contactBlock(identity)}

<h2>Account email and password</h2>
<p>Creating an account stores your account email. If you sign up with a password, the server stores a password hash, not the password itself. Your display name is stored when you set one.</p>

<h2>Google sign-in</h2>
<p>Google sign-in uses a Google or Firebase ID token. The server keeps the Google account id, the verified Google email, the name Google sends, and the provider payload on the linked account. A Google sign-in does not take over an existing email-and-password account with the same email.</p>

<h2>Chat messages</h2>
<p>Messages you send and replies the companion sends are stored with the conversation. That includes the text, the role, optional message metadata (such as the model used), and links to any audio or image attached to the message.</p>

<h2>Memories and embeddings</h2>
<p>The app stores memories extracted from chats: the memory text, a type, an importance score, and optional metadata. Each memory can have an embedding, a numeric vector (1536 dimensions) computed so related memories can be searched. Embeddings are produced by Google Gemini. A memory can carry an expiry time; expired memories are left out of search. You can pause new memories.</p>

<h2>Uploaded media and voice</h2>
<p>Companion portraits, voice recordings, and generated gallery images are stored as files on the server and served from <code>/uploads/</code>. Voice notes are sent to Google Gemini for speech-to-text, and spoken replies are synthesized by Gemini text-to-speech. The current public build can hide voice and the gallery. When those features are on, the audio, the transcript, the image prompt, and the image file are processed and stored as described here.</p>

<h2>AI providers: Gemini and OpenAI</h2>
<p>Chat replies, memory embeddings, image generation, speech-to-text, and text-to-speech are sent to Google Gemini, along with the text or audio needed for that request. The server also contains an OpenAI chat provider. It is not the active chat provider today. If it is switched on, the chat text for that request is sent to OpenAI. Those providers process the content under their own terms. This app does not receive your payment details from them.</p>

<h2>Purchases</h2>
<p>Paid plans are purchased through Google Play. Google processes the payment. This app does not collect your card number. When a purchase is verified, the server stores the plan, the status, the expiry, and Google's subscription id. The current public build can hide billing. Cancelling or refunding a purchase is handled by Google Play, not by deleting the app account.</p>

<h2>Other data stored with the account</h2>
<p>The server also stores refresh sessions, companion profiles (name, appearance, personality, and voice settings), usage counts for features such as messages, and, when notifications are enabled, a Firebase Cloud Messaging device token for this install.</p>

<h2>Retention</h2>
<p>Account data, chats, memories, embeddings, media, and purchase records we store are kept until you delete the item or delete the account. Refresh sessions last until they expire (the server default is 30 days), or until you log out, change your password, or delete the account. A web account-deletion request (the email and optional note) is kept for ${days} days and then removed from our request log. Hosting access logs may still contain the IP address and the URL for the host's own log window. This app does not set that window and does not keep a separate backup of a deleted account.</p>

<h2>Deletion</h2>
<p>See <a href="/account-deletion">account deletion</a>. Signed-in users can delete immediately in the app, which calls <code>DELETE /api/v1/users/me</code>.</p>
`);
}

export function accountDeletionHtml(identity: LegalIdentity): string {
    const days = String(DELETION_REQUEST_RETENTION_DAYS);
    const email = escapeHtml(identity.contactEmail);
    const mailto = contactEmailIsConfigured(identity.contactEmail)
        ? `mailto:${encodeURIComponent(identity.contactEmail)}?subject=${encodeURIComponent(`${APP_NAME} account deletion`)}`
        : 'mailto:TODO';
    return page(`Delete your ${APP_NAME} account`, `
<h1>Delete your ${APP_NAME} account</h1>
<p>${APP_NAME} is the Android app with package ${ANDROID_PACKAGE}.</p>
${contactBlock(identity)}

<h2>How to request deletion</h2>
<ol>
<li>In the ${APP_NAME} app, open Settings and tap Delete account. Type DELETE to confirm. That signs you in and calls <code>DELETE /api/v1/users/me</code>. The account is deleted then.</li>
<li>If you cannot open the app, submit the form on this page with the account email. You can also email <a href="${mailto}">${email}</a>. We delete the matching account within ${days} days.</li>
</ol>
<p>The form does not delete the account by itself. It records a request so the developer can delete the account that uses that email.</p>

<form method="post" action="/account-deletion">
<p><label>Account email<br><input name="email" type="email" required autocomplete="email"></label></p>
<p><label>Anything else we should know (optional)<br><textarea name="note" maxlength="2000" rows="4"></textarea></label></p>
<p><button type="submit">Request deletion</button></p>
</form>

<h2>What is deleted</h2>
<p>Deleting the account removes the user row. The database then removes the linked records: the email, display name, and password hash; the Google sign-in link; refresh sessions; companions and their portraits; conversations and chat messages; memories and embeddings; generated images and their files; voice audio files; call records; the subscription rows we stored; usage records; and push device tokens.</p>

<h2>What is kept, and for how long</h2>
<ul>
<li>The deletion request itself (the email address and optional note) is kept for ${days} days so the request can be completed, then it is removed from our request log.</li>
<li>If mail delivery is configured, a copy of the request is emailed to the contact address above and stays in that mailbox until it is deleted there.</li>
<li>Google Play keeps its own record of a purchase under Google's rules. Deleting the ${APP_NAME} account does not cancel a Play subscription. Cancel it in Google Play.</li>
<li>Google Gemini, and OpenAI if that chat provider is later enabled, may retain content that was sent to them while the account existed, under their own policies. We do not keep a separate copy at the provider after the account is deleted.</li>
<li>This app does not keep a backup of the account after deletion. Hosting logs may still list the IP address and the page URL for the host's log window.</li>
</ul>
<p>Also see the <a href="/privacy">privacy policy</a>.</p>
`);
}

export function deletionResultHtml(options: {
    identity: LegalIdentity;
    status: 'received' | 'invalid' | 'limited';
    email?: string;
}): string {
    const days = String(DELETION_REQUEST_RETENTION_DAYS);
    const mailto = contactEmailIsConfigured(options.identity.contactEmail)
        ? `mailto:${encodeURIComponent(options.identity.contactEmail)}?subject=${encodeURIComponent(`${APP_NAME} account deletion`)}`
        : 'mailto:TODO';
    const email = escapeHtml(options.identity.contactEmail);
    let heading = 'Request received';
    let detail = `We stored your deletion request. The ${APP_NAME} account for that email will be deleted within ${days} days. The request itself is kept for ${days} days.`;
    if (options.status === 'invalid') {
        heading = 'Check the email';
        detail = 'Enter the account email and submit the form again.';
    } else if (options.status === 'limited') {
        heading = 'Too many requests';
        detail = `This network has sent too many deletion requests. Wait an hour and try again, or email ${email}.`;
    }
    return page(heading, `
<h1>${heading}</h1>
<p>${detail}</p>
<p>Mailto fallback: <a href="${mailto}">${email}</a></p>
<p><a href="/account-deletion">Back to account deletion</a></p>
`);
}
