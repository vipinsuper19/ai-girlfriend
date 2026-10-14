import assert from 'node:assert/strict';
import test from 'node:test';

import { heldoutPathProblem } from './heldout-path.js';

test('a held-out path inside the repo is rejected', () => {
    const root = '/tmp/repo';
    assert.match(
        heldoutPathProblem('/tmp/repo/apps/api/src/moderation/fixtures/cases.json', root) ?? '',
        /outside the repo/,
    );
    assert.match(heldoutPathProblem('/tmp/repo', root) ?? '', /outside the repo/);
    assert.equal(heldoutPathProblem('/tmp/qa/heldout.json', root), null);
    assert.equal(heldoutPathProblem('/tmp/repo-other/cases.json', root), null);
});
