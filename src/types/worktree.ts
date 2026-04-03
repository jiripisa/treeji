export interface WorktreeInfo {
  path: string;       // absolute path to worktree directory
  head: string;       // full commit SHA
  branch: string | null;  // branch name without refs/heads/ prefix; null if detached HEAD
  isMain: boolean;    // true only for the first entry (main worktree)
}
