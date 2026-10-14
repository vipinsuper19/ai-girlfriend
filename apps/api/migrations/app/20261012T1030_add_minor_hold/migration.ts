#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/630c27ec57f75f16797bd5aa17654561a9e1e6bf23a00f7d3926d4cfe5f1ea1d/contract';
import endContract from '../../snapshots/630c27ec57f75f16797bd5aa17654561a9e1e6bf23a00f7d3926d4cfe5f1ea1d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract';
import startContract from '../../snapshots/6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'conversation',
        column: col('minorHeldAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('minorHeldAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
