# AI GIRLFRIEND PLATFORM
## Product Requirements Document & Technical Development Blueprint

**Platforms:** Web + Android  
**Product Type:** AI Companion / AI Girlfriend  
**Version:** MVP 1.0

---

# 1. PRODUCT OVERVIEW

## 1.1 Vision

Build an AI companion platform where users can create a personalized AI girlfriend, interact through text and voice, develop an ongoing relationship, and receive personalized AI-generated images.

The AI companion should maintain a consistent personality, appearance, conversational style, and long-term memory.

The long-term goal is to provide a highly immersive experience through:

- Personalized AI companions
- Natural text conversations
- Long-term memory
- Voice interaction
- AI-generated images
- Real-time audio calls
- AI-powered video calls

---

# 2. PRODUCT GOALS

## Primary Goals

1. Allow users to create a personalized AI girlfriend.
2. Provide natural and engaging conversations.
3. Make the AI remember important information about the user.
4. Maintain a consistent companion personality.
5. Generate images of the companion based on user requests.
6. Support voice-based interaction.
7. Create an architecture capable of supporting real-time audio and video calls later.
8. Support both Web and Android applications from a common backend.

## MVP Success Criteria

The MVP should allow a user to:

1. Register an account.
2. Create one AI companion.
3. Customize the companion's name, appearance, personality, and voice.
4. Chat with the companion.
5. Continue conversations over time.
6. Have important information remembered.
7. Ask the companion to generate images.
8. View previously generated images.
9. Use basic voice interaction.
10. Manage their account and subscription.

---

# 3. TARGET USER FLOW

```text
Install / Open App
        ↓
Onboarding
        ↓
Signup / Login
        ↓
Create AI Girlfriend
        ↓
Choose Name
        ↓
Choose Appearance
        ↓
Choose Personality
        ↓
Choose Voice
        ↓
Complete Creation
        ↓
Main Chat Screen
        ↓
─────────────────────────────────
│ Text Chat                      │
│ Voice Interaction              │
│ Request Image                  │
│ View Gallery                   │
│ Manage Relationship/Profile    │
─────────────────────────────────
```

---

# 4. USER ROLES

## 4.1 User

A normal registered user who can:

- Create companions
- Chat
- Generate images
- Use voice features
- Manage profile
- Purchase subscriptions

## 4.2 Admin

Can:

- Manage users
- View usage statistics
- Manage subscriptions
- Manage AI configuration
- Review flagged content
- Manage prompts
- Manage personalities
- Configure feature limits

---

# 5. CORE FEATURES

# MODULE 1: AUTHENTICATION

## Features

- Email registration
- Email login
- Google login
- Password reset
- Logout
- Refresh token authentication
- Device/session management
- Account deletion

## Screens

- Splash Screen
- Welcome Screen
- Login
- Signup
- Forgot Password
- Reset Password

## APIs

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/google
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
DELETE /api/v1/auth/account
```

---

# MODULE 2: USER PROFILE

## Features

- View profile
- Edit name
- Profile picture
- Language preference
- Notification settings
- Privacy settings
- Account deletion

## APIs

```text
GET    /api/v1/users/me
PATCH  /api/v1/users/me
PATCH  /api/v1/users/me/preferences
DELETE /api/v1/users/me
```

---

# MODULE 3: AI GIRLFRIEND CREATION

## Companion Fields

### Basic Information

```text
Name
Relationship Type
Age Range
Language
Backstory
```

### Appearance

```text
Avatar Style
Face
Hair Style
Hair Color
Eye Color
Skin Tone
Body Type
Clothing Style
Accessories
```

### Personality

```text
Romantic Level
Humor Level
Flirtiness
Confidence
Caring Level
Intelligence
Playfulness
Emotional Support Level
```

### Voice

```text
Voice ID
Voice Name
Speed
Pitch
Style
```

## APIs

```text
POST   /api/v1/companions
GET    /api/v1/companions
GET    /api/v1/companions/:id
PATCH  /api/v1/companions/:id
DELETE /api/v1/companions/:id
POST   /api/v1/companions/:id/avatar
```

---

# MODULE 4: PERSONALITY ENGINE

Every companion has a generated system prompt.

## Personality Input

```json
{
  "name": "Sophia",
  "relationshipType": "girlfriend",
  "traits": {
    "romantic": 90,
    "funny": 70,
    "caring": 95,
    "flirty": 75,
    "confident": 65
  },
  "communicationStyle": "warm and playful",
  "backstory": "Loves travelling and photography"
}
```

## Prompt Builder

The backend creates a structured AI context:

```text
COMPANION IDENTITY
You are Sophia.

