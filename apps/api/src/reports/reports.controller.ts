import {
    Body,
    Controller,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    /**
     * 201 `{ id }` when the report is new.
     * 200 `{ id }` when this person already reported the same message.
     * 404 when the message is missing or is not in a conversation they own.
     *
     * The body is the same envelope as the global interceptor. Nest would
     * otherwise force every POST on this route to 201, so the response is
     * written here.
     */
    @Post()
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateReportDto,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        const report = await this.reportsService.create(Number(user.sub), dto);
        const statusCode = report.created ? HttpStatus.CREATED : HttpStatus.OK;

        response.status(statusCode).json({
            success: true,
            statusCode,
            message: 'Request successful',
            data: { id: report.id },
            timestamp: new Date().toISOString(),
            path: request.originalUrl ?? request.url,
        });
    }
}
