import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) { }

    async findMe(userId: string) {

        const db = this.prisma.client as any;

        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    async updateMe(
        userId: string,
        dto: UpdateUserDto,
    ) {

        const db = this.prisma.client as any;
        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updateData: {
            displayName?: string;
        } = {};

        if (dto.displayName !== undefined) {
            updateData.displayName = dto.displayName.trim();
        }

        const updatedUser =
            await db.orm.public.User.where({
                id: userId,
            }).update(updateData);

        return {
            id: updatedUser.id,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };
    }

    async deleteMe(userId: string) {
        const db = this.prisma.client as any;
        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        /*
         * Delete all active sessions first.
         * This prevents orphan sessions if your database
         * schema does not use ON DELETE CASCADE.
         */
        const sessions =
            await db.orm.public.Session.where({
                userId,
            }).all();

        for (const session of sessions) {
            await db.orm.public.Session.where({
                id: session.id,
            }).delete();
        }

        const companions =
            await db.orm.public.Companion.where({
                userId: Number(userId),
            }).all();

        await db.orm.public.User.where({
            id: userId,
        }).delete();

        await this.storage.removeUserFiles(
            Number(userId),
            companions.map((companion: { id: number }) => Number(companion.id)),
        );

        return {
            message: 'Account deleted successfully',
        };
    }
}