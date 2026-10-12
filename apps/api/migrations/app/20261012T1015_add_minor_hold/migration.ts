#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1/contract';
import startContract from '../../snapshots/87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bb4838916e62956fee3aab5dc34ea13c30808d8dc9788d0ff5fe51fe57aad907/contract';
import endContract from '../../snapshots/bb4838916e62956fee3aab5dc34ea13c30808d8dc9788d0ff5fe51fe57aad907/contract.json' with { type: 'json' };
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
