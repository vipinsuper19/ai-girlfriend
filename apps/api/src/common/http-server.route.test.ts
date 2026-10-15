import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { API_BASE_PATH } from './constants/api.constants.js';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { installBodyParsers, installUnknownRoute } from './http-server.js';
import { ParseEntityIdPipe } from './pipes/parse-entity-id.pipe.js';

@Controller()
class ProbeController {
    @Get('items/:id')
    item(@Param('id', ParseEntityIdPipe) id: number) {
        return { id };
    }

    @Post('echo')
    echo(@Body() body: unknown) {
        return { received: true, size: JSON.stringify(body ?? null).length };
    }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

test('oversized bodies, unknown routes, and bad ids use the JSON error envelope', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [ProbeModule],
    }).compile();
    const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    installBodyParsers(app);
    app.setGlobalPrefix(API_BASE_PATH);
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    installUnknownRoute(app);
    await app.listen(0, '127.0.0.1');

    try {
        const base = await app.getUrl();
        const ok = await fetch(`${base}/${API_BASE_PATH}/items/12`);
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { id: 12 });

        for (const id of ['abc', '99999999999999999999', '0', '01']) {
            const response = await fetch(`${base}/${API_BASE_PATH}/items/${id}`);
            assert.equal(response.status, 400, id);
            const body = await response.json() as { success?: boolean; statusCode?: number; message?: string };
            assert.equal(body.success, false);
            assert.equal(body.statusCode, 400);
            assert.match(body.message ?? '', /numeric id is expected/);
            assert.equal(JSON.stringify(body).includes('<html'), false);
        }

        const missing = await fetch(`${base}/no-such-route`);
        assert.equal(missing.status, 404);
        assert.match(missing.headers.get('content-type') ?? '', /json/);
        const missingBody = await missing.json() as { success?: boolean; statusCode?: number; message?: string };
        assert.equal(missingBody.success, false);
        assert.equal(missingBody.statusCode, 404);
        assert.equal(missingBody.message, 'Cannot find this route');
        assert.equal(JSON.stringify(missingBody).includes('<html'), false);

        const prefixedMissing = await fetch(`${base}/${API_BASE_PATH}/no-such-route`);
        assert.equal(prefixedMissing.status, 404);
        assert.match(prefixedMissing.headers.get('content-type') ?? '', /json/);
        const prefixedBody = await prefixedMissing.json() as { success?: boolean; statusCode?: number };
        assert.equal(prefixedBody.success, false);
        assert.equal(prefixedBody.statusCode, 404);

        const oversized = await fetch(`${base}/${API_BASE_PATH}/echo`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ blob: 'x'.repeat(70_000) }),
        });
        assert.equal(oversized.status, 413);
        assert.match(oversized.headers.get('content-type') ?? '', /json/);
        const largeBody = await oversized.json() as { success?: boolean; statusCode?: number; message?: string };
        assert.equal(largeBody.success, false);
        assert.equal(largeBody.statusCode, 413);
        assert.equal(largeBody.message, 'Payload too large');
    } finally {
        await app.close();
    }
});
