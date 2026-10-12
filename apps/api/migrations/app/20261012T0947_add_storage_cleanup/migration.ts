#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/692032fff3c96ddc5bcd119880c310d7b1956d055eab5e278d340a30b7d78879/contract';
import endContract from '../../snapshots/692032fff3c96ddc5bcd119880c310d7b1956d055eab5e278d340a30b7d78879/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract';
import startContract from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'storageCleanup',
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
          col('objectKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['objectKey'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
