# Workflow: Audit Foundations

<required_reading>
Read these references before auditing:
1. `../references/progressive-disclosure.md`
2. `../references/repo-as-system-of-record.md`
</required_reading>

<process>
## Step 1: Identify Project Context

Detect repo shape and stack signals:

- `Gemfile`, `config/routes.rb` -> Rails
- `package.json`, `tsconfig.json` -> frontend/TS
- `pyproject.toml` -> Python
- `go.mod` -> Go

Use this only to decide stack-specific checks.

## Step 2: Audit Core Tier (Always)

Check these artifacts:

- `CLAUDE.md`
- `docs/CONVENTIONS.md`
- `docs/TECH_DEBT.md`

For `CLAUDE.md`, also check quality:

- Is it map-style?
- Is it under ~200 lines?
- Does it link to docs artifacts?

## Step 3: Audit Recommended Tier

Check:

- `docs/ARCHITECTURE.md`
- `docs/QUALITY_SCORE.md`
- `docs/design-docs/`
- `docs/plans/`

## Step 4: Audit Stack-Specific Tier

Conditionally check:

- `docs/FRONTEND.md` if frontend stack is detected
- `docs/DESIGN.md` if UI/design system is detected
- `docs/SECURITY.md` if auth/payments/user data exists

## Step 5: Produce Scorecard

Output as markdown table:

| Artifact | Status | Action |
|---|---|---|
| `CLAUDE.md` | present/missing/weak | concrete next action |

Include summary line:

`X/Y foundations present.`

## Step 6: Offer Artifact Generation

For missing artifacts, ask user if they want generation.
If yes, invoke `generate-artifacts.md` workflow.

## Step 7: Report Promotion Opportunities

If debt or solution patterns show repeated issues, suggest:

- Track as tech debt
- Promote to convention

Do not auto-modify conventions in audit mode.
</process>

<success_criteria>
- [ ] Core tier audited with clear pass/fail status
- [ ] Recommended tier audited with actionable gaps
- [ ] Stack-specific tier checked based on repo signals
- [ ] Scorecard uses `Artifact | Status | Action` format
- [ ] Summary line includes `X/Y foundations present.`
- [ ] Missing artifacts can be generated on request
</success_criteria>
