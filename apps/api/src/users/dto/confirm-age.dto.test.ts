import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { GoogleLoginDto } from '../../dto/google-login.dto.js';
import { RegisterDto } from '../../dto/register.dto.js';
import { ConfirmAgeDto } from './confirm-age.dto.js';

const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
});

function accept<T>(metatype: new () => T, value: unknown): Promise<T> {
    return pipe.transform(value, { type: 'body', metatype }) as Promise<T>;
}

async function reject(metatype: new () => unknown, value: unknown): Promise<string> {
    try {
        await accept(metatype, value);
    } catch (error) {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        return JSON.stringify(error.getResponse());
    }
    assert.fail('expected a 400');
}

const register = {
    email: 'ana@example.com',
    password: 'password1',
    displayName: 'Ana',
};

test('PATCH /users/me/age accepts only ageConfirmed true', async () => {
    const body = await accept(ConfirmAgeDto, { ageConfirmed: true });
    assert.equal(body.ageConfirmed, true);

    const missing = await reject(ConfirmAgeDto, {});
    assert.match(missing, /ageConfirmed/);

    const declined = await reject(ConfirmAgeDto, { ageConfirmed: false });
    assert.match(declined, /ageConfirmed/);
    assert.equal(declined.includes('1991-03-17'), false);
});

test('a date of birth is rejected and its value is not returned', async () => {
    const age = await reject(ConfirmAgeDto, {
        ageConfirmed: true,
        dateOfBirth: '1991-03-17',
    });
    assert.match(age, /dateOfBirth/);
    assert.equal(age.includes('1991-03-17'), false);

    const registered = await reject(RegisterDto, {
        ...register,
        dateOfBirth: '1991-03-17',
        ageConfirmedAt: '2026-10-12T15:04:05.000Z',
    });
    assert.match(registered, /dateOfBirth/);
    assert.match(registered, /ageConfirmedAt/);
    assert.equal(registered.includes('1991-03-17'), false);

    const google = await reject(GoogleLoginDto, {
        idToken: 'token',
        dateOfBirth: '1991-03-17',
    });
    assert.match(google, /dateOfBirth/);
    assert.equal(google.includes('1991-03-17'), false);
});

test('register and Google accept an optional ageConfirmed true', async () => {
    const created = await accept(RegisterDto, { ...register, ageConfirmed: true });
    assert.equal(created.ageConfirmed, true);
    assert.equal('dateOfBirth' in created, false);

    const omitted = await accept(RegisterDto, register);
    assert.equal(omitted.ageConfirmed, undefined);

    await reject(RegisterDto, { ...register, ageConfirmed: false });
    await reject(GoogleLoginDto, { idToken: 'token', ageConfirmed: false });

    const google = await accept(GoogleLoginDto, { idToken: 'token', ageConfirmed: true });
    assert.equal(google.ageConfirmed, true);
});
