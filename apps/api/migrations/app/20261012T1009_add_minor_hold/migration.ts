#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract';
import startContract from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d175738423ecf5923b58c2bf75cbcedee001afede5618a48b724f5881fa7fc28/contract';
import endContract from '../../snapshots/d175738423ecf5923b58c2bf75cbcedee001afede5618a48b724f5881fa7fc28/contract.json' with { type: 'json' };
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
