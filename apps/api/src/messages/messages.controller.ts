import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { MessagesService } from './messages.service.js';
import { formatSseEvent, streamErrorPayload, writeServerSentEvents } from './sse-stream.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
    constructor(
        private readonly messagesService: MessagesService,
    ) { }

    @Get('conversations/:id/messages')
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Param('id') conversationId: string,
        @Query() query: ListMessagesDto,
    ) {
        return this.messagesService.findAll(
            String(user.sub),
            conversationId,
            query,
        );
    }

    @Post('conversations/:id/messages')
    async create(
        @CurrentUser() user: JwtPayload,
        @Param('id') conversationId: string,
        @Body() dto: CreateMessageDto,
    ) {
        return this.messagesService.create(
            String(user.sub),
            conversationId,
            dto,
        );
    }

    @Delete('messages/:id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id') messageId: string,
    ) {
        return this.messagesService.remove(
            String(user.sub),
            messageId,
        );
    }

    @Post('conversations/:id/messages/stream')
    @Header(
        'Content-Type',
        'text/event-stream',
    )
    @Header(
        'Cache-Control',
        'no-cache, no-transform',
    )
    @Header(
        'Connection',
        'keep-alive',
    )
    async createAndStream(
        @CurrentUser() user: JwtPayload,
        @Param('id') conversationId: string,
        @Body() dto: CreateMessageDto,
        @Res() response: Response,
    ) {
        response.flushHeaders();

        try {
            await writeServerSentEvents(
                this.messagesService.createAndStream(
                    user.sub,
                    conversationId,
                    dto,
                ),
                (chunk) => {
                    response.write(chunk);
                },
            );
        } catch (error) {
            response.write(
                formatSseEvent('error', streamErrorPayload(error)),
            );
        } finally {
            response.end();
        }
    }
}