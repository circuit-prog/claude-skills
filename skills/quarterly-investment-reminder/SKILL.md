---
name: quarterly-investment-reminder
description: Use when setting up an automated program that messages Claude each quarter to update the Top 20 Investors Tracker spreadsheet with current data.
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.0.0"
  domain: workflow
  triggers: quarterly review, investment reminder, top 20 investors, spreadsheet update, Claude automation, recurring Claude prompt, scheduled task
  role: specialist
  scope: implementation
  output-format: code
  related-skills: 
---

# Quarterly Investment Reminder

Automated program that messages Claude every quarter to update the Top 20 Investors Tracker spreadsheet with new information.

## Role Definition

You are an automation specialist who builds scheduled programs that invoke Claude to perform recurring tasks. This skill produces a working program — not documentation — that runs on a quarterly cron schedule and sends Claude a detailed prompt to research and update the Top 20 Investors Tracker spreadsheet.

## When to Use This Skill

- Setting up an automated quarterly Claude invocation for investment research
- Building a scheduled program that prompts Claude to update a spreadsheet
- Automating recurring research tasks via the Claude Code CLI or Anthropic API

## Core Workflow

1. **Install** - Deploy the program script and configure the API key or CLI
2. **Schedule** - Register the quarterly cron job ~45 days after quarter end (Feb 15, May 15, Aug 15, Nov 15)
3. **Execute** - The program messages Claude with a detailed update prompt
4. **Capture** - Claude's response is saved to a timestamped output file
5. **Log** - Every run is logged for auditability

## Program: Claude Code CLI Version

The simplest approach uses the `claude` CLI in non-interactive print mode (`-p`).

### Script: `quarterly-investment-reminder.sh`

```zsh
#!/bin/zsh
# quarterly-investment-reminder.sh
# Runs quarterly via cron. Messages Claude to update the Top 20 Investors Tracker.

set -euo pipefail

# --- Configuration -----------------------------------------------------------
SPREADSHEET_PATH="${SPREADSHEET_PATH:-$HOME/Documents/Top_20_Investors_Tracker.xlsx}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/Documents/investment-updates}"
LOG_FILE="${LOG_FILE:-$HOME/investment-reminder.log}"

# --- Derived values -----------------------------------------------------------
MONTH=$(date +%m)
QUARTER=$(( (MONTH - 1) / 3 + 1 ))
YEAR=$(date +%Y)
TIMESTAMP=$(date '+%Y-%m-%d_%H%M%S')
OUTPUT_FILE="${OUTPUT_DIR}/Q${QUARTER}_${YEAR}_update_${TIMESTAMP}.md"

mkdir -p "$OUTPUT_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting Q${QUARTER} ${YEAR} Top 20 Investors Tracker update"

# --- Prompt sent to Claude ----------------------------------------------------
PROMPT=$(cat <<'PROMPT_END'
You are updating the Top 20 Investors Tracker spreadsheet for the current quarter.

## Task

Research and produce updated data for the Top 20 most influential investors
(e.g., Warren Buffett, Ray Dalio, Cathie Wood, Michael Burry, Bill Ackman,
David Tepper, Carl Icahn, Seth Klarman, Howard Marks, Stanley Druckenmiller,
George Soros, Dan Loeb, Paul Singer, Nelson Peltz, Jeff Ubben, Chase Coleman,
Philippe Laffont, Terry Smith, Li Lu, Joel Greenblatt) for the current quarter.

For each investor, provide the following columns in a Markdown table:

| Column | Description |
|--------|-------------|
| Investor | Full name |
| Firm | Fund or firm name |
| AUM (est.) | Latest estimated assets under management |
| Top Holdings (Q change) | Top 3-5 current holdings with notable quarterly changes |
| New Positions | Significant new positions opened this quarter |
| Exited Positions | Significant positions closed this quarter |
| Sector Shift | Notable sector rotation or thematic changes |
| Quarterly Commentary | Key public statements, letters, or interviews this quarter |
| Performance (est.) | Estimated quarterly fund performance if publicly available |

## Output Format

1. Return a single Markdown table with ALL 20 investors and the columns above.
2. After the table, include a "Quarterly Highlights" section summarizing the
   3-5 most notable moves across all investors.
3. End with a "Data Sources" section listing where the information can be
   verified (SEC 13F filings, fund letters, interviews, news).

## Important

- Use the most recent publicly available data (13F filings, investor letters,
  news reports, SEC filings).
- If data is unavailable for an investor this quarter, note "No public update"
  rather than guessing.
- Flag any data that is estimated vs. confirmed.
PROMPT_END
)

# --- Send to Claude -----------------------------------------------------------
log "Sending prompt to Claude..."

if command -v claude &>/dev/null; then
    claude -p "$PROMPT" > "$OUTPUT_FILE" 2>>"$LOG_FILE"
    EXIT_CODE=$?
else
    log "ERROR: 'claude' CLI not found. Install Claude Code first."
    exit 1
fi

if [ $EXIT_CODE -eq 0 ]; then
    log "Update saved to: $OUTPUT_FILE"
    log "Q${QUARTER} ${YEAR} update complete."
else
    log "ERROR: Claude exited with code $EXIT_CODE"
    exit $EXIT_CODE
fi
```

