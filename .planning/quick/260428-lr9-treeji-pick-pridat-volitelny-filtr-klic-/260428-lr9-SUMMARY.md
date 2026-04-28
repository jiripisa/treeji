---
phase: quick-260428-lr9
plan: 01
status: complete
date: 2026-04-28
---

# Quick Task 260428-lr9 — Summary

## Description

Rozšířit `treeji pick` o volitelný poziční argument. Bez argumentu = stávající chování. S argumentem (`treeji pick ABC`) nabídnout pouze tickety, kde `key` NEBO `summary` obsahují substring (case-insensitive). Při použití filtru zahrnout i uzavřené tickety, aby šlo dohledat starší práci.

## What changed

### `src/commands/pick.ts`
- `program.command('pick [filter]')` — argument je volitelný; bez něho stejné chování jako dosud.
- `matchesFilter(issue, filter)` — modul-private helper, case-insensitive substring na `key` + `summary`.
- Když je filter zadaný: `fetchAssignedIssues(50, /* includeAll */ true)` (zahrne i uzavřené tickety).
- Empty-state hláška se větví: `No tickets matching "<filter>".` vs původní `No assigned open tickets found.`
- 50-ticket "Showing first 50…" stderr poznámka zůstává na neflitrované velikosti listu (50 je server-side cap).

### `src/commands/pick.test.ts`
- Nový blok `describe('FILTER ARGUMENT', ...)` s 9 testy: shoda v key, shoda v summary, case-insensitivity, žádná shoda, prázdný filter = backwards-compat, includeAll flip, atd.

### `README.md`
- Dokumentace `treeji pick [filter]` v Usage sekci, v "pick vs create" porovnání i v Commands tabulce.
- Nová sekce `Existing remote branches` popisující detekci remote branch (z minulého quick tasku 260428-lau) v `pick` i `create`.
- Doplněna `remove --force` a `--yes` flagy do Commands tabulky (orchestrátor doplnil).

## Tests

`npm run test`: **240 passed | 2 skipped** (baseline 231 → +9 nových testů, žádné regrese)
`npm run build`: **success** — `dist/index.js 47.49 KB`

## Commits

| Hash | Message |
|------|---------|
| `7bda121` | test(quick-260428-lr9-01): add failing tests for treeji pick [filter] argument |
| `b7ed29b` | feat(quick-260428-lr9-01): add optional [filter] argument to treeji pick |
| `af00243` | docs: README — pick filter arg and remote-branch fetch |

## Notes

- TDD flow: RED commit (failing tests) → GREEN commit (implementation) → docs commit (README).
- Filter běží **client-side** (Array.prototype.filter) — JIRA's `text ~` JQL operator neumí substring na ticket key, takže push do JQL by stejně nepokryl ID-substring. Pro single-developer tool s nízkým počtem ticketů je to triviálně rychlé.
- Worktree byl vytvořen z `bb4f806` místo z aktuální HEAD `2956219`; executor to opravil přes `git reset --soft 2956219` + selective checkout (známý issue Windows EnterWorktree, na macOS ale taky občas vystoupil).