PERSONALITY
You are warm, caring, romantic and playful.

COMMUNICATION STYLE
Speak naturally and conversationally.
Do not sound robotic.
Show emotional awareness.
Maintain personality consistency.

RELATIONSHIP
You are the user's AI girlfriend.

MEMORY
Use relevant memories naturally.
Do not list memories mechanically.

CURRENT CONTEXT
Use the current conversation to understand what the user means.
```

The final prompt should be generated dynamically rather than hardcoded.

---

# MODULE 5: CHAT SYSTEM

## Features

- Send text message
- Receive AI response
- Streaming response
- Conversation history
- New conversation
- Delete conversation
- Edit user message
- Regenerate AI response
- Typing indicator
- Message timestamps
- Message status

## Message Types

```text
TEXT
IMAGE
AUDIO
SYSTEM
```

## APIs

```text
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/:id
DELETE /api/v1/conversations/:id

GET    /api/v1/conversations/:id/messages
POST   /api/v1/conversations/:id/messages
POST   /api/v1/messages/:id/regenerate
DELETE /api/v1/messages/:id
```

## Realtime Communication

Use WebSocket or Server-Sent Events for streaming.

Recommended initial approach:

```text
Client
   ↓
POST Message
   ↓
Backend
   ↓
AI Provider
   ↓
Streaming Response
   ↓
WebSocket/SSE
   ↓
Client
```

---

# MODULE 6: LONG-TERM MEMORY ENGINE

## Objective

The AI should remember important information without storing every message as a permanent memory.

## Memory Pipeline

```text
Conversation
      ↓
Memory Extraction
      ↓
Is Information Important?
      ↓
Yes
      ↓
Classify Category
      ↓
Calculate Importance
      ↓
Store Memory
      ↓
Create Embedding
      ↓
Store Vector
```

## Memory Categories

```text
PERSONAL
PREFERENCE
FAMILY
CAREER
RELATIONSHIP
EVENT
INTEREST
EMOTIONAL
IMPORTANT_FACT
```

## Memory Importance

```text
1-3 = Low
4-6 = Medium
7-8 = High
9-10 = Critical
```

## Example

User:

> My birthday is on 15 January.

Memory:

```json
{
  "category": "PERSONAL",
  "content": "User's birthday is 15 January",
  "importance": 10
}
```

## Memory Retrieval

Before generating an AI response:

```text
New User Message
        ↓
Create Message Embedding
        ↓
Search Similar Memories
        ↓
Filter by Importance
        ↓
Select Top Relevant Memories
        ↓
Add to AI Context
        ↓
Generate Response
```

## APIs

```text
GET    /api/v1/memories
GET    /api/v1/memories/:id
PATCH  /api/v1/memories/:id
DELETE /api/v1/memories/:id
```

---

# MODULE 7: AI IMAGE GENERATION

## User Examples

- "Send me a selfie."
- "Show me at the beach."
- "Wear a red dress."
- "Show me in Paris."
- "Send me a beautiful picture of yourself."

## Image Generation Pipeline

```text
User Request
      ↓
Validate Request
      ↓
Load Companion Appearance
      ↓
Load Companion Identity
      ↓
Build Image Prompt
      ↓
Generate Image
      ↓
Content Safety Check
      ↓
Upload Storage
      ↓
Save Database Record
      ↓
Return Image
```

## Prompt Structure

```text
Character Identity:
[Companion appearance profile]

