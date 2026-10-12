#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/65958b636c4f90726f49d32505413c89ea01bc31fe5d364156bf4279b797896b/contract';
import endContract from '../../snapshots/65958b636c4f90726f49d32505413c89ea01bc31fe5d364156bf4279b797896b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract';
import startContract from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract.json' with { type: 'json' };
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
