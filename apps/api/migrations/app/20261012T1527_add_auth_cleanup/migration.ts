#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/630c27ec57f75f16797bd5aa17654561a9e1e6bf23a00f7d3926d4cfe5f1ea1d/contract';
import startContract from '../../snapshots/630c27ec57f75f16797bd5aa17654561a9e1e6bf23a00f7d3926d4cfe5f1ea1d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8a7a2505b47933fe6ff38bd2d571619147481e7a3e7a708e956f9e5684ee61d6/contract';
import endContract from '../../snapshots/8a7a2505b47933fe6ff38bd2d571619147481e7a3e7a708e956f9e5684ee61d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'authCleanup',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('lastError', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['subject'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
