import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';

import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();

        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_SERVER_ERROR';
        let details: unknown = null;

        if (exception instanceof HttpException) {
            status = exception.getStatus();

            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else {
                const responseBody = exceptionResponse as {
                    message?: string | string[];
                    error?: string;
                };

                if (Array.isArray(responseBody.message)) {
                    message = 'Validation failed';
                    details = responseBody.message;
                    code = 'VALIDATION_ERROR';
                } else if (responseBody.message) {
                    message = responseBody.message;
                }

                if (responseBody.error) {
                    code = responseBody.error.toUpperCase().replace(/\s+/g, '_');
                }
            }
        }

        this.logger.error(
            `${request.method} ${request.url} - ${status} - ${message}`
        );

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                details
            },
            path: request.url,
            timestamp: new Date().toISOString()
        });
    }
}