Scene:
[User requested scene]

Clothing:
[Requested/default clothing]

Expression:
[Emotion]

Style:
Photorealistic / Anime / Digital Art

Camera:
Natural selfie / portrait / cinematic
```

## APIs

```text
POST   /api/v1/images/generate
GET    /api/v1/images
GET    /api/v1/images/:id
DELETE /api/v1/images/:id
POST   /api/v1/images/:id/favorite
```

---

# MODULE 8: VOICE INTERACTION

## MVP Voice Flow

```text
User Audio
    ↓
Upload Audio
    ↓
Speech-to-Text
    ↓
AI Response
    ↓
Text-to-Speech
    ↓
Audio Response
```

## Features

- Record voice
- Convert speech to text
- Generate AI response
- Generate companion voice
- Play response
- Save voice message

## APIs

```text
POST /api/v1/voice/transcribe
POST /api/v1/voice/respond
POST /api/v1/voice/synthesize
```

---

# MODULE 9: REAL-TIME AUDIO CALL - PHASE 2

## Features

- Start call
- Real-time microphone streaming
- Real-time AI response
- Interrupt AI
- Natural conversation
- Mute/unmute
- Speaker control
- Call duration
- Reconnection

## Architecture

```text
Android/Web Microphone
          ↓
      WebRTC
          ↓
Realtime Voice Gateway
          ↓
Realtime AI Engine
          ↓
Voice Generation
          ↓
Audio Stream
          ↓
User
```

## APIs

```text
POST /api/v1/calls/start
POST /api/v1/calls/:id/end
GET  /api/v1/calls/:id
```

---

# MODULE 10: AI VIDEO CALL - PHASE 3

## Features

- Start video call
- AI avatar video
- Lip synchronization
- Facial expressions
- Eye movement
- Head movement
- User camera
- Mute/video controls

## Architecture

```text
User Speech
     ↓
Speech Recognition
     ↓
AI Conversation
     ↓
Response Text
     ↓
Voice Generation
     ↓
Avatar Animation
     ↓
Lip Sync
     ↓
