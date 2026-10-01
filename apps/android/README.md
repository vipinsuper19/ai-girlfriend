# Android app (Lumen)

Standalone Gradle project. Open `apps/android` in Android Studio.

## Local API

The emulator reaches the host machine at `10.0.2.2`. Default base URL:

```
http://10.0.2.2:3001/api/v1/
```

Override in `local.properties`:

```
API_BASE_URL=http://10.0.2.2:3001/api/v1/
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

`POST /auth/google` is not implemented in the Nest API yet. Email login and register talk to the live endpoints. Google UI is wired through Credential Manager and will fail with the designed banner until that endpoint exists.

## Run

```
cd apps/android
./gradlew :app:assembleDebug
```
