---
phase: 4
slug: interactive-picker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 4 — Validation Strategy

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
| 04-01-01 | 01 | 1 | WT-05 | unit | `npm test -- src/lib/jira.test.ts` | ✅ extend | ⬜ pending |
| 04-01-02 | 01 | 1 | WT-05 | unit | `npm test -- src/commands/pick.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/commands/pick.test.ts` — covers WT-05 (pick selection, type prompt, worktree creation, empty state, spinner)
- [ ] Extend `src/lib/jira.test.ts` — covers fetchAssignedIssues

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive picker renders correctly | WT-05 | Terminal TUI rendering | Run `mafcli pick` with real JIRA, verify ticket list appears |
| Spinner shown during loading | WT-05 | Visual UX | Observe spinner before ticket list appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
