# Android Maestro flows

End-to-end UI flows for `apps/android`, aimed at a GitHub Actions emulator job. This directory does not add that workflow. Wire the job in `.github/workflows` separately.

The entry point is [`run-all.sh`](run-all.sh). It builds the debug APK, installs it, and runs every flow below. [`run-offline.sh`](run-offline.sh) is the only flow that toggles the network.

## What the job needs

- A booted Android emulator, **API 34**, **x86_64**. `reactivecircus/android-emulator-runner` is the expected runner.
- Profile **pixel_6** (or another tall phone). The sign-up form and the date picker need the height.
- Locale **en_US**. The date picker input mode types `MMDDYYYY`. The app then shows the date in US English (`January 15, 1990`), regardless of the device locale, but the picker itself follows the device locale.
- Animations off. `run-all.sh` sets the three animator scales to 0. The runner's `disable-animations: true` is still worth setting.
- `adb` and `maestro` on `PATH`. Install Maestro with the [published installer](https://get.maestro.mobile.dev) (`curl -Ls "https://get.maestro.mobile.dev" | bash`).
- JDK 17 and the Android SDK, same as the existing Android CI job (`actions/setup-java`, `android-actions/setup-android`).
- `apps/android/app/google-services.json` present **before** `assembleDebug`. Email sign-up uses Firebase Auth. The debug APK still compiles without that file, but these flows cannot create an account without it. Supply it from a CI secret. Do not commit it, and do not put a real user's password in the job.
- The test API reachable from the emulator over HTTPS. The default is `https://ai-girlfriend-tnu3.onrender.com/api/v1/`. Render's free instance can take about a minute to wake. The app's connect budget is 90 seconds, and a failed chat send tries the stream and then a blocking post, so a single chat step can sit for around three minutes.
- Give the job a **90 minute** timeout. The suite creates a new throwaway account per flow and several of those calls wait on that cold start.
- One emulator, one `run-all.sh`. The flows share the device and are not safe to run in parallel.
- No Play Console steps. Billing and phone sign-in are off in this build.

Cleartext HTTP is allowed only for `10.0.2.2` and `localhost` (`app/src/main/res/xml/network_security_config.xml`). The default test API is HTTPS. `http://10.0.2.2:3001/api/v1/` still works when the API is on the host machine.

## API base URL

The URL is not hardcoded in the flows and it is not a secret. `run-all.sh` reads `API_BASE_URL` and passes it to Gradle:

```bash
./gradlew assembleDebug -PAPI_BASE_URL_DEBUG="${API_BASE_URL}"
```

`API_BASE_URL_DEBUG` is the existing debug override in `app/build.gradle.kts` (environment, `-P`, or `local.properties`). It wins over the local fallback `http://10.0.2.2:3001/api/v1/`. Release builds are unchanged.

The same value is passed to Maestro as `-e API_BASE_URL=...`. Flows read it only to print the target in the report. The app binary is what actually calls the server, so change the URL by rebuilding. `SKIP_BUILD=1` skips Gradle and `adb install` when the installed debug APK was already built with the URL you want.

```bash
cd apps/android
API_BASE_URL=https://ai-girlfriend-tnu3.onrender.com/api/v1/ ./.maestro/run-all.sh
```

Override the synthetic password or companion name if you need to. `QA_PASSWORD` must be at least 8 characters and include a letter and a digit. `COMPANION_NAME` should be plain letters, 2 to 100 characters. The default password is `Maestro123`. The flows invent `qa+<timestamp>@example.com` and type that password while creating the account. Do not set these to a real person's credentials.

```bash
API_BASE_URL=https://ai-girlfriend-tnu3.onrender.com/api/v1/ \
QA_PASSWORD='Maestro123' \
COMPANION_NAME='Mae' \
./.maestro/run-all.sh
```

`ANDROID_SERIAL` selects the emulator when more than one device is attached. `adb` and `maestro` both honor it.

## Accounts

Each top-level flow launches with `clearState: true`, so it starts logged out. Flows that need a session sign up a new `qa+…@example.com` user. Those users are left on Firebase and the API, except flow 09, which deletes the API account it created. There is no cleanup job here.

Sign-up stores the age check on the device. Log out clears it. The next login stops on **Confirm your age** before home, even when the companion still exists on the server.

Voice, gallery, push, billing, and phone sign-in are off (`featureVoice` and the other flags in `app/build.gradle.kts`). The wizard is three steps, not four. Turning voice on makes flow 03 fail at `Step 1 of 3`.

## Known failure

`flows/08-privacy-terms.yaml` is expected to fail. `WelcomeScreen.kt` Terms and Privacy handlers only call `Log.d`. Do not change those handlers to make the flow pass. `run-all.sh` records that failure as the expected result and continues. If the flow starts passing, the script fails on purpose so the known-failure mark can be removed.

`maestro test apps/android/.maestro` skips that flow, the helper subflows, and the offline parts (`config.yaml` `excludeTags`). Use `run-all.sh` in CI so the known failure is still executed and the network is toggled with adb.

## Network

Only flow 05 drops the network. `run-offline.sh` uses:

```bash
adb shell cmd connectivity airplane-mode enable
adb shell cmd connectivity airplane-mode disable
```

API 34 emulators accept that without root. If the command fails, the script falls back to `adb shell svc wifi disable` and `adb shell svc data disable`. It waits until `adb shell ping -c 1 -W 2 8.8.8.8` succeeds before tapping Retry, and a trap turns airplane mode back off if the flow fails. No other flow should run while airplane mode is on.

## Flows

Resource ids below are Compose test tags (`Modifier.testId`). They show up to Maestro as `id`.

| Flow | File | Network toggle |
|---|---|---|
| 1 Age gate | `flows/01-age-gate.yaml` | No |
| 2 Sign up, log out, log in | `flows/02-signup-logout-login.yaml` | No |
| 3 Companion wizard | `flows/03-companion-wizard.yaml` | No |
| 4 Chat stream | `flows/04-chat-stream.yaml` | No |
| 5 Offline / retry | `run-offline.sh` (`offline/05a`–`05c`) | Yes, adb airplane mode |
| 6 Composer cap | `flows/06-composer-limit.yaml` | No |
| 7 Report | `flows/07-report-message.yaml` | No |
| 8 Privacy and Terms | `flows/08-privacy-terms.yaml` | No. Known failure |
| 9 Delete account | `flows/09-delete-account.yaml` | No |

### 1. Age gate

Preconditions: fresh install, welcome screen, en-US date picker, API and Firebase available for the adult sign-up.

Steps: open sign-up, enter the throwaway email and password, set the date of birth to 15 Jan 2015, check "I am 18 or older", tap Sign up. Then change the date to 15 Jan 1990 and tap Sign up again.

Expected: the under-18 attempt stays on "Create your account" and shows "You must be 18 or older to create an account." The adult attempt leaves that error and opens the wizard ("Let's create her.").

### 2. Sign up, log out, log in

Preconditions: same as flow 1, plus a working `POST /auth/register` on `API_BASE_URL`. Log out is on the You tab, so this flow also creates a companion (same steps as flow 3) to reach it.

Steps: sign up as an adult, finish the wizard, You → Log out, log in with the same email and password, confirm age again.

Expected: after logout the welcome screen is back. After login and the age screen, Home shows the companion name and "Say hello".

### 3. Companion wizard

Preconditions: adult sign-up works. `featureVoice` is false.

Steps: Start, choose Illustrated, Continue, choose Witty, Continue, name her (default `Mae`), tap Meet.

Expected: headings "How should she look", "Who is she", and the name field, with "Step 1 of 3" through "Step 3 of 3". Home shows that name and "Say hello".

### 4. Chat stream

Preconditions: flow 3, then Chat. The first visit shows "You're talking to an AI"; the flow taps "I understand".

Steps: type `Hello from the emulator`, tap Send.

Expected: the user bubble shows that text (`chat_user_message`). A non-empty assistant bubble appears (`chat_assistant_reply`). The flow does not assert the reply text. The greeting and a failed send do not use that id. Timeout is 180 seconds because the API may be waking up.

### 5. Offline / retry

Preconditions: same signed-in chat as flow 4, still online through `offline/05a-reach-chat.yaml`. Then `run-offline.sh` enables airplane mode before `05b`, and restores it before `05c`.

Steps: with the network off, send `This send should fail offline`. After "Not sent · Retry" is visible, restore the network and tap that control.

Expected: the failed send shows `chat_retry` with "Not sent · Retry" and does not show `chat_assistant_reply`. After Retry, `chat_assistant_reply` appears (again, any non-empty assistant text). The retry control can take up to about three minutes to show, because a down connection still waits out the 90 second connect budget and then the blocking fallback. Do not run this file trio by hand without the wrapper, or the device will not change network between them.

### 6. Composer 7000-character cap

Preconditions: chat composer focused, AI disclosure already accepted (the flow does that).

Steps: paste 7100 `a` characters into `chat_composer` (`setClipboard` + `pasteText`). Maestro may deliver that paste as a long text input, so this step can take several minutes.

Expected: either the field keeps 7000 characters, or it keeps a different length and `chat_draft_limit` shows a counter matching `[0-9]+ / 7000` (today that is `7100 / 7000. Shorten it to send.`). The flow does not send the draft.

### 7. Report

Preconditions: a streamed assistant reply from the same steps as flow 4, so the reply has a server id.

Steps: long-press `chat_assistant_reply`, tap Report message, choose Inaccurate, tap Send report.

Expected: the dialog shows "Thanks. We'll review this reply." (`report_thanks`).

### 8. Privacy and Terms (known failure)

Preconditions: welcome screen only. No account.

Steps: tap Terms (`welcome_terms`). Expect welcome to go away and a terms page to be visible. Then Privacy (`welcome_privacy`) and a page that contains "privacy policy".

Expected result today: **failure**. Both handlers only log. `run-all.sh` treats that failure as success for this flow. An unexpected pass fails the script.

### 9. Delete account

Preconditions: an adult account with a companion, on the API that `API_BASE_URL` points at.

Steps: You → Delete account, type `DELETE`, confirm. On the welcome screen, log in with the same email and password.

Expected: welcome returns after deletion. Login stays on "Login to your account", shows `login_error`, and does not open Home or the wizard.

The in-app delete calls `DELETE /users/me` and then signs Firebase out on the phone. It does not delete the Firebase Auth user. `ApiClient.establish` will also try to register again if the API login fails. If sign-in still succeeds after deletion, this flow fails until login is actually rejected. That is the assertion this flow is here to make.

## Suggested emulator step

Not a workflow file. Drop this inside the job DevOps owns. `google-services.json` has to be on disk before `run-all.sh`.

```yaml
- name: Maestro flows
  uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 34
    arch: x86_64
    target: google_apis
    profile: pixel_6
    locale: en_US
    disable-animations: true
    emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim
    script: |
      curl -Ls "https://get.maestro.mobile.dev" | bash
      export PATH="$PATH:$HOME/.maestro/bin"
      cd apps/android
      API_BASE_URL="${API_BASE_URL:-https://ai-girlfriend-tnu3.onrender.com/api/v1/}" \
        ./.maestro/run-all.sh
```

Set the job timeout to 90 minutes. Cache Gradle the same way the existing Android job does, if this step shares that setup.
