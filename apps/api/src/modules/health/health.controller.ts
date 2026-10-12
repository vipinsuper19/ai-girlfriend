import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
    @Get()
    check() {
        return {
            status: 'ok',
            service: 'ai-girlfriend-api',
            timestamp: new Date().toISOString()
        };
    }
}