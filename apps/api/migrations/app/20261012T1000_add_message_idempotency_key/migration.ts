#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract';
import startContract from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8e09535928eee00952eaa1d2f76eaaa4d6f289989f3ac90efff76110efd58964/contract';
import endContract from '../../snapshots/8e09535928eee00952eaa1d2f76eaaa4d6f289989f3ac90efff76110efd58964/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'message',
        column: col('idempotencyKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'message',
        column: col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'message',
        constraint: 'message_userId_idempotencyKey_key',
        columns: ['userId', 'idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
