---
name: compound-engineering-setup
description: Configure review agents for your project
disable-model-invocation: true
---

# Compound Engineering Setup

Interactive setup for `compound-engineering.local.md` — configures which agents run during `/workflows:review`.

## Step 1: Check Existing Config

Read `compound-engineering.local.md`. If it exists, display current settings summary and use AskUserQuestion:

```
question: "Settings file already exists. What would you like to do?"
header: "Config"
options:
  - label: "Reconfigure"
    description: "Run the interactive setup again from scratch"
  - label: "View current"
    description: "Show the file contents, then stop"
  - label: "Cancel"
    description: "Keep current settings"
```

If "View current": read and display the file, then stop.
If "Cancel": stop.

## Step 2: Detect Project Type

Auto-detect the project stack:

```bash
test -f Gemfile && test -f config/routes.rb && echo "rails" || \
test -f Gemfile && echo "ruby" || \
test -f tsconfig.json && echo "typescript" || \
test -f package.json && echo "javascript" || \
test -f pyproject.toml && echo "python" || \
test -f requirements.txt && echo "python" || \
echo "general"
```

Display what was detected, then ask:

```
question: "Detected {type} project. How would you like to configure?"
header: "Setup"
options:
  - label: "Auto-configure (Recommended)"
    description: "Use smart defaults for {type}. Done in one click."
  - label: "Customize"
    description: "Choose focus areas, review depth, and agents yourself."
```

### If Auto-configure → Skip to Step 5 with these defaults:

**Rails:** `kieran-rails-reviewer, dhh-rails-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`
**Python:** `kieran-python-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`
**TypeScript:** `kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`
**General:** `code-simplicity-reviewer, security-sentinel, performance-oracle, architecture-strategist`

### If Customize → Continue to Step 3

## Step 3: Confirm Stack (Customize path only)

Use AskUserQuestion to confirm or override the detected stack:

```
question: "Which stack should we optimize for?"
header: "Stack"
options:
  - label: "{detected_type} (Recommended)"
    description: "Auto-detected from project files"
  - label: "Rails"
    description: "Ruby on Rails — adds DHH-style and Rails-specific reviewers"
  - label: "Python"
    description: "Python — adds Pythonic pattern reviewer"
  - label: "TypeScript"
    description: "TypeScript — adds type safety reviewer"
```

Only show options that differ from the detected type.

## Step 4a: Choose Review Focus Areas (Customize path only)

Use AskUserQuestion with multiSelect:

```
question: "Which review areas matter most for this project?"
header: "Focus"
multiSelect: true
options:
  - label: "Security"
    description: "Vulnerability scanning, auth, input validation (security-sentinel)"
  - label: "Performance"
    description: "N+1 queries, memory leaks, complexity (performance-oracle)"
  - label: "Architecture"
    description: "Design patterns, SOLID, separation of concerns (architecture-strategist)"
  - label: "Code simplicity"
    description: "Over-engineering, YAGNI violations (code-simplicity-reviewer)"
```

## Step 4b: Choose Review Depth (Customize path only)

Use AskUserQuestion:

```
question: "How thorough should reviews be?"
header: "Depth"
options:
  - label: "Thorough (Recommended)"
    description: "Stack reviewers + all selected focus agents."
  - label: "Fast"
    description: "Stack reviewers + code simplicity only. Less context, quicker."
  - label: "Comprehensive"
    description: "All of the above + git history, data integrity, agent-native checks."
```

## Step 5: Build Agent List and Write File

Map selections to agents:

**Stack-specific agents (always included):**
- Rails → `kieran-rails-reviewer, dhh-rails-reviewer`
- Python → `kieran-python-reviewer`
- TypeScript → `kieran-typescript-reviewer`
- General → (none)

**Focus area agents (from Step 4a, or all four for auto-configure):**
- Security → `security-sentinel`
- Performance → `performance-oracle`
- Architecture → `architecture-strategist`
- Code simplicity → `code-simplicity-reviewer`

**Depth extras (from Step 4b, or "Thorough" for auto-configure):**
- Thorough: stack + selected focus areas
- Fast: stack + `code-simplicity-reviewer` only
- Comprehensive: stack + all focus areas + `git-history-analyzer, data-integrity-guardian, agent-native-reviewer`

**Plan review agents:** always use the stack-specific reviewer + `code-simplicity-reviewer`.

Write `compound-engineering.local.md`:

```markdown
---
review_agents: [{computed agent list}]
plan_review_agents: [{computed plan agent list}]
---

# Review Context

Add project-specific review instructions here.
These notes are passed to all review agents during /workflows:review and /workflows:work.

Examples:
- "We use Turbo Frames heavily — check for frame-busting issues"
- "Our API is public — extra scrutiny on input validation"
- "Performance-critical: we serve 10k req/s on this endpoint"
```

## Step 6: Confirm

Display summary:

```
Saved to compound-engineering.local.md

Stack:        {type}
Review depth: {depth}
Agents:       {count} configured
              {agent list, one per line}

Tip: Add project-specific instructions in the "Review Context" section.
     Run /workflows:review to use your configured agents.
     Re-run /compound-engineering-setup anytime to reconfigure.
```
