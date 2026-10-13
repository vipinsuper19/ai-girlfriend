import { BadRequestException } from '@nestjs/common';

import { PERSONA_REJECTION_MESSAGE } from './safety-policy.js';

export class UnsafePersonaException extends BadRequestException {
    constructor() {
        super({
            code: 'UNSAFE_PERSONA',
            message: PERSONA_REJECTION_MESSAGE,
        });
    }
}
