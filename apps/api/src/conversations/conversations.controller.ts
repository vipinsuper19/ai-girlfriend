import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';

import { AgeConfirmedGuard } from '../auth/age-confirmed.guard.js';
import { ParseEntityIdPipe } from '../common/pipes/parse-entity-id.pipe.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard, AgeConfirmedGuard)
export class ConversationsController {
    constructor(
        private readonly conversationsService:
            ConversationsService,
    ) { }

    @Get()
    async findAll(
        @CurrentUser() user: JwtPayload,
    ) {
        return this.conversationsService.findAll(
            String(user.sub),
        );
    }

    @Post()
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateConversationDto,
    ) {
        return this.conversationsService.create(
            String(user.sub),
            dto,
        );
    }

    @Get(':id')
    async findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) id: number,
    ) {
        return this.conversationsService.findOne(
            String(user.sub),
            String(id),
        );
    }

    @Delete(':id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) id: number,
    ) {
        return this.conversationsService.remove(
            String(user.sub),
            String(id),
        );
    }
}
