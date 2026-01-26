---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, architecture, quality, docs]
dependencies: []
---

# Wire conditionalAgents into /workflows:review

## Problem Statement

The new setup command defines `conditionalAgents` (frontend, architecture, data), but `/workflows:review` only references migrations and ignores other conditional categories. This creates a configuration contract that is not actually executed during reviews.

## Findings

- `plugins/compound-engineering/commands/setup.md` introduces `conditionalAgents` keys beyond migrations.
- `plugins/compound-engineering/commands/workflows/review.md` contains no logic that reads or runs non-migration conditional agents.
- Result: users can configure conditional agents that never run.

## Proposed Solutions

### Option 1: Add explicit conditional agent rules to review workflow

**Approach:** Extend `/workflows:review` with conditional checks for frontend, architecture, and data changes, then invoke configured agents.

**Pros:**
- Aligns behavior with the new configuration surface.
- Preserves the documented “smart agents” promise.

**Cons:**
- Adds more workflow logic to maintain.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Restrict config to migrations only

**Approach:** Remove non-migration categories from setup defaults and docs until the workflow supports them.

**Pros:**
- Minimal change.
- Prevents misleading configuration.

**Cons:**
- Reduces flexibility and value of the new setup command.

**Effort:** Small

**Risk:** Low

---

### Option 3: Document non-migration conditionals as future/optional

**Approach:** Keep config shape but explicitly mark non-migration categories as not yet wired.

**Pros:**
- Sets correct expectations quickly.

**Cons:**
- Still leaves dead config keys.

**Effort:** Small

**Risk:** Medium

## Recommended Action

## Technical Details

Affected files:
- `plugins/compound-engineering/commands/setup.md`
- `plugins/compound-engineering/commands/workflows/review.md`

## Resources

- PR: https://github.com/EveryInc/compound-engineering-plugin/pull/124

## Acceptance Criteria

- [ ] `/workflows:review` invokes configured conditional agents beyond migrations, or docs/config are narrowed to match reality.
- [ ] Behavior is documented with clear, testable trigger rules.

## Work Log

- 2026-01-26: Identified config/workflow mismatch during PR #124 review.
- 2026-01-25: **Approved for work** during triage session. Status: pending → ready.
