#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0153d0c2549ccfb7f0e418fada57c1c21b71575dc1b3d27de04c82ce5765fd5a/contract';
import endContract from '../../snapshots/0153d0c2549ccfb7f0e418fada57c1c21b71575dc1b3d27de04c82ce5765fd5a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract';
import startContract from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract.json' with { type: 'json' };
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
        table: 'messageReport',
        columns: [
          col('content', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('conversationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('messageId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
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
            'messageReport_reason_check_03d00617',
            "\"reason\" IN ('HARMFUL', 'SEXUAL', 'HATE', 'INACCURATE', 'OTHER')",
          ),
          checkExpression(
            'messageReport_status_check_70734042',
            "\"status\" IN ('PENDING', 'REVIEWED', 'DISMISSED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'messageReport',
        constraint: 'messageReport_userId_messageId_key',
        columns: ['userId', 'messageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messageReport',
        index: 'messageReport_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messageReport',
        index: 'messageReport_messageId_idx_3cdded8d',
        columns: ['messageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messageReport',
        index: 'messageReport_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messageReport',
        index: 'messageReport_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'messageReport',
        foreignKey: {
          name: 'messageReport_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
