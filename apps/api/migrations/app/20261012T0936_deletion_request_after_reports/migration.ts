#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3be5e56b6c2f0c213600f79ff21c070dde7aab88682d334e633205f01f529fbf/contract';
import endContract from '../../snapshots/3be5e56b6c2f0c213600f79ff21c070dde7aab88682d334e633205f01f529fbf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9085182e7f306f15150da7c8e49789e2e9f0e696a3ca77538204a78e196e30d6/contract';
import startContract from '../../snapshots/9085182e7f306f15150da7c8e49789e2e9f0e696a3ca77538204a78e196e30d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'deletionRequest',
        columns: [
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'deletionRequest',
        constraint: 'deletionRequest_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deletionRequest',
        index: 'deletionRequest_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deletionRequest',
        index: 'deletionRequest_email_idx_46df9cad',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
