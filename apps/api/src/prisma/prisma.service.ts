import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from './prisma.constants.js';

@Injectable()
export class PrismaService {
    constructor(
        @Inject(DATABASE)
        private readonly db: unknown,
    ) { }

    get client(): unknown {
        return this.db;
    }
}
