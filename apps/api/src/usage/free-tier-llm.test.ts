import assert from 'node:assert/strict';
import test from 'node:test';

import { UsageFeatureDto } from './dto/record-usage.dto.js';
import {
    freeTierLlmConfig,
    limitFor,
    periodFor,
} from './free-tier-llm.js';

test('free tier defaults to a daily message and token cap', () => {
    assert.deepEqual(freeTierLlmConfig({}), {
        period: 'day',
        messageLimit: 40,
        tokenLimit: 50_000,
    });
    assert.equal(periodFor('FREE', UsageFeatureDto.MESSAGES, {}), 'day');
    assert.equal(limitFor('FREE', UsageFeatureDto.TEXT_TOKENS, {}), 50_000);
});

test('env overrides the period and limits, and unlimited is explicit', () => {
    const env = {
        FREE_TIER_LLM_PERIOD: 'month',
        FREE_TIER_LLM_MESSAGE_LIMIT: '12',
        FREE_TIER_LLM_TOKEN_LIMIT: 'unlimited',
    };
    assert.equal(periodFor('FREE', UsageFeatureDto.MESSAGES, env), 'month');
    assert.equal(limitFor('FREE', UsageFeatureDto.MESSAGES, env), 12);
    assert.equal(limitFor('FREE', UsageFeatureDto.TEXT_TOKENS, env), null);
});

test('a bad env value keeps the default instead of dropping the cap', () => {
    const env = {
        FREE_TIER_LLM_PERIOD: 'weekly',
        FREE_TIER_LLM_MESSAGE_LIMIT: '-5',
        FREE_TIER_LLM_TOKEN_LIMIT: 'lots',
    };
    assert.equal(freeTierLlmConfig(env).period, 'day');
    assert.equal(freeTierLlmConfig(env).messageLimit, 40);
    assert.equal(freeTierLlmConfig(env).tokenLimit, 50_000);
});

test('premium chat stays on the monthly table', () => {
    assert.equal(periodFor('PREMIUM', UsageFeatureDto.MESSAGES, {}), 'month');
    assert.equal(limitFor('PREMIUM', UsageFeatureDto.MESSAGES, {}), null);
    assert.equal(limitFor('FREE', UsageFeatureDto.IMAGE_GENERATIONS, {}), 5);
});
