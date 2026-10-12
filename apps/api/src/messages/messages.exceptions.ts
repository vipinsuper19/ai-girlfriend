import { ConflictException } from '@nestjs/common';

export class NotLatestUserMessageException extends ConflictException {
    constructor() {
        super({
            statusCode: 409,
            message: 'Only the latest user message can be retried',
            error: 'Conflict',
            code: 'NOT_LATEST_USER_MESSAGE',
        });
    }
}

export class IdempotencyKeyReusedException extends ConflictException {
    constructor() {
        super({
            statusCode: 409,
            message: 'Idempotency-Key was already used for a different conversation',
            error: 'Conflict',
            code: 'IDEMPOTENCY_KEY_REUSED',
        });
    }
}
