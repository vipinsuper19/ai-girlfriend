import { BadRequestException } from '@nestjs/common';

import { PERSONA_REJECTION_MESSAGE } from './safety-policy.js';

export class UnsafePersonaException extends BadRequestException {
    constructor(message: string = PERSONA_REJECTION_MESSAGE) {
        super({
            code: 'UNSAFE_PERSONA',
            message,
        });
    }
}
