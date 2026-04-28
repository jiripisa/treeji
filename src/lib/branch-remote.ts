import * as p from '@clack/prompts';
import { gitBranchExists, gitRemoteBranchExists } from './git.js';

/**
 * Decide whether to adopt a remote branch when creating a worktree.
 *
 * Returns { adopt: true } if the user confirmed fetching origin/<branch> and
 * tracking it. Returns { adopt: false } in all other cases (local branch already
 * exists, no remote branch, user declined the prompt). On user cancel of the
 * prompt, this function calls `p.cancel('Cancelled.')` and `process.exit(0)`
 * — matching the existing cancel idiom in `pick.ts` (no `return` from caller
 * needed; the process exits).
 */
export async function maybeAdoptRemoteBranch(branch: string): Promise<{ adopt: boolean }> {
  // If local branch already exists, nothing to adopt — caller's standard path handles it.
  if (await gitBranchExists(branch)) return { adopt: false };

  // Local branch missing. Is it on origin?
  if (!(await gitRemoteBranchExists(branch))) return { adopt: false };

  // It exists on origin — ask the user.
  const answer = await p.confirm({
    message: `Branch '${branch}' exists on origin. Fetch it and track origin/${branch}?`,
    initialValue: true,
  });

  if (p.isCancel(answer)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  return { adopt: answer === true };
}
