import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import { sendException } from '../common/filters/http-exception.filter.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { isAbortError } from '../ai/abort-error.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

import { ClientDisconnectedError } from './client-disconnect.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { MessagesService } from './messages.service.js';
import { formatSseEvent, SSE_KEEPALIVE_MS, streamErrorPayload, writeServerSentEvents } from './sse-stream.js';

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
    @RateLimit('messages')
    @UseGuards(RateLimitGuard)
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

    @Post('messages/:id/regenerate')
    @RateLimit('messages')
    @UseGuards(RateLimitGuard)
    async regenerate(
        @CurrentUser() user: JwtPayload,
        @Param('id') messageId: string,
    ) {
        return this.messagesService.regenerate(
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
    @Header(
        'X-Accel-Buffering',
        'no',
    )
    @RateLimit('messages')
    @UseGuards(RateLimitGuard)
    async createAndStream(
        @CurrentUser() user: JwtPayload,
        @Param('id') conversationId: string,
        @Body() dto: CreateMessageDto,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        const abort = new AbortController();
        // `request` closes as soon as the POST body is read, which is before
        // the SSE response finishes. The response closes when the client
        // disconnects or when we end it. Abort only in the first case.
        const onClose = () => {
            if (!response.writableFinished) abort.abort();
        };
        response.on('close', onClose);

        try {
            await this.messagesService.assertCanReply(
                String(user.sub),
                conversationId,
            );
        } catch (error) {
            response.off('close', onClose);
            sendException(response, request, error);
            return;
        }

        response.flushHeaders();

        try {
            await writeServerSentEvents(
                this.messagesService.createAndStream(
                    user.sub,
                    conversationId,
                    dto,
                    abort.signal,
                ),
                (chunk) => {
                    if (abort.signal.aborted || response.destroyed || !response.writable) {
                        abort.abort();
                        throw new ClientDisconnectedError();
                    }
                    response.write(chunk);
                },
                SSE_KEEPALIVE_MS,
                abort.signal,
                () => abort.abort(),
            );
        } catch (error) {
            if (
                !response.destroyed
                && response.writable
                && !abort.signal.aborted
                && !isAbortError(error)
            ) {
                response.write(
                    formatSseEvent('error', streamErrorPayload(error)),
                );
            }
        } finally {
            response.off('close', onClose);
            if (!response.writableEnded) response.end();
        }
    }
}