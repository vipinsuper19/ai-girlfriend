#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract';
import startContract from '../../snapshots/48e16405130b1c3e792d7ac95b9017b46609b3ed29ab580557c4466b62a4b9eb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b2d466fd498bf23df8c6a5775acb1efa702097f27cbf08af501b715921a2d25c/contract';
import endContract from '../../snapshots/b2d466fd498bf23df8c6a5775acb1efa702097f27cbf08af501b715921a2d25c/contract.json' with { type: 'json' };
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
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('dateOfBirth', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
