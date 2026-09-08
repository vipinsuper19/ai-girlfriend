#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3e9c36ef7c0ba2cecfbdcca81a569d7b8e743778dc08fe01128dbfd6c6a59f53/contract';
import endContract from '../../snapshots/3e9c36ef7c0ba2cecfbdcca81a569d7b8e743778dc08fe01128dbfd6c6a59f53/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'account',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerAccountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerData', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'account_provider_check_54adbe83',
            "\"provider\" IN ('EMAIL', 'GOOGLE', 'APPLE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'companion',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('gender', 'text', {
            notNull: true,
            default: lit('FEMALE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('greeting', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('systemPrompt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'companion_gender_check_5dd8b08f',
            "\"gender\" IN ('FEMALE', 'MALE', 'OTHER')",
          ),
          checkExpression(
            'companion_status_check_aef30f3b',
            "\"status\" IN ('ACTIVE', 'ARCHIVED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'companionAppearance',
        columns: [
          col('age', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bodyType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clothingStyle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ethnicity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('eyeColor', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hairColor', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hairStyle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('height', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imagePrompt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('skinTone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'companionPersonality',
        columns: [
          col('communicationStyle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dislikes', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('empathyLevel', 'int4', {
            notNull: true,
            default: lit(7),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('flirtLevel', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('humorLevel', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('interests', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('likes', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('romanceLevel', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('traits', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'companionVoice',
        columns: [
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('language', 'text', {
            notNull: true,
            default: lit('en'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('pitch', 'float8', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('settings', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('speed', 'float8', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('voiceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'conversation',
        columns: [
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastMessageAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'memory',
        columns: [
          col('accessCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('companionId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('confidence', 'float8', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('importance', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('lastAccessedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'memory_source_check_8ebab798',
            "\"source\" IN ('USER_MESSAGE', 'ASSISTANT_MESSAGE', 'AI_EXTRACTION', 'USER_INPUT')",
          ),
          checkExpression(
            'memory_status_check_b7c57345',
            "\"status\" IN ('ACTIVE', 'ARCHIVED', 'DELETED')",
          ),
          checkExpression(
            'memory_type_check_b6c8f863',
            "\"type\" IN ('PROFILE', 'PREFERENCE', 'RELATIONSHIP', 'CONVERSATION', 'FACT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'memoryEmbedding',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dimensions', 'int4', {
            notNull: true,
            default: lit(1536),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('embedding', 'vector(1536)', {
            codecRef: { codecId: 'pg/vector@1', typeParams: { length: 1536 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('memoryId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'memoryEmbedding_status_check_2b20bc37',
            "\"status\" IN ('PENDING', 'READY', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'message',
        columns: [
          col('audioUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', {
            notNull: true,
            default: lit('TEXT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'message_role_check_ca7958fc',
            "\"role\" IN ('USER', 'ASSISTANT', 'SYSTEM')",
          ),
          checkExpression(
            'message_type_check_38ffbfe0',
            "\"type\" IN ('TEXT', 'AUDIO', 'IMAGE', 'SYSTEM')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('refreshToken', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'user_status_check_3a7c0f48',
            "\"status\" IN ('ACTIVE', 'SUSPENDED', 'DELETED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'account',
        constraint: 'account_provider_providerAccountId_key',
        columns: ['provider', 'providerAccountId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'companionAppearance',
        constraint: 'companionAppearance_companionId_key',
        columns: ['companionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'companionPersonality',
        constraint: 'companionPersonality_companionId_key',
        columns: ['companionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'companionVoice',
        constraint: 'companionVoice_companionId_key',
        columns: ['companionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'memoryEmbedding',
        constraint: 'memoryEmbedding_memoryId_key',
        columns: ['memoryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'session',
        constraint: 'session_refreshToken_key',
        columns: ['refreshToken'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'account',
        index: 'account_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'companion',
        index: 'companion_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'companion',
        index: 'companion_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_companionId_idx_c35162c2',
        columns: ['companionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_userId_lastMessageAt_idx_678b62d4',
        columns: ['userId', 'lastMessageAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_companionId_idx_c35162c2',
        columns: ['companionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_companionId_status_idx_065ded14',
        columns: ['companionId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_importance_idx_d8c1c450',
        columns: ['importance'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memory',
        index: 'memory_userId_type_idx_59b0b5ce',
        columns: ['userId', 'type'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memoryEmbedding',
        index: 'memoryEmbedding_provider_model_idx_657c9a94',
        columns: ['provider', 'model'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memoryEmbedding',
        index: 'memoryEmbedding_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_createdAt_idx_44d4ac61',
        columns: ['conversationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'account',
        foreignKey: {
          name: 'account_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'companion',
        foreignKey: {
          name: 'companion_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'companionAppearance',
        foreignKey: {
          name: 'companionAppearance_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'companionPersonality',
        foreignKey: {
          name: 'companionPersonality_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'companionVoice',
        foreignKey: {
          name: 'companionVoice_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memory',
        foreignKey: {
          name: 'memory_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memory',
        foreignKey: {
          name: 'memory_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memory',
        foreignKey: {
          name: 'memory_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memoryEmbedding',
        foreignKey: {
          name: 'memoryEmbedding_memoryId_fkey',
          columns: ['memoryId'],
          references: { schema: 'public', table: 'memory', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'session',
        foreignKey: {
          name: 'session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