### Cron Installation

```bash
# Make the script executable
chmod +x ~/bin/quarterly-investment-reminder.sh

# Install cron job: 9:00 AM on the 15th of Feb, May, Aug, Nov (~45 days after quarter end)
(crontab -l 2>/dev/null; echo "0 9 15 2,5,8,11 * $HOME/bin/quarterly-investment-reminder.sh") | crontab -
```

## Program: Python + Anthropic SDK Version

For more control (model selection, token limits, retries), use the Anthropic Python SDK.

### Script: `quarterly_investment_reminder.py`

```python
#!/usr/bin/env python3
"""Quarterly Investment Reminder — messages Claude via the Anthropic API
to update the Top 20 Investors Tracker spreadsheet."""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

import anthropic

# --- Configuration ------------------------------------------------------------
OUTPUT_DIR = Path(os.environ.get(
    "OUTPUT_DIR", Path.home() / "Documents" / "investment-updates"
))
LOG_FILE = Path(os.environ.get(
    "LOG_FILE", Path.home() / "investment-reminder.log"
))
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "8192"))

# --- Logging ------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# --- Quarter calculation ------------------------------------------------------
now = datetime.now()
quarter = (now.month - 1) // 3 + 1
year = now.year
timestamp = now.strftime("%Y-%m-%d_%H%M%S")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
output_file = OUTPUT_DIR / f"Q{quarter}_{year}_update_{timestamp}.md"

PROMPT = """\
You are updating the Top 20 Investors Tracker spreadsheet for the current quarter.

## Task

Research and produce updated data for the Top 20 most influential investors
(e.g., Warren Buffett, Ray Dalio, Cathie Wood, Michael Burry, Bill Ackman,
David Tepper, Carl Icahn, Seth Klarman, Howard Marks, Stanley Druckenmiller,
George Soros, Dan Loeb, Paul Singer, Nelson Peltz, Jeff Ubben, Chase Coleman,
Philippe Laffont, Terry Smith, Li Lu, Joel Greenblatt) for the current quarter.

For each investor, provide the following columns in a Markdown table:

| Column | Description |
|--------|-------------|
| Investor | Full name |
| Firm | Fund or firm name |
| AUM (est.) | Latest estimated assets under management |
| Top Holdings (Q change) | Top 3-5 current holdings with notable quarterly changes |
| New Positions | Significant new positions opened this quarter |
| Exited Positions | Significant positions closed this quarter |
| Sector Shift | Notable sector rotation or thematic changes |
| Quarterly Commentary | Key public statements, letters, or interviews this quarter |
| Performance (est.) | Estimated quarterly fund performance if publicly available |

## Output Format

1. Return a single Markdown table with ALL 20 investors and the columns above.
2. After the table, include a "Quarterly Highlights" section summarizing the
   3-5 most notable moves across all investors.
3. End with a "Data Sources" section listing where the information can be
   verified (SEC 13F filings, fund letters, interviews, news).

## Important

- Use the most recent publicly available data (13F filings, investor letters,
  news reports, SEC filings).
- If data is unavailable for an investor this quarter, note "No public update"
  rather than guessing.
- Flag any data that is estimated vs. confirmed.
"""


def main() -> None:
    log.info("Starting Q%d %d Top 20 Investors Tracker update", quarter, year)

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    log.info("Sending prompt to Claude (%s)...", MODEL)
    message = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": PROMPT}],
    )

    response_text = message.content[0].text
    output_file.write_text(response_text, encoding="utf-8")

    log.info("Update saved to: %s", output_file)
    log.info("Tokens used — input: %d, output: %d",
             message.usage.input_tokens, message.usage.output_tokens)
    log.info("Q%d %d update complete.", quarter, year)


if __name__ == "__main__":
    main()
```

### Setup

```bash
# Install dependency
pip install anthropic

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Make executable
chmod +x ~/bin/quarterly_investment_reminder.py

# Cron (9 AM, ~45 days after quarter end: Feb 15, May 15, Aug 15, Nov 15)
(crontab -l 2>/dev/null; echo "0 9 15 2,5,8,11 * ANTHROPIC_API_KEY=sk-ant-... $HOME/bin/quarterly_investment_reminder.py") | crontab -
```

## Reference Guide

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Review Checklist | `references/quarterly-review-checklist.md` | Reviewing what Claude should check each quarter |
| Spreadsheet Columns | `references/spreadsheet-update-guide.md` | Understanding the Top 20 Investors Tracker format |

## Constraints

### MUST DO
- Store API keys in environment variables or a secrets manager, never in the script
- Log every invocation with timestamp and outcome
- Save Claude's output to a timestamped file (never overwrite previous runs)
- Schedule ~45 days after quarter end (Feb 15, May 15, Aug 15, Nov 15) so 13F filings are available
- Validate that the `claude` CLI or `anthropic` package is available before running

### MUST NOT DO
- Hard-code API keys or secrets in the script
- Silently discard Claude's output on failure
- Overwrite previous quarter's output files
- Provide specific investment advice — the program gathers public research data only
- Run without logging enabled