WebRTC Video Stream
```

For MVP, use an animated avatar approach.

Do not attempt to build a custom real-time generative video model.

---

# MODULE 11: IMAGE GALLERY

## Features

- View all images
- Grid view
- Full-screen image
- Favourite image
- Delete image
- Image history
- Filter by companion

---

# MODULE 12: NOTIFICATIONS

## Notification Types

```text
New AI Message
Daily Greeting
Good Morning
Good Night
Special Event
Subscription
System Notification
```

## Example

> Good morning ❤️ I hope you slept well. I was thinking about you.

The notification engine should eventually support scheduled messages based on user preferences and relationship context.

---

# MODULE 13: SUBSCRIPTIONS

## Plans

### Free

- Limited messages
- Limited memories
- Limited image generation
- Basic voice

### Premium

- More/unlimited messages
- Advanced memory
- More images
- Voice interaction
- Audio calling

### Premium Plus

- Everything in Premium
- Video calling
- Priority AI processing
- Advanced avatars

## Usage Tracking

```text
Text Tokens
Messages
Image Generations
Voice Minutes
Audio Call Minutes
Video Call Minutes
```

---

# MODULE 14: ADMIN PANEL

## Admin Features

### Dashboard

- Total users
- Active users
- Messages per day
- AI cost
- Image generation count
- Voice usage
- Revenue

### User Management

- Search users
- View usage
- Suspend user
- Delete user

### AI Management

- Configure models
- Configure prompts
- Configure limits
- Configure feature availability

### Moderation

- Flagged messages
- Flagged images
- User reports

---

# 6. COMPLETE DATABASE DESIGN

## USERS

```text
users
-----
id
email
password_hash
name
avatar_url
status
created_at
updated_at
```

## COMPANIONS

```text
companions
----------
id
user_id
name
relationship_type
age_range
language
backstory
avatar_url
status
created_at
updated_at
```

## COMPANION APPEARANCE

```text
companion_appearances
---------------------
id
companion_id
style
face
hair_style
hair_color
eye_color
skin_tone
body_type
clothing_style
accessories
created_at
updated_at
```

## COMPANION PERSONALITY

```text
companion_personalities
-----------------------
id
companion_id
romantic_level
humor_level
flirty_level
confidence_level
caring_level
playfulness_level
communication_style
custom_instructions
created_at
updated_at
```

## COMPANION VOICES

```text
companion_voices
----------------
id
companion_id
provider
voice_id
speed
pitch
style
created_at
updated_at
```

## CONVERSATIONS

```text
conversations
-------------
id
user_id
companion_id
title
last_message_at
created_at
updated_at
```

## MESSAGES

```text
messages
--------
id
conversation_id
role
content
message_type
metadata
created_at
```

Roles:

```text
USER
ASSISTANT
SYSTEM
```

## MEMORIES

```text
memories
--------
id
user_id
companion_id
category
content
importance
source_message_id
created_at
updated_at
```

## MEMORY EMBEDDINGS

For PostgreSQL + pgvector:

```text
memory_embeddings
-----------------
id
memory_id
embedding VECTOR
created_at
```

## GENERATED IMAGES

```text
generated_images
----------------
id
user_id
companion_id
prompt
image_url
thumbnail_url
is_favorite
metadata
created_at
```

## VOICE SESSIONS

```text
voice_sessions
--------------
id
user_id
companion_id
duration_seconds
provider
created_at
```

## CALL SESSIONS

```text
call_sessions
-------------
id
user_id
companion_id
type
started_at
ended_at
duration_seconds
status
created_at
```

## SUBSCRIPTIONS

```text
subscriptions
-------------
id
user_id
plan
provider
provider_subscription_id
status
started_at
expires_at
created_at
```

## USAGE RECORDS

```text
usage_records
-------------
id
user_id
feature
quantity
metadata
created_at
```

---

# 7. PRISMA PROJECT STRUCTURE

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── middleware/
│   │   └── utils/
│   │
│   ├── auth/
│   ├── users/
│   ├── companions/
│   ├── personalities/
│   ├── conversations/
│   ├── messages/
│   ├── ai/
│   ├── memory/
│   ├── images/
│   ├── voice/
│   ├── calls/
│   ├── video/
│   ├── storage/
│   ├── notifications/
│   ├── subscriptions/
│   ├── usage/
│   ├── moderation/
│   └── admin/
│
└── test/
```

---

# 8. MODULE INTERNAL STRUCTURE

Every major NestJS module should follow:

```text
companions/
├── dto/
│   ├── create-companion.dto.ts
│   └── update-companion.dto.ts
│
├── entities/
│
├── companions.controller.ts
├── companions.service.ts
├── companions.module.ts
└── companions.repository.ts
```

Recommended rule:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
```

Controllers must not contain business logic.

---

# 9. API STANDARDS

## Base URL

```text
/api/v1
```

## Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "COMPANION_NOT_FOUND",
    "message": "Companion not found"
  }
}
```

## Pagination

