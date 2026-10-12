#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/35dded391026aaab7feff2d1a78eab124cde1e1979229f05536fb52c1b6a1617/contract';
import endContract from '../../snapshots/35dded391026aaab7feff2d1a78eab124cde1e1979229f05536fb52c1b6a1617/contract.json' with { type: 'json' };
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
