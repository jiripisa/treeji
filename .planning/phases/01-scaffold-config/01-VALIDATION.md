---
phase: 1
slug: scaffold-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | vitest.config.ts (Wave 0 — create) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CLI-02 | unit | `npx vitest run src/lib/keychain.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CLI-02 | unit | `npx vitest run src/lib/keychain.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CLI-02 | integration | `npx vitest run src/lib/keychain.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CLI-06 | smoke | `npx vitest run src/build.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | CLI-06 | smoke | `npx vitest run src/build.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | JIRA-01 | unit | `npx vitest run src/lib/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | JIRA-01 | unit | `npx vitest run src/commands/configure.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 1 | JIRA-01 | unit | `npx vitest run src/lib/jira-validate.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — project config (ESM-compatible)
- [ ] `src/lib/keychain.test.ts` — covers CLI-02 (env fallback, null case, mock round-trip)
- [ ] `src/lib/config.test.ts` — covers JIRA-01 config read/write
- [ ] `src/lib/jira-validate.test.ts` — covers JIRA-01 /myself validation (mocked HTTP)
- [ ] `src/commands/configure.test.ts` — covers JIRA-01 non-interactive flag mode
- [ ] `src/build.test.ts` — smoke test for shebang and executable bit in dist output
- [ ] Framework install: `npm install -D vitest`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token stored in macOS Keychain | CLI-02 | Requires active macOS session with Keychain access | Run `mafcli configure`, check Keychain Access.app for "mafcli" entry |
| Interactive prompts display correctly | JIRA-01 | Terminal UX cannot be automated | Run `mafcli configure` without flags, verify step-by-step prompts appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