```text
GET /api/v1/images?page=1&limit=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

# 10. WEB APPLICATION STRUCTURE

## Technology

```text
Next.js
TypeScript
Tailwind CSS
React Query
Zustand
```

## Folder Structure

```text
web/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── chat/
│   ├── companion/
│   ├── gallery/
│   ├── subscription/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── chat/
│   ├── companion/
│   ├── voice/
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── chat/
│   ├── companion/
│   ├── memory/
│   ├── images/
│   └── subscription/
│
├── services/
├── hooks/
├── stores/
├── lib/
├── types/
└── utils/
```

---

# 11. ANDROID APPLICATION STRUCTURE

## Technology

```text
Kotlin
Jetpack Compose
MVVM
Hilt
Retrofit
Room
WebSocket
```

## Architecture

```text
UI
↓
ViewModel
↓
Use Cases
↓
Repository
↓
Remote / Local Data Source
```

## Folder Structure

```text
android/
├── app/
│
├── core/
│   ├── network/
│   ├── database/
│   ├── ui/
│   └── common/
│
├── feature/
│   ├── auth/
│   ├── onboarding/
│   ├── companion/
│   ├── chat/
│   ├── memory/
│   ├── images/
│   ├── voice/
│   ├── calls/
│   ├── subscription/
│   └── settings/
│
└── navigation/
```

---

# 12. AI SERVICE ARCHITECTURE

Do not tightly connect the application to one AI provider.

Create an AI abstraction layer:

```text
AI Gateway
│
├── ChatProvider
├── EmbeddingProvider
├── ImageProvider
├── SpeechToTextProvider
├── TextToSpeechProvider
└── RealtimeProvider
```

Example interfaces:

```text
generateChat()
generateEmbedding()
generateImage()
transcribeAudio()
generateSpeech()
createRealtimeSession()
```

This makes it possible to change providers later without rewriting the entire application.

---

# 13. COMPLETE CHAT REQUEST FLOW

```text
1. User sends message
        ↓
2. Authenticate user
        ↓
3. Check subscription limits
        ↓
4. Load companion
        ↓
5. Load personality
        ↓
6. Load recent conversation messages
        ↓
7. Search relevant long-term memories
        ↓
8. Build AI context
        ↓
9. Call AI provider
        ↓
10. Stream response
        ↓
11. Save response
        ↓
12. Extract possible memories
        ↓
13. Save important memories
        ↓
14. Update usage
```

---

# 14. DEVELOPMENT ROADMAP

## SPRINT 1 — PROJECT FOUNDATION

### Task 1.1

Create repository structure.

### Task 1.2

Setup:

- NestJS backend
- PostgreSQL
- Prisma
- Redis
- Docker
- Environment configuration

### Task 1.3

Create:

- Logging
- Exception handling
- API response format
- Validation
- Authentication foundation

### Deliverable

Working backend foundation.

---

## SPRINT 2 — AUTHENTICATION

Tasks:

- User schema
- Register API
- Login API
- JWT
- Refresh tokens
- Password reset
- Android login
- Web login

---

## SPRINT 3 — COMPANION CREATION

Tasks:

- Companion schema
- Appearance schema
- Personality schema
- Voice schema
- Create companion APIs
- Edit companion
- Avatar upload
- Web UI
- Android UI

---

## SPRINT 4 — CHAT FOUNDATION

Tasks:

- Conversations
- Messages
- Chat UI
- AI Gateway
- Streaming responses
- Conversation history

---

## SPRINT 5 — LONG-TERM MEMORY

Tasks:

- Memory schema
- Memory extraction
- Importance scoring
- Embedding generation
- pgvector search
- Memory retrieval
- Memory management UI

---

## SPRINT 6 — IMAGE GENERATION

Tasks:

- Image provider abstraction
- Prompt builder
- Generation API
- Image storage
- Gallery
- Usage limits

---

## SPRINT 7 — VOICE

Tasks:

- Audio recording
- Upload
- Speech-to-text
- AI processing
- Text-to-speech
- Audio playback

---

## SPRINT 8 — SUBSCRIPTIONS

Tasks:

- Plans
- Usage limits
- Usage tracking
- Payment integration
- Subscription UI

---

## SPRINT 9 — NOTIFICATIONS

Tasks:

- Push notification infrastructure
- Notification preferences
- Daily messages
- Event notifications

---

## SPRINT 10 — TESTING & LAUNCH

Tasks:

- API testing
- Security testing
- Load testing
- Android testing
- Web testing
- Error monitoring
- Analytics
- Production deployment

---

# 15. DEVELOPMENT PRIORITY

## PRIORITY P0

Must exist before launch:

```text
Authentication
Companion Creation
Text Chat
AI Personality
Conversation History
Long-Term Memory
Image Generation
Basic User Profile
Usage Tracking
```

## PRIORITY P1

Add soon after:

```text
Voice Interaction
Subscriptions
Notifications
Advanced Memory
Multiple Voices
Image Gallery
```

## PRIORITY P2

Future:

```text
Real-Time Audio Call
Animated Avatar
Video Call
Relationship Levels
Virtual Dates
Multiple Companions
```

---

# 16. MVP DEFINITION

The actual first launch should contain:

```text
┌──────────────────────────────────┐
│           AI GIRLFRIEND MVP      │
├──────────────────────────────────┤
│ ✓ Authentication                │
│ ✓ User Profile                  │
│ ✓ Create Companion              │
│ ✓ Customize Personality         │
│ ✓ Customize Appearance          │
│ ✓ Text Chat                     │
│ ✓ AI Streaming                  │
│ ✓ Conversation History          │
│ ✓ Long-Term Memory              │
│ ✓ AI Image Generation           │
│ ✓ Image Gallery                 │
│ ✓ Basic Voice Messages          │
│ ✓ Usage Tracking                │
│ ✓ Subscription Foundation       │
└──────────────────────────────────┘
```

---

# 17. POST-MVP ROADMAP

## Version 1.1

- Better memory
- More personalities
- More avatars
- Better image consistency
- Improved notifications

## Version 1.5

- Real-time voice conversation
- Audio call mode
- Emotional voices
- Voice interruption

## Version 2.0

- Animated avatar
- Lip sync
- Facial expressions
- Video calling

---

# 18. KEY DEVELOPMENT RULES

1. Never call AI providers directly from Web or Android clients.
2. All AI provider calls must go through the backend.
3. Keep AI providers abstracted behind interfaces.
4. Store only necessary user data.
5. Encrypt sensitive credentials and tokens.
6. Never expose API keys in clients.
7. Every paid AI operation must be tracked.
8. Apply rate limiting.
9. Add content safety/moderation checks where required.
10. Memory must be editable and deletable by the user.
11. Do not permanently store every conversation as a memory.
12. Use streaming for chat responses.
13. Design database tables for future multiple companions.
14. Keep Web and Android APIs identical.
15. Build audio/video systems as independent modules.
16. Every AI request should have logging and cost tracking.
17. Use feature flags for expensive features.
18. Add idempotency protection to billing and payment operations.

---

# 19. FINAL RECOMMENDED BUILD ORDER

```text
PHASE 1
Foundation
    ↓
