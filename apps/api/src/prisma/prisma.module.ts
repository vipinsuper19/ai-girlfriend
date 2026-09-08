import { Global, Module } from '@nestjs/common';

import { db } from './db.js';
import { DATABASE } from './prisma.constants.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
    providers: [
        {
            provide: DATABASE,
            useValue: db,
        },
        PrismaService,
    ],
    exports: [DATABASE, PrismaService],
})
export class PrismaModule { }
