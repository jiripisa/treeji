# mafcli

## What This Is

CLI nástroj pro správu git worktrees s integrací na JIRA Cloud. Umožňuje vytvářet worktrees automaticky z JIRA ticketů (zadáním čísla nebo výběrem z přiřazených), přepínat mezi nimi, zobrazovat jejich stav a mazat je. Osobní nástroj pro jednoho vývojáře.

## Core Value

Rychlé vytvoření worktree z JIRA ticketu jedním příkazem — bez ručního kopírování názvů, zakládání branchí a navigace po souborovém systému.

## Requirements

### Validated

- ✓ Konfigurace JIRA Cloud připojení (URL, email, API token) — Phase 1
- ✓ Secure token storage in OS keychain with env var fallback — Phase 1
- ✓ CLI installable globally via npm — Phase 1
- ✓ Přepnout se do existujícího worktree (cd do adresáře) — Phase 2
- ✓ Smazat worktree (včetně branch) — Phase 2
- ✓ Zobrazit seznam všech worktrees se stavem (dirty, ahead/behind) — Phase 2
- ✓ Branch naming: `{typ}/{TICKET-slug}`, typ zadává uživatel ručně — Phase 2
- ✓ Worktree adresář: vedle hlavního repa jako `../{TICKET-slug}/` — Phase 2
- ✓ Vytvořit worktree zadáním JIRA ticket ID (PROJ-123) — CLI stáhne název z JIRA, vytvoří branch a worktree — Phase 3
- ✓ JIRA ticket status v list view (batch JQL, graceful degradation) — Phase 3

- ✓ Zobrazit seznam přiřazených JIRA ticketů a vytvořit worktree výběrem z nich — Phase 4

### Active

(All v1 requirements validated)

### Out of Scope

- GUI / TUI s interaktivním rozhraním — CLI only
- JIRA Server / Data Center — pouze Cloud
- Automatické mazání merged worktrees — v1 jen manuální mazání
- Automatické určování typu branch z JIRA issue type
- Podpora více JIRA projektů současně v jednom příkazu

## Context

- Osobní nástroj pro zefektivnění workflow při práci na více JIRA ticketech paralelně
- JIRA Cloud s API tokenem pro autentizaci (Atlassian REST API v3)
- Worktrees žijí vedle hlavního repa (`../TICKET-slug/`), ne uvnitř
- Název CLI příkazu: `mafcli`
- Branch formát: `{typ}/{TICKET-slug}` — typ se zadává ručně při vytváření (feature, bugfix, chore, ...)
- Worktree adresář: `../{TICKET-slug}/` — bez typu, jen ticket a slug

## Constraints

- **Runtime**: Node.js — TypeScript CLI (přirozená volba pro JIRA API integraci, JSON parsing, rychlý vývoj)
- **Auth**: JIRA Cloud REST API v3 s Basic Auth (email + API token)
- **Git**: Vyžaduje git s podporou worktrees (2.5+)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Node.js | Rychlý vývoj, nativní JSON/HTTP, npm distribuce | — Pending |
| Worktrees vedle repa, ne uvnitř | Čistší separace, žádné konflikty s .gitignore | — Pending |
| Ruční zadávání typu branch | Jednodušší implementace, uživatel ví nejlíp co dělá | — Pending |
| JIRA Cloud only | Osobní tool, stačí jeden backend | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 after Phase 4 completion — v1 milestone complete*