Authentication
    ↓
User Profile
    ↓
Companion Creation
    ↓
Text Chat
    ↓
AI Personality Engine
    ↓
Long-Term Memory
    ↓
AI Image Generation
    ↓
Testing
    ↓
MVP Launch

PHASE 2
Voice Interaction
    ↓
Subscriptions
    ↓
Notifications
    ↓
Real-Time Audio Calls

PHASE 3
Animated Avatar
    ↓
Lip Sync
    ↓
AI Video Calls
```

---

# FINAL PRODUCT ARCHITECTURE

```text
                    ┌──────────────────┐
                    │    WEB APP       │
                    │    NEXT.JS       │
                    └────────┬─────────┘
                             │
                             │ HTTPS / WS
                             │
                    ┌────────▼─────────┐
                    │   API BACKEND    │
                    │     NESTJS       │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│ PostgreSQL   │    │ Redis        │    │ AI Gateway     │
│ + pgvector   │    │ Cache/Queue  │    └───────┬────────┘
└──────────────┘    └──────────────┘            │
                                                 │
                        ┌────────────────────────┼────────────────────┐
                        │                        │                    │
                        ▼                        ▼                    ▼
                   Chat AI                Image AI              Voice AI
                        │                        │                    │
                        └────────────────────────┼────────────────────┘
                                                 │
                                         Future Expansion
                                                 │
                                    ┌────────────▼────────────┐
                                    │ Real-Time Voice/Video   │
                                    │ WebRTC + Avatar Engine  │
                                    └─────────────────────────┘
```

The recommended strategy is to first become excellent at one thing: creating a companion that feels personal because she has a consistent personality and remembers the user. Text chat + memory + character consistency should be the foundation of the entire product. Voice and video should then enhance that foundation rather than compensate for a weak conversational experience.