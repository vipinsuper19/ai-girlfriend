import {
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Body,
    UseGuards
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CreateMemoryDto } from './dto/create-memory.dto.js';
import { ListMemoriesDto } from './dto/list-memories.dto.js';
import { UpdateMemoryDto } from './dto/update-memory.dto.js';
import { MemoriesService } from './memories.service.js';

@Controller('memories')
@UseGuards(JwtAuthGuard)
export class MemoriesController {
    constructor(
        private readonly memoriesService: MemoriesService,
    ) { }

    @Post()
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateMemoryDto,
    ) {
        return this.memoriesService.create(
            String(user.sub),
            dto,
        );
    }

    @Get()
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Query() query: ListMemoriesDto,
    ) {
        return this.memoriesService.findAll(
            String(user.sub),
            query,
        );
    }

    @Get(':id')
    async findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id') memoryId: string,
    ) {
        return this.memoriesService.findOne(
            String(user.sub),
            memoryId,
        );
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: JwtPayload,
        @Param('id') memoryId: string,
        @Body() dto: UpdateMemoryDto,
    ) {
        return this.memoriesService.update(
            String(user.sub),
            memoryId,
            dto,
        );
    }

    @Delete()
    async removeAll(
        @CurrentUser() user: JwtPayload,
        @Query() query: ListMemoriesDto,
    ) {
        return this.memoriesService.removeAll(
            String(user.sub),
            query.companionId,
        );
    }

    @Delete(':id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id') memoryId: string,
    ) {
        return this.memoriesService.remove(
            String(user.sub),
            memoryId,
        );
    }
}
