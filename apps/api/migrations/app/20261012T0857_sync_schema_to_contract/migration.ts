#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3e9c36ef7c0ba2cecfbdcca81a569d7b8e743778dc08fe01128dbfd6c6a59f53/contract';
import startContract from '../../snapshots/3e9c36ef7c0ba2cecfbdcca81a569d7b8e743778dc08fe01128dbfd6c6a59f53/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract';
import endContract from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'call',
        columns: [
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('conversationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('errorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('errorMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerCallId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('roomId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
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
            'call_status_check_f377cdca',
            "\"status\" IN ('PENDING', 'CONNECTING', 'ACTIVE', 'ENDED', 'FAILED', 'CANCELLED')",
          ),
          checkExpression('call_type_check_bb1ca145', "\"type\" IN ('AUDIO', 'VIDEO')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'deviceToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'imageGeneration',
        columns: [
          col('companionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('conversationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('enhancedPrompt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('errorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('errorMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('messageId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('model', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('prompt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerImageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
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
            'imageGeneration_status_check_48358bb5',
            "\"status\" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')",
          ),
          checkExpression(
            'imageGeneration_type_check_ba834aee',
            "\"type\" IN ('COMPANION_AVATAR', 'COMPANION_IMAGE', 'USER_REQUEST')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'subscription',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('plan', 'text', {
            notNull: true,
            default: lit('FREE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('provider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('providerSubscriptionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'subscription_plan_check_0f874b4b',
            "\"plan\" IN ('FREE', 'PREMIUM', 'PREMIUM_PLUS')",
          ),
          checkExpression(
            'subscription_status_check_21af5e2c',
            "\"status\" IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'usageRecord',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('feature', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'usageRecord_feature_check_94e56e34',
            "\"feature\" IN ('TEXT_TOKENS', 'MESSAGES', 'IMAGE_GENERATIONS', 'VOICE_MINUTES', 'AUDIO_CALL_MINUTES', 'VIDEO_CALL_MINUTES')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('memoryPausedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('notificationsEnabledAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'deviceToken',
        constraint: 'deviceToken_token_key',
        columns: ['token'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'imageGeneration',
        constraint: 'imageGeneration_messageId_key',
        columns: ['messageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_companionId_idx_c35162c2',
        columns: ['companionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_companionId_status_idx_065ded14',
        columns: ['companionId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_startedAt_idx_cac56236',
        columns: ['startedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'call',
        index: 'call_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deviceToken',
        index: 'deviceToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_companionId_idx_c35162c2',
        columns: ['companionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_companionId_status_idx_065ded14',
        columns: ['companionId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'imageGeneration',
        index: 'imageGeneration_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscription',
        index: 'subscription_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscription',
        index: 'subscription_providerSubscriptionId_idx_3f5a8174',
        columns: ['providerSubscriptionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscription',
        index: 'subscription_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subscription',
        index: 'subscription_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usageRecord',
        index: 'usageRecord_feature_createdAt_idx_9805c3ce',
        columns: ['feature', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usageRecord',
        index: 'usageRecord_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usageRecord',
        index: 'usageRecord_userId_feature_idx_2615db75',
        columns: ['userId', 'feature'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usageRecord',
        index: 'usageRecord_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'call',
        foreignKey: {
          name: 'call_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'call',
        foreignKey: {
          name: 'call_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'call',
        foreignKey: {
          name: 'call_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deviceToken',
        foreignKey: {
          name: 'deviceToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'imageGeneration',
        foreignKey: {
          name: 'imageGeneration_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'imageGeneration',
        foreignKey: {
          name: 'imageGeneration_companionId_fkey',
          columns: ['companionId'],
          references: { schema: 'public', table: 'companion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'imageGeneration',
        foreignKey: {
          name: 'imageGeneration_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'imageGeneration',
        foreignKey: {
          name: 'imageGeneration_messageId_fkey',
          columns: ['messageId'],
          references: { schema: 'public', table: 'message', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subscription',
        foreignKey: {
          name: 'subscription_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'usageRecord',
        foreignKey: {
          name: 'usageRecord_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
