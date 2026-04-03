---
phase: 2
slug: git-worktree-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | vitest.config.ts (exists from Phase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | WT-02 | unit | `npm test -- src/lib/git.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | CLI-05 | unit | `npm test -- src/lib/slug.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | WT-02 | unit | `npm test -- src/commands/list.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | CLI-03,CLI-04 | unit | `npm test -- src/commands/create.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | WT-04 | unit | `npm test -- src/commands/remove.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | WT-03,CLI-01 | unit | `npm test -- src/commands/switch.test.ts src/commands/setup.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/git.test.ts` — covers WT-02 (porcelain parsing, dirty detection, ahead/behind)
- [ ] `src/lib/slug.test.ts` — covers CLI-05 (diacritics, emoji, all-special, truncation, validation)
- [ ] `src/commands/list.test.ts` — covers WT-02 (list output formatting)
- [ ] `src/commands/create.test.ts` — covers CLI-03, CLI-04 (branch naming, worktree path)
- [ ] `src/commands/remove.test.ts` — covers WT-04 (dirty safety, force, prune)
- [ ] `src/commands/switch.test.ts` — covers WT-03 (sentinel output)
- [ ] `src/commands/setup.test.ts` — covers CLI-01 (shell wrapper output)
- [ ] Install: execa, chalk, slugify (dev deps already handled by Phase 1 vitest)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shell wrapper cd works in parent shell | CLI-01 | Requires real zsh session | Run `mafcli setup`, paste into .zshrc, source, run `mafcd <worktree>` |
| Colored table renders correctly | WT-02 | Terminal rendering | Run `mafcli list` in a real terminal, check colors and alignment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
