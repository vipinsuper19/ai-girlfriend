#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract';
import endContract from '../../snapshots/75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9085182e7f306f15150da7c8e49789e2e9f0e696a3ca77538204a78e196e30d6/contract';
import startContract from '../../snapshots/9085182e7f306f15150da7c8e49789e2e9f0e696a3ca77538204a78e196e30d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('ageConfirmedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
