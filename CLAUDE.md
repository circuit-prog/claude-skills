# Claude Skills Project Configuration

> This file governs Claude's behavior when working on the claude-skills repository.

---

## Repository Overview

This repository is the source for **`fullstack-dev-skills`** — a Claude Code plugin published to the `jeffallan/claude-skills` marketplace. It ships:

- **66 model-invoked skills** under `skills/` (language experts, frameworks, infra, security, testing, workflow)
- **9 user-invoked slash commands** under `commands/` (`/common-ground`, `/intake:*`, `/project:*`)
- **365 reference files** providing Tier 2 progressive disclosure content
- An **Astro + Starlight documentation site** under `site/` (deployed to `jeffallan.github.io/claude-skills`)
- **Python validation/release tooling** under `scripts/`

Skills follow the [Agent Skills specification](https://agentskills.io/specification) and the project-specific conventions documented below.

---

## Repository Layout

```
.
├── .claude-plugin/        # Plugin manifest (plugin.json) and marketplace.json
├── .github/workflows/     # CI: ci.yml -> validate.yml (skills + markdown + docs sync + lint)
├── assets/                # Social preview HTML/PNG + capture-screenshot.js (puppeteer)
├── commands/              # User-invocable slash commands
│   ├── common-ground/     # /common-ground context-engineering command
│   ├── intake/            # /intake:* codebase onboarding commands
│   ├── project/           # /project:* epic lifecycle commands
│   │   ├── discovery/     # create / synthesize / approve
│   │   ├── planning/      # epic-plan / impl-plan
│   │   ├── execution/     # execute-ticket / complete-ticket
│   │   └── retrospectives/# complete-sprint / complete-epic
│   └── workflow-manifest.yaml  # Phase graph + dependencies
├── docs/                  # Long-form docs (Atlassian setup, workflow guides, prompts, ideas)
├── research/              # Reference research notes (e.g. superpowers.md)
├── scripts/               # Python tooling (see "Development Commands")
├── site/                  # Astro/Starlight documentation site
│   ├── src/               # components, content, content.config.ts, styles
│   ├── scripts/sync-content.mjs  # Pulls skill metadata into site content collections
│   └── package.json       # `npm run dev | build | preview | lint | format`
├── skills/                # 66 model-invoked skills, one directory each
│   └── <skill-name>/
│       ├── SKILL.md       # Tier 1: ~80-100 lines, trigger-only description
│       └── references/    # Tier 2: deep-dive reference files (100-600 lines)
├── specs/                 # Per-feature technical designs (created by skills)
├── CHANGELOG.md           # Keep a Changelog format, manually maintained per release
├── CLAUDE.md              # This file
├── CONTRIBUTING.md        # External contributor guide
├── MODELCLAUDE.md         # Notes on model behavior in this repo
├── Makefile               # Top-level dev/validate/lint/site targets
├── QUICKSTART.md          # End-user install and first-prompt walkthrough
├── README.md              # Landing page (counts auto-updated via HTML markers)
├── ROADMAP.md             # Forward-looking plans
├── SKILLS_GUIDE.md        # Authoritative skill index, decision trees, combinations
├── pyrightconfig.json     # Type-check config (scripts only)
├── ruff.toml              # Python lint/format (scripts only, py311, line-length 120)
├── .prettierrc / .prettierignore  # JS/TS/CSS/Astro formatting (site + assets)
├── .pre-commit-config.yaml # ruff + prettier + pyright hooks
└── version.json           # Single source of truth: {version, skillCount, workflowCount, referenceFileCount}
```

### Key Conventions for the Layout

- **Every skill is a directory** with `SKILL.md` plus a `references/` subdirectory. Never put skill content in a single flat file.
- **Counts are not hand-edited.** `version.json` is the source of truth for `version`; counts are computed by `scripts/update-docs.py` from the filesystem and synced into Markdown via `<!-- SKILL_COUNT -->...<!-- /SKILL_COUNT -->` style HTML markers.
- **`commands/` directories mirror slash command namespaces.** `commands/project/discovery/create.yaml` becomes `/project:discovery:create`. The phase graph lives in `commands/workflow-manifest.yaml`.
- **`site/` is a standalone npm sub-project.** Treat it like a separate package — install and run scripts from inside `site/`.

---

## Development Commands

All targets are defined in the top-level `Makefile`; they wrap the underlying Python and npm tooling.

| Command | What it does |
|---|---|
| `make validate` | Runs `scripts/validate-skills.py` + `scripts/update-docs.py --check`. Run this before every release. |
| `make test` | Runs `scripts/test-makefile.sh` (smoke test for `dev-link` / `dev-unlink`). |
| `make lint` | Ruff (check + format check) + pyright on `scripts/`; Prettier check on `site/` + `assets/`. |
| `make format` / `make lint-fix` | Auto-fix Ruff + Prettier issues. |
| `make site-dev` | `cd site && npm run dev` — local Astro dev server. |
| `make site-build` | `cd site && npm run build` — production site build. |
| `make dev-link` | Symlinks the plugin cache dir to the working copy for iterative local development. Requires the plugin to already be installed. |
| `make dev-unlink` | Restores the cached plugin from `.bak` (reverses `dev-link`). |

### Python Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `update-docs.py` | Reads `version.json`, recomputes counts from the filesystem, writes them back, and updates HTML-marker placeholders in `README.md`, `QUICKSTART.md`, plugin manifests, site content, etc. Supports `--check` (CI dry-fail) and `--dry-run`. |
| `validate-skills.py` | Validates YAML frontmatter, name format, description rules ("Use when", ≤ 1024 chars), references directory existence, and count consistency. Supports `--check {yaml,references,workflows,crossrefs}`, `--skill <name>`, `--format json`. |
| `validate-markdown.py` | Catches HTML comments inside tables, unclosed code fences, missing table separator rows, inconsistent column counts. `--check` for CI. |
| `migrate-frontmatter.py` | One-off / occasional migration helper for frontmatter schema changes. |
| `test-makefile.sh` | Bash smoke test for Makefile targets. |

### Linting & Formatting Rules

- **Python (`scripts/` only):** Ruff with rules `E,W,F,I,UP,B,SIM,RUF`, `target-version = py311`, `line-length = 120`, double quotes, isort with `force-sort-within-sections`. Type-checked with pyright.
- **JS/TS/Astro/CSS (`site/`, `assets/`):** Prettier 3.5.x with `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 120`. The Astro plugin (`prettier-plugin-astro`) must be passed explicitly via `--plugin prettier-plugin-astro` for `.astro` files.
- **Markdown:** No specific linter — but `validate-markdown.py` enforces structural rules (no HTML comments in tables, closed fences, correct table shape).
- **Editor:** `.editorconfig` is authoritative — LF line endings, trim trailing whitespace (except `.md`), final newline required, 2-space indent for JS/TS/JSON/CSS/Astro, 4-space for Python, tabs for `Makefile`.
- **Pre-commit:** Configured in `.pre-commit-config.yaml`. Install with `pre-commit install`. Hooks: ruff (with `--fix`), ruff-format, prettier (on `site/` and `assets/`), pyright (on `scripts/`).

### CI (`.github/workflows/ci.yml`)

CI runs on push/PR to `main` and `dev`. It calls `validate.yml`, which has two jobs:

1. **Validate** — `validate-skills.py`, `validate-markdown.py --check`, `update-docs.py --check`.
2. **Lint** — runs `pre-commit` plus an explicit Astro-formatting check.

If `make validate` and `make lint` pass locally, CI should pass.

---

## Skill Authorship Standards

Skills follow the [Agent Skills specification](https://agentskills.io/specification). This section covers project-specific conventions that go beyond the base spec.

### The Description Trap

**Critical:** Skill descriptions must be TRIGGER-ONLY. Never summarize the workflow or process.

When descriptions contain process steps, agents follow the brief description instead of reading the full skill content. This defeats the purpose of detailed skills.

**BAD - Process in description:**
```yaml
description: Use for debugging. First investigate root cause, then analyze
patterns, test hypotheses, and implement fixes with tests.
```

**GOOD - Trigger-only:**
```yaml
description: Use when encountering bugs, errors, or unexpected behavior
requiring investigation.
```

**Format:** `Use when [specific triggering conditions]`

Descriptions tell WHEN to use the skill. The SKILL.md body tells HOW.

---

### Frontmatter Requirements

Per the [Agent Skills specification](https://agentskills.io/specification), only `name` and `description` are top-level required fields. Custom fields go under `metadata`.

```yaml
---
name: skill-name-with-hyphens
description: Use when [triggering conditions] - max 1024 chars
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.0.0"
  domain: frontend
  triggers: keyword1, keyword2, keyword3
  role: specialist
  scope: implementation
  output-format: code
  related-skills: fullstack-guardian, test-master, devops-engineer
---
```

**Top-level fields (spec-defined):**
- `name`: Letters, numbers, and hyphens only (no parentheses or special characters)
- `description`: Maximum 1024 characters, trigger-only format
- `license`: Always `MIT` for this project
- `allowed-tools`: Space-delimited tool list (only on skills that restrict tools)

**Metadata fields (project-specific):**
- `author`: GitHub profile URL of the skill author
- `version`: Semantic version string (quoted, e.g., `"1.0.0"`)
- `domain`: Category from the domain list below
- `triggers`: Comma-separated searchable keywords
- `role`: `specialist` | `expert` | `architect` | `engineer`
- `scope`: `implementation` | `review` | `design` | `system-design` | `testing` | `analysis` | `infrastructure` | `optimization` | `architecture`
- `output-format`: `code` | `document` | `report` | `architecture` | `specification` | `schema` | `manifests` | `analysis` | `analysis-and-code` | `code+analysis`
- `related-skills`: Comma-separated skill directory names (e.g., `fullstack-guardian, test-master`). Must resolve to existing skill directories.

**Domain values:**
`language` · `backend` · `frontend` · `infrastructure` · `api-architecture` · `quality` · `devops` · `security` · `data-ml` · `platform` · `specialized` · `workflow`

---

### Reference File Standards

Reference files follow the [Agent Skills specification](https://agentskills.io/specification). No specific headers are required.

**Guidelines:**
- 100-600 lines per reference file
- Keep files focused on a single topic
- Complete, working code examples with TypeScript types
- Cross-reference related skills where relevant
- Include "when to use" and "when not to use" guidance
- Practical patterns over theoretical explanations

### Framework Idiom Principle

Reference files for framework-specific skills must reflect the idiomatic best practices of that framework, not generic patterns applied uniformly across all skills. If a framework provides a built-in mechanism (e.g., global error handling, middleware, dependency injection), reference examples should use it rather than duplicating that behavior manually. Each framework's conventions for error handling, architecture, and code organization take precedence over cross-project consistency.

---

### Progressive Disclosure Architecture

**Tier 1 - SKILL.md (~80-100 lines)**
- Role definition and expertise level
- When-to-use guidance (triggers)
- Core workflow (5 steps)
- Constraints (MUST DO / MUST NOT DO)
- Routing table to references

**Tier 2 - Reference Files (100-600 lines each)**
- Deep technical content
- Complete code examples
- Edge cases and anti-patterns
- Loaded only when context requires

**Goal:** 50% token reduction through selective loading.

---

## Project Workflow

### When Creating New Skills

1. Check existing skills for overlap
2. Write SKILL.md with trigger-only description
3. Create reference files for deep content (100+ lines)
4. Add routing table linking topics to references
5. Test skill triggers with realistic prompts
6. Update SKILLS_GUIDE.md if adding new domain

### When Modifying Skills

1. Read the full current skill before editing
2. Maintain trigger-only description format
3. Preserve progressive disclosure structure
4. Update related cross-references
5. Verify routing table accuracy

---

## Release Checklist

When releasing a new version, follow these steps.

### 1. Update Version and Counts

Version and counts are managed through `version.json`:

```json
{
  "version": "0.4.2",
  "skillCount": 65,
  "workflowCount": 9,
  "referenceFileCount": 355
}
```

**To release a new version:**

1. Update the `version` field in `version.json`
2. Run the update script:

```bash
python scripts/update-docs.py
```

The script will:
- Compute counts from the filesystem (skills, references, workflows)
- Update `version.json` with computed counts
- Update all documentation files (README.md, plugin.json, etc.)

**Options:**
```bash
python scripts/update-docs.py --check    # Verify files are in sync (CI use)
python scripts/update-docs.py --dry-run  # Preview changes without writing
```

### 2. Update CHANGELOG.md

Add new version entry at the top following Keep a Changelog format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features, skills, commands

### Changed
- Modified functionality, updated skills

### Fixed
- Bug fixes
```

Add version comparison link at bottom:
```markdown
[X.Y.Z]: https://github.com/jeffallan/claude-skills/compare/vPREVIOUS...vX.Y.Z
```

### 3. Update Documentation for New/Modified Content

**For new skills:**
- Add to `SKILLS_GUIDE.md` in appropriate category
- Add to decision trees if applicable
- Run `python scripts/update-docs.py` to update counts

**For new commands:**
- Add to `docs/WORKFLOW_COMMANDS.md`
- Add to `README.md` Project Workflow Commands table
- Run `python scripts/update-docs.py` to update counts

**For modified skills/commands:**
- Update any cross-references
- Update SKILLS_GUIDE.md if triggers changed

### 4. Generate Social Preview

After all updates, regenerate the social preview image:

```bash
npm install --no-save puppeteer && node ./assets/capture-screenshot.js
```

This creates `assets/social-preview.png` from `assets/social-preview.html`.

### 5. Validate Skills Integrity

**Critical:** Run validation before release to prevent broken skills from being published.

```bash
python scripts/validate-skills.py
```

The script validates:
- **YAML frontmatter** - Parsing, required fields (name, description, triggers), format
- **Name format** - Letters, numbers, hyphens only
- **Description** - Max 1024 chars, starts with "Use when"
- **References** - Directory exists, has files, proper headers
- **Count consistency** - Skills/reference counts match across documentation

**Options:**
```bash
python scripts/validate-skills.py --check yaml       # YAML checks only
python scripts/validate-skills.py --check references # Reference checks only
python scripts/validate-skills.py --skill react-expert  # Single skill
python scripts/validate-skills.py --format json      # JSON output for CI
python scripts/validate-skills.py --help             # Full usage
```

**Exit codes:** 0 = success (warnings OK), 1 = errors found

### 6. Validate Markdown Syntax

**Critical:** Run markdown validation to catch parsing errors.

```bash
python scripts/validate-markdown.py
```

The script validates:
- **HTML comments in tables** - Comments between table rows break parsing
- **Unclosed code blocks** - Ensures all code fences are properly closed
- **Missing table separators** - Tables require `|---|` row after header
- **Column count consistency** - All table rows must have same column count

**Options:**
```bash
python scripts/validate-markdown.py --check       # CI mode (exit code only)
python scripts/validate-markdown.py --path FILE   # Single file
python scripts/validate-markdown.py --format json # JSON output for CI
```

**Exit codes:** 0 = no issues, 1 = issues found

### 7. Final Verification

After running validation, manually verify:

```bash
# Check no old version references remain (except historical changelog)
grep -r "OLD_VERSION" --include="*.md" --include="*.json" --include="*.html"
```

---

## Attribution

Behavioral patterns and process discipline adapted from:
- **[obra/superpowers](https://github.com/obra/superpowers)** by Jesse Vincent (@obra)
- License: MIT

Research documented in: `research/superpowers.md`
