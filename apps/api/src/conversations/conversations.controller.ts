import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
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
        @Param('id') id: string,
    ) {
        return this.conversationsService.findOne(
            String(user.sub),
            id,
        );
    }

    @Delete(':id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.conversationsService.remove(
            String(user.sub),
            id,
        );
    }
}
