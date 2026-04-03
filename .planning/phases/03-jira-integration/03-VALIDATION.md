---
phase: 3
slug: jira-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 3 — Validation Strategy

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
| 03-01-01 | 01 | 1 | JIRA-02,JIRA-04,JIRA-05 | unit | `npm test -- src/lib/jira.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | WT-01 | unit | `npm test -- src/commands/create.test.ts` | ✅ extend | ⬜ pending |
| 03-02-02 | 02 | 2 | WT-06 | unit | `npm test -- src/commands/list.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/jira.test.ts` — covers JIRA-02 (fetchIssue), JIRA-04 (fetchIssueStatuses batch JQL), JIRA-05 (retry/backoff)
- [ ] Extend `src/commands/create.test.ts` — JIRA ID detection, summary slug generation
- [ ] Extend `src/commands/list.test.ts` — Status column, graceful degradation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JIRA API token auth works against real instance | JIRA-02 | Requires real JIRA Cloud | Run `mafcli create PROJ-123 feature` against real JIRA |
| Rate limit retry actually fires | JIRA-05 | Hard to trigger real 429 | Monitor logs during high-volume testing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
