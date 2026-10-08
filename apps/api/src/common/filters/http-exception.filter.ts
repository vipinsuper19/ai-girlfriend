import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponse {
    success: false;
    statusCode: number;
    message: string | string[];
    error?: string;
    code?: string;
    timestamp: string;
    path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();

        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error: string | undefined;
        let code: string | undefined;

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();

            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else {
                const responseBody = exceptionResponse as {
                    message?: string | string[];
                    error?: string;
                    code?: string;
                };

                message = responseBody.message ?? message;
                error = responseBody.error;
                if (typeof responseBody.code === 'string') {
                    code = responseBody.code;
                }
            }
        } else if (exception instanceof Error) {
            this.logger.error(
                `${request.method} ${request.originalUrl ?? request.url}`,
                exception.stack,
            );
        } else {
            this.logger.error(
                `Unknown exception on ${request.method} ${request.originalUrl ?? request.url}`,
            );
        }

        const errorResponse: ErrorResponse = {
            success: false,
            statusCode,
            message,
            ...(error ? { error } : {}),
            ...(code ? { code } : {}),
            timestamp: new Date().toISOString(),
            path: request.originalUrl ?? request.url,
        };

        response.status(statusCode).json(errorResponse);

    }
}