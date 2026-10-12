import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { NestFactory } from '@nestjs/core';

import { API_BASE_PATH } from '../../common/constants/api.constants.js';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor.js';
import { HealthModule } from './health.module.js';

test('GET /health stays outside the api/v1 prefix', async () => {
    const app = await NestFactory.create(HealthModule, { logger: false });
    // Same exclusion main.ts uses so the Render check is not under /api/v1.
    app.setGlobalPrefix(API_BASE_PATH, { exclude: ['health'] });
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0, '127.0.0.1');

    try {
        const base = await app.getUrl();
        const health = await fetch(`${base}/health`);
        assert.equal(health.status, 200);
        const body = await health.json() as {
            success: boolean;
            data: { status: string; service: string };
        };
        assert.equal(body.success, true);
        assert.equal(body.data.status, 'ok');
        assert.equal(body.data.service, 'ai-girlfriend-api');

        const prefixed = await fetch(`${base}/${API_BASE_PATH}/health`);
        assert.equal(prefixed.status, 404);
    } finally {
        await app.close();
    }
});
