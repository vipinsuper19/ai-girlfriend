import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { publicErrorFields } from '../http-error-fields.js';

interface ErrorResponse {
    success: false;
    statusCode: number;
    message: string | string[];
    error?: string;
    code?: string;
    feature?: string;
    limit?: number;
    used?: number;
    requested?: number;
    remaining?: number;
    period?: string;
    resetsAt?: string;
    retryAfterSeconds?: number;
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

        const errorResponse = buildErrorResponse(exception, request);
        if (errorResponse.statusCode >= 500 && !(exception instanceof HttpException)) {
            if (exception instanceof Error) {
                this.logger.error(
                    `${request.method} ${request.originalUrl ?? request.url}`,
                    exception.stack,
                );
            } else {
                this.logger.error(
                    `Unknown exception on ${request.method} ${request.originalUrl ?? request.url}`,
                );
            }
        }

        sendErrorResponse(response, errorResponse);
    }
}

export function sendException(
    response: Response,
    request: Pick<Request, 'originalUrl' | 'url'>,
    exception: unknown,
): void {
    sendErrorResponse(response, buildErrorResponse(exception, request));
}

function sendErrorResponse(
    response: Response,
    errorResponse: ErrorResponse,
): void {
    if (typeof errorResponse.retryAfterSeconds === 'number') {
        response.setHeader('Retry-After', String(errorResponse.retryAfterSeconds));
    }
    response.status(errorResponse.statusCode).json(errorResponse);
}

function buildErrorResponse(
    exception: unknown,
    request: Pick<Request, 'originalUrl' | 'url'>,
): ErrorResponse {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;
    let extra: Record<string, string | number> = {};

    if (exception instanceof HttpException) {
        statusCode = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
        } else {
            const responseBody = exceptionResponse as {
                message?: string | string[];
                error?: string;
            };
            message = responseBody.message ?? message;
            error = responseBody.error;
            extra = publicErrorFields(responseBody);
        }
    }

    return {
        success: false,
        statusCode,
        message,
        ...(error ? { error } : {}),
        ...extra,
        timestamp: new Date().toISOString(),
        path: request.originalUrl ?? request.url,
    };
}