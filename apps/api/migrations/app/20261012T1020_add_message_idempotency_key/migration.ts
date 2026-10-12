#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract';
import endContract from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1/contract';
import startContract from '../../snapshots/87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1/contract.json' with { type: 'json' };
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
