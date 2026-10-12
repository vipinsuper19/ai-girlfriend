import assert from 'node:assert/strict';
import test from 'node:test';

import { takeReportSlot, REPORT_THROTTLE_LIMIT, REPORT_THROTTLE_WINDOW_MS } from './report-throttle.js';

test('allows a burst up to the limit and then refuses until the window moves', () => {
    const start = 1_000_000;
    let hits: number[] = [];
    for (let i = 0; i < REPORT_THROTTLE_LIMIT; i += 1) {
        const decision = takeReportSlot(hits, start + i);
        assert.equal(decision.allowed, true);
        hits = decision.hits;
    }

    const blocked = takeReportSlot(hits, start + REPORT_THROTTLE_LIMIT);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.hits.length, REPORT_THROTTLE_LIMIT);

    const later = takeReportSlot(blocked.hits, start + REPORT_THROTTLE_WINDOW_MS);
    assert.equal(later.allowed, true);
    assert.equal(later.hits.length, REPORT_THROTTLE_LIMIT);
});
