import { isAbsolute, relative, resolve } from 'node:path';

/**
 * Held-out cases are scored from a path outside the git repo.
 * Returns an error message when `filePath` resolves inside `repoRoot`.
 */
export function heldoutPathProblem(filePath: string, repoRoot: string): string | null {
    const root = resolve(repoRoot);
    const target = resolve(filePath);
    const fromRoot = relative(root, target);
    const inside = fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
    if (!inside) return null;
    return `held-out cases must live outside the repo: ${target}`;
}
