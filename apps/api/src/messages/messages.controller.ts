import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Headers,
    Inject,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import { AgeConfirmedGuard } from '../auth/age-confirmed.guard.js';
import { sendException } from '../common/filters/http-exception.filter.js';
import { ParseEntityIdPipe } from '../common/pipes/parse-entity-id.pipe.js';
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
        @Inject(MessagesService)
        private readonly messagesService: MessagesService,
    ) { }

    @Get('conversations/:id/messages')
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) conversationId: number,
        @Query() query: ListMessagesDto,
    ) {
        return this.messagesService.findAll(
            String(user.sub),
            String(conversationId),
            query,
        );
    }

    @Post('conversations/:id/messages')
    @RateLimit('messages')
    @UseGuards(AgeConfirmedGuard, RateLimitGuard)
    async create(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) conversationId: number,
        @Body() dto: CreateMessageDto,
        @Headers('idempotency-key') idempotencyKey?: string | string[],
    ) {
        return this.messagesService.create(
            String(user.sub),
            String(conversationId),
            dto,
            idempotencyKey,
        );
    }

    @Delete('messages/:id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) messageId: number,
    ) {
        return this.messagesService.remove(
            String(user.sub),
            String(messageId),
        );
    }

    @Post('messages/:id/regenerate')
    @RateLimit('messages')
    @UseGuards(AgeConfirmedGuard, RateLimitGuard)
    async regenerate(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) messageId: number,
    ) {
        return this.messagesService.regenerate(
            String(user.sub),
            String(messageId),
        );
    }

    @Post('conversations/:id/messages/stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('Connection', 'keep-alive')
    @Header('X-Accel-Buffering', 'no')
    @RateLimit('messages')
    @UseGuards(AgeConfirmedGuard, RateLimitGuard)
    async createAndStream(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) conversationId: number,
        @Body() dto: CreateMessageDto,
        @Req() request: Request,
        @Res() response: Response,
        @Headers('idempotency-key') idempotencyKey?: string | string[],
    ) {
        const key = headerValue(idempotencyKey);
        await this.pipeStream(
            request,
            response,
            () => key
                ? this.messagesService.prepareSend(
                    String(user.sub),
                    String(conversationId),
                    key,
                )
                : this.messagesService.assertCanReply(
                    String(user.sub),
                    String(conversationId),
                ),
            (signal) => this.messagesService.createAndStream(
                user.sub,
                String(conversationId),
                dto,
                signal,
                key,
            ),
        );
    }

    /**
     * Assistant reply for a user line that was already saved. Empty body.
     * If a reply already follows that line, the stream is a single `done`
     * event and nothing is charged.
     */
    @Post('conversations/:conversationId/messages/:userMessageId/reply/stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('Connection', 'keep-alive')
    @Header('X-Accel-Buffering', 'no')
    @RateLimit('messages')
    @UseGuards(AgeConfirmedGuard, RateLimitGuard)
    async replyStream(
        @CurrentUser() user: JwtPayload,
        @Param('conversationId', ParseEntityIdPipe) conversationId: number,
        @Param('userMessageId', ParseEntityIdPipe) userMessageId: number,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        await this.pipeStream(
            request,
            response,
            () => this.messagesService.prepareReplyStream(
                String(user.sub),
                String(conversationId),
                String(userMessageId),
            ),
            (signal) => this.messagesService.streamReply(
                String(user.sub),
                String(conversationId),
                String(userMessageId),
                signal,
            ),
        );
    }

    private async pipeStream(
        request: Request,
        response: Response,
        prepare: () => Promise<unknown>,
        events: (signal: AbortSignal) => AsyncIterable<{ type: string }>,
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
            await prepare();
        } catch (error) {
            response.off('close', onClose);
            sendException(response, request, error);
            return;
        }

        response.flushHeaders();

        try {
            await writeServerSentEvents(
                events(abort.signal),
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

function headerValue(raw: string | string[] | undefined): string | undefined {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}