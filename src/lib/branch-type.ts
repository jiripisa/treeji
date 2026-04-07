import * as p from '@clack/prompts';

export const BRANCH_TYPE_OPTIONS: Array<{ value: string; hint: string }> = [
  { value: 'feature', hint: 'new feature for the user, not a new feature for a build script' },
  { value: 'fix', hint: 'bug fix for the user, not a fix to a build script' },
  { value: 'refactor', hint: 'refactoring production code, e.g., renaming a variable' },
  { value: 'docs', hint: 'changes to the documentation' },
  { value: 'style', hint: 'formatting, missing semicolons, etc.; no production code change' },
  { value: 'test', hint: 'adding missing tests, refactoring tests; no production code change' },
  { value: 'chore', hint: 'updating grunt tasks etc.; no production code change' },
  { value: 'custom', hint: 'type your own branch type' },
  { value: 'none', hint: 'no branch type prefix' },
];

export async function promptBranchType(): Promise<string> {
  const selected = await p.select({
    message: 'Branch type',
    options: BRANCH_TYPE_OPTIONS,
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (selected === 'none') {
    return '';
  }

  if (selected === 'custom') {
    const customType = await p.text({
      message: 'Custom branch type',
      validate: (v) => (!v ? 'Cannot be empty' : undefined),
    });

    if (p.isCancel(customType)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    return customType as string;
  }

  return selected as string;
}
