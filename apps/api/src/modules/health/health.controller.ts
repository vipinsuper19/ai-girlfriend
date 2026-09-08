import { Controller, Get } from '@nestjs/common';

@Controller({
    path: 'health',
    version: '1'
})
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