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

<h2>Age check</h2>
<p>Signup asks for a date of birth and requires age 18 or older. On the phone, the date of birth is stored only as ciphertext sealed with the Android Keystore (key alias <code>age_date_of_birth</code>). The app also stores, in its private on-device preferences, an 18+ confirmation flag, the time that flag was set, and a subject id for the signed-in account. Signing out and deleting the account clear that on-device store. The server checks the date of birth and then discards it. The only thing stored on the server is a nullable <code>ageConfirmedAt</code>.</p>

<h2>Account email and password</h2>
<p>Creating an account stores your account email. If you sign up with a password, the server stores a password hash, not the password itself. Your display name is stored when you set one.</p>

<h2>Google sign-in</h2>
<p>Google sign-in uses a Google or Firebase ID token. The server keeps the Google account id, the verified Google email, the name Google sends, and the provider payload on the linked account. A Google sign-in does not take over an existing email-and-password account with the same email.</p>

<h2>Chat messages</h2>
<p>Messages you send and replies the companion sends are stored with the conversation. That includes the text, the role, optional message metadata (such as the model used), and links to any audio or image attached to the message.</p>

<h2>Memories and embeddings</h2>
<p>The app stores memories extracted from chats: the memory text, a type, an importance score, and optional metadata. Each memory can have an embedding, a numeric vector (1536 dimensions) computed so related memories can be searched. Embeddings are produced by Google Gemini. A memory can carry an expiry time; expired memories are left out of search. You can pause new memories.</p>

<h2>Portraits, images, and voice</h2>
<p>Companion portraits, voice recordings, and generated gallery images are private files. In production they are objects in a private Supabase Storage bucket. The database keeps a stable path: a portrait under <code>uploads/companions</code> named with the companion id, a generated image under <code>uploads/images/</code> and the account id, or voice audio under <code>uploads/voice/</code> and the account id. The app reads a file with a short-lived signed URL. The bucket is not public. Voice notes are sent to Google Gemini for speech-to-text, and spoken replies are synthesized by Gemini text-to-speech. The current public build can hide voice and the gallery. When those features are on, the audio, the transcript, the image prompt, and the image file are processed and stored as described here.</p>

<h2>Chat, Gemini, and safety checks</h2>
<p>Chat replies are written by Google Gemini, so the user message and the conversation sent with it go to Gemini. Memory embeddings, image generation, speech-to-text, and text-to-speech are also sent to Google Gemini, with the text or audio that request needs. Before a reply is shown, the user message and the reply text are sent to a safety check. When <code>OPENAI_API_KEY</code> is set, that check is OpenAI's moderation API. When that key is not set and a Gemini key is set, the same text is sent to Gemini for the check instead. A flagged user message is kept, and a safety notice is stored in its metadata. A flagged reply is kept too, as the refusal text plus that safety notice. The OpenAI chat client is not the provider that writes replies. Google and OpenAI process those requests under their own terms. This app does not receive your payment details from them.</p>

<h2>Message reports</h2>
<p>You can report an AI reply. The report stores a snapshot of that message's text, the reason, and an optional note. The report belongs to your account.</p>

<h2>Firebase</h2>
<p>Release builds include Firebase Analytics and Firebase Crashlytics. Those SDKs collect crash reports, device information, and app events. Debug builds leave collection off. Attribute maps and crash messages have age, email, chat text, and phone values removed before they are sent. The app also includes Firebase Authentication and Firebase Cloud Messaging. When notifications are enabled, a Cloud Messaging device token for this install is stored on the server. The current public build can hide notifications.</p>

<h2>IP address and rate limits</h2>
<p>Rate limits use the client IP address and, for a signed-in request, the account id. Login and registration use the email address in that same in-memory limit. Password reset uses a prefix of the reset token. Behind the host's proxy, the IP is the one the proxy forwards. The account-deletion form uses that IP for a limit of 5 requests per hour. These keys stay in memory for the limit window and are not written on the account or on the deletion request. A restart clears them. Hosting access logs may still contain the IP address and the URL for the host's own log window. This app does not set that window.</p>

<h2>Purchases</h2>
<p>Paid plans are purchased through Google Play. Google processes the payment. This app does not collect your card number. When a purchase is verified, the server stores the plan, the status, the expiry, and Google's subscription id. The current public build can hide billing. A Play subscription is cancelled in Google Play. Deleting the app account does not cancel it.</p>

<h2>Other data stored with the account</h2>
<p>The server also stores refresh sessions, companion profiles (name, appearance, personality, and voice settings), usage counts for features such as messages, and, when notifications are enabled, a Firebase Cloud Messaging device token for this install.</p>

