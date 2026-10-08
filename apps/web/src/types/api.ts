export type User = {
  id: number | string;
  email: string;
  displayName: string | null;
  memoryPaused?: boolean;
  notificationsEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanionGender = "FEMALE" | "MALE" | "OTHER";
export type CompanionStatus = "ACTIVE" | "ARCHIVED";

export type CompanionAppearance = {
  id?: number;
  companionId?: number;
  age?: number | null;
  ethnicity?: string | null;
  skinTone?: string | null;
  hairColor?: string | null;
  hairStyle?: string | null;
  eyeColor?: string | null;
  bodyType?: string | null;
  height?: string | null;
  clothingStyle?: string | null;
  avatarUrl?: string | null;
  imagePrompt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CompanionPersonality = {
  id?: number;
  companionId?: number;
  traits?: unknown[];
  interests?: unknown[];
  likes?: unknown;
  dislikes?: unknown;
  humorLevel?: number;
  flirtLevel?: number;
  empathyLevel?: number;
  romanceLevel?: number;
  communicationStyle?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CompanionVoice = {
  id?: number;
  companionId?: number;
  provider: string;
  voiceId: string;
  language?: string;
  speed?: number;
  pitch?: number;
  settings?: Record<string, unknown> | null;
};

export type Companion = {
  id: number;
  userId: number;
  name: string;
  gender: CompanionGender;
  status: CompanionStatus;
  systemPrompt?: string | null;
  greeting?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  appearance?: CompanionAppearance | null;
  personality?: CompanionPersonality | null;
  voice?: CompanionVoice | null;
};

export type Conversation = {
  id: number;
  userId: number;
  companionId: number;
  title?: string | null;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";
export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "SYSTEM";

export type Message = {
  id: number | string;
  conversationId: number;
  role: MessageRole;
  type: MessageType;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  status?: "sending" | "sent" | "failed" | "streaming";
  optimistic?: boolean;
};

export type MemoryType =
  | "PROFILE"
  | "PREFERENCE"
  | "RELATIONSHIP"
  | "CONVERSATION"
  | "FACT";

export type Memory = {
  id: number;
  userId: number;
  companionId?: number | null;
  conversationId?: number | null;
  type: MemoryType;
  status?: string;
  source?: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  importance: number;
  confidence: number;
  accessCount?: number;
  lastAccessedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AuthTokens = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  message: string | string[];
  data: T;
  timestamp?: string;
  path?: string;
  error?: string;
};

export type ApiErrorBody = {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
};
