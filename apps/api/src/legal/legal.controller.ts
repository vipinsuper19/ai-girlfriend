import { Body, Controller, Get, Header, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { RawHtml } from '../common/decorators/raw-html.decorator.js';
import { DeletionRequestsService } from './deletion-requests.service.js';
import { requestOrigin } from './deletion-link.js';
import { accountDeletionHtml, privacyHtml } from './pages.js';

@Controller()
export class LegalController {
    constructor(
        @Inject(DeletionRequestsService)
        private readonly deletions: DeletionRequestsService,
    ) {}

    @Get('privacy')
    @RawHtml()
    @Header('Content-Type', 'text/html; charset=utf-8')
    @Header('Cache-Control', 'no-cache')
    privacy(): string {
        return privacyHtml(this.deletions.identity());
    }

    @Get('account-deletion')
    @RawHtml()
    @Header('Content-Type', 'text/html; charset=utf-8')
    @Header('Cache-Control', 'no-cache')
    accountDeletion(): string {
        return accountDeletionHtml(this.deletions.identity());
    }

    @Post('account-deletion')
    @RawHtml()
    @Header('Cache-Control', 'no-cache')
    async requestDeletion(
        @Body() body: Record<string, unknown>,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const result = await this.deletions.submit(
            { email: body['email'], note: body['note'] },
            request.ip || request.socket?.remoteAddress || 'unknown',
            requestOrigin(request),
        );
        response
            .status(result.status)
            .type('html')
            .send(result.html);
    }

    @Get('account-deletion/confirm')
    @RawHtml()
    @Header('Cache-Control', 'no-cache')
    async confirmDeletion(
        @Query('token') token: string | undefined,
        @Res() response: Response,
    ): Promise<void> {
        const result = await this.deletions.confirm(token);
        response
            .status(result.status)
            .type('html')
            .send(result.html);
    }
}