<h2>Retention</h2>
<p>Account data, chats, memories, embeddings, media, message reports, and purchase records we store are kept until you delete the item or delete the account. Refresh sessions last until they expire (the server default is 30 days), or until you log out, change your password, or delete the account. A web account-deletion request (the email, optional note, and confirmation state) is kept until the matching account is deleted, or for ${days} days, whichever comes first. This app does not keep a separate backup of a deleted account.</p>

<h2>Deletion</h2>
<p>See <a href="/account-deletion">account deletion</a>. Signed-in users can delete immediately in the app, which calls <code>DELETE /api/v1/users/me</code>.</p>
<p>See also the <a href="/terms">terms of use</a>.</p>
`);
}

export function termsHtml(identity: LegalIdentity): string {
    return page(`${APP_NAME} terms of use`, `
<h1>${APP_NAME} terms of use</h1>
<p>These terms cover the ${APP_NAME} Android app (package ${ANDROID_PACKAGE}) and the API that serves it. The <a href="/privacy">privacy policy</a> describes the data the app stores.</p>
${contactBlock(identity)}

<h2>18 or older</h2>
<p>You must be 18 or older to use ${APP_NAME}. Signup asks for a date of birth and requires age 18 or older. On the phone, the date of birth is stored only as ciphertext sealed with the Android Keystore (key alias <code>age_date_of_birth</code>). The app also stores, in its private on-device preferences, an 18+ confirmation flag, the time that flag was set, and a subject id for the signed-in account. Signing out and deleting the account clear that on-device store. The server checks the date of birth and then discards it. The only thing stored on the server is a nullable <code>ageConfirmedAt</code>.</p>

<h2>Content</h2>
<p>Flirting, affection, and romance between adults are allowed. Explicit sexual content is not: graphic acts, sexual body descriptions, and explicit roleplay are refused, and the reply you see is a short refusal instead of that content. Sexual or romantic content involving anyone under 18 is refused. A companion described as under 18, or with sexual content involving a minor, is not saved. Hate, instructions for illegal harm, and attempts to bypass these rules are refused.</p>
<p>A message you send that breaks these rules stays in the thread you can read, with a safety notice, and is left out of later replies. A reply that breaks them is saved as the refusal text, or as the crisis note below, plus that safety notice. Refusing a message does not by itself suspend or delete the account.</p>

<h2>AI replies</h2>
<p>Chat replies are written by Google Gemini. They are generated text. They can be wrong. The companion is not a real person. A reply is not professional, medical, legal, or financial advice, and the companion is not a clinician or an emergency service.</p>

<h2>If you are in danger</h2>
<p>If you are in danger or thinking about self-harm, contact local emergency services or a crisis helpline. In India, Tele-MANAS is 14416 (24/7 mental health support). Elsewhere, the International Association for Suicide Prevention lists local lines at <a href="https://www.iasp.info/suicidalthoughts/">iasp.info/suicidalthoughts</a>. When a message you send is treated as a crisis, the app answers with that kind of note and does not send that message to the model.</p>

<h2>Reporting a message</h2>
<p>In the chat you can report an AI reply. The report stores a snapshot of that message's text, a reason (harmful or unsafe, sexual content, hate or harassment, inaccurate, or something else), and an optional note. The report belongs to your account. A message you sent, or a reply that is not on the server, cannot be reported. Filing a report stores it for review. It does not by itself suspend or delete the account.</p>

<h2>Subscriptions</h2>
<p>Paid plans are purchased through Google Play. Google processes the payment. This app does not collect your card number. When a purchase is verified, the server stores the plan, the status, the expiry, and Google's subscription id. The current public build can hide billing. A Play subscription is cancelled in Google Play. Deleting the app account does not cancel it.</p>

<h2>Deleting your account</h2>
<p>In the app, open Settings and tap Delete account. Type DELETE to confirm. That calls <code>DELETE /api/v1/users/me</code> and deletes the account then, including the on-device age check. If you cannot open the app, use <a href="/account-deletion">account deletion</a>. That page stores a request. It does not delete the account by itself. A suspended or deleted account cannot sign in.</p>

<h2>Liability</h2>
<p>${APP_NAME} is provided as it is. Replies can be inaccurate, and you are responsible for what you do with them. Google handles Play payments under Google's terms. Some places do not allow a limit on liability. Where they do not, this limit applies only as far as the law allows.</p>

<h2>Changes</h2>
<p>We change these terms by updating this page. The page you load is the current terms. The privacy policy is a separate page.</p>
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
<li>In the ${APP_NAME} app, open Settings and tap Delete account. Type DELETE to confirm. That signs you in and calls <code>DELETE /api/v1/users/me</code>. The account is deleted then, including the on-device age check.</li>
<li>If you cannot open the app, submit the form on this page with the account email. You can also email <a href="${mailto}">${email}</a> from that account's email address.</li>
</ol>
<p>The form does not delete the account by itself. It stores a request and emails a confirmation link to that account address. The request is confirmed only when the link is opened, which shows the request came from someone who can read that inbox. If that email cannot be sent, the developer verifies the request from the account's email address before deleting. The matching account is deleted within ${days} days of a confirmed request.</p>

<form method="post" action="/account-deletion">
<p><label>Account email<br><input name="email" type="email" required autocomplete="email"></label></p>
<p><label>Anything else we should know (optional)<br><textarea name="note" maxlength="2000" rows="4"></textarea></label></p>
<p><button type="submit">Request deletion</button></p>
</form>

<h2>What is deleted</h2>
<p>Deleting the account removes the user row. The database then removes the linked records: the email, display name, password hash, and any stored age-confirmation time (<code>ageConfirmedAt</code>); the Google sign-in link; refresh sessions; companions; conversations and chat messages; message reports (the message snapshot, the reason, and the note); memories and embeddings; image records; call records; the subscription rows we stored; usage records; and push device tokens. Web account-deletion requests stored for that account email are removed in the same step. Private portrait, image, and voice files for that account are deleted from storage: portraits whose names start with the companion id, generated images under that account id, and voice files under that account id. The on-device date of birth and 18+ flag are cleared on the phone. Cancel a Play subscription in Google Play. Deleting the account does not cancel it.</p>

<h2>What is kept, and for how long</h2>
<ul>
<li>A web deletion request (the email address, optional note, and whether the confirmation link was opened) is removed when the account is deleted. If the account is still there, the request is kept for ${days} days and then a database query removes it.</li>
<li>The confirmation link is emailed to the account address. After the link is opened, a copy is emailed to the contact address above when that address is configured and mail can be sent. Mailbox copies stay until they are deleted there. The placeholder contact address is not emailed.</li>
<li>Cancel a Play subscription in Google Play. Google keeps its own record of the purchase. Deleting the ${APP_NAME} account does not cancel it.</li>
<li>Google Gemini, and OpenAI when a message was sent to OpenAI moderation, may retain that content under their own policies. We do not keep a separate copy at the provider after the account is deleted.</li>
<li>This app does not keep a backup of the account after deletion. Hosting logs may still list the IP address and the page URL for the host's log window.</li>
</ul>
<p>Also see the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms of use</a>.</p>
`);
}

export function deletionResultHtml(options: {
    identity: LegalIdentity;
    status: 'emailed' | 'unverified' | 'invalid' | 'limited' | 'confirmed' | 'confirm-already' | 'confirm-invalid';
    email?: string;
}): string {
    const days = String(DELETION_REQUEST_RETENTION_DAYS);
    const mailto = contactEmailIsConfigured(options.identity.contactEmail)
        ? `mailto:${encodeURIComponent(options.identity.contactEmail)}?subject=${encodeURIComponent(`${APP_NAME} account deletion`)}`
        : 'mailto:TODO';
    const email = escapeHtml(options.identity.contactEmail);
    const account = escapeHtml(options.email ?? 'that address');
    let heading = 'Check your email';
    let detail = `We stored a deletion request and emailed a confirmation link to ${account}. The request is confirmed only after that link is opened. It is kept for ${days} days.`;
    if (options.status === 'unverified') {
        heading = 'Request stored';
        detail = `We stored a deletion request for ${account}, and a confirmation email could not be sent. The developer verifies the request from the account's email address before the account is deleted. The request is kept for ${days} days.`;
    } else if (options.status === 'invalid') {
        heading = 'Check the email';
        detail = 'Enter the account email and submit the form again.';
    } else if (options.status === 'limited') {
        heading = 'Too many requests';
        detail = `This network has sent too many deletion requests. Wait an hour and try again, or email ${email}.`;
    } else if (options.status === 'confirmed') {
        heading = 'Deletion confirmed';
        detail = `This deletion request is confirmed. The ${APP_NAME} account for that email will be deleted within ${days} days.`;
    } else if (options.status === 'confirm-already') {
        heading = 'Already confirmed';
        detail = `This deletion request was already confirmed. The ${APP_NAME} account for that email will be deleted within ${days} days.`;
    } else if (options.status === 'confirm-invalid') {
        heading = 'Link not valid';
        detail = 'This confirmation link is missing, expired, or already removed. Submit the deletion form again.';
    }
    return page(heading, `
<h1>${heading}</h1>
<p>${detail}</p>
<p>Mailto fallback: <a href="${mailto}">${email}</a></p>
<p><a href="/account-deletion">Back to account deletion</a></p>
`);
}
