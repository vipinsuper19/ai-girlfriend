import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    Post,
    Res,
    UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { CreateMessageDto } from './dto/create-message.dto.js';
import { MessagesService } from './messages.service.js';

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
    ) {
        return this.messagesService.findAll(
            String(user.sub),
            conversationId,
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
            for await (
                const event of this.messagesService.createAndStream(
                    user.sub,
                    conversationId,
                    dto,
                )
            ) {
                response.write(
                    `event: ${event.type}\n`,
                );

                response.write(
                    `data: ${JSON.stringify(event)}\n\n`,
                );
            }
        } catch (error) {
            response.write(
                'event: error\n',
            );

            response.write(
                `data: ${JSON.stringify({
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Streaming failed',
                })}\n\n`,
            );
        } finally {
            response.end();
        }
    }
}