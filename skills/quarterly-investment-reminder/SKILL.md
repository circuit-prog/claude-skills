---
name: quarterly-investment-reminder
description: Use when setting up or executing quarterly investment portfolio reviews, updating investment research spreadsheets, or scheduling recurring financial review reminders.
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.0.0"
  domain: workflow
  triggers: quarterly review, investment reminder, portfolio update, spreadsheet update, financial review, recurring reminder, investment research
  role: specialist
  scope: implementation
  output-format: code
  related-skills: 
---

# Quarterly Investment Reminder

Specialist in setting up automated quarterly reminders and guiding structured investment research spreadsheet updates.

## Role Definition

You are a workflow automation specialist focused on recurring financial review cycles. You help users:
- Set up automated quarterly reminders via cron, systemd timers, or OS-native scheduling
- Execute a structured quarterly investment review process
- Update investment research spreadsheets with current data
- Maintain a disciplined, repeatable review cadence

## When to Use This Skill

- Setting up a new quarterly investment review reminder
- Running a scheduled quarterly portfolio review
- Updating an investment research spreadsheet on a recurring basis
- Automating financial review notifications via cron or systemd timers
- Reviewing and refining an existing quarterly review process

## Core Workflow

1. **Schedule** - Set up the recurring quarterly reminder using cron, systemd timer, or platform scheduler
2. **Notify** - Deliver a reminder message at the start of each quarter (Jan 1, Apr 1, Jul 1, Oct 1)
3. **Review** - Walk through the quarterly review checklist for the investment spreadsheet
4. **Update** - Guide the user through updating each section of their research spreadsheet
5. **Archive** - Snapshot the previous quarter's data before applying changes

## Reminder Setup

### Option A: Cron Job (Linux/macOS)

Create a script that sends a desktop notification and logs the reminder:

```bash
#!/usr/bin/env bash
# File: ~/bin/quarterly-investment-reminder.sh
# Sends a quarterly reminder to update the investment research spreadsheet

LOGFILE="$HOME/investment-review.log"
DATE=$(date '+%Y-%m-%d %H:%M')
QUARTER=$(( ($(date +%-m) - 1) / 3 + 1 ))
YEAR=$(date +%Y)

MESSAGE="Q${QUARTER} ${YEAR} Investment Review: Time to update your investment research spreadsheet."

# Log the reminder
echo "[$DATE] REMINDER: $MESSAGE" >> "$LOGFILE"

# Desktop notification (Linux)
if command -v notify-send &>/dev/null; then
    notify-send "Investment Review Due" "$MESSAGE" --urgency=critical
fi

# Desktop notification (macOS)
if command -v osascript &>/dev/null; then
    osascript -e "display notification \"$MESSAGE\" with title \"Investment Review Due\""
fi

# Optional: send email via local mail
if command -v mail &>/dev/null; then
    echo "$MESSAGE" | mail -s "Q${QUARTER} ${YEAR} Investment Review Reminder" "$USER"
fi

echo "$MESSAGE"
```

Install the cron schedule (runs at 9:00 AM on the first day of each quarter):

```cron
0 9 1 1,4,7,10 * $HOME/bin/quarterly-investment-reminder.sh
```

### Option B: Systemd Timer (Linux)

Service unit (`~/.config/systemd/user/quarterly-investment-reminder.service`):

```ini
[Unit]
Description=Quarterly Investment Review Reminder

[Service]
Type=oneshot
ExecStart=%h/bin/quarterly-investment-reminder.sh
```

Timer unit (`~/.config/systemd/user/quarterly-investment-reminder.timer`):

```ini
[Unit]
Description=Run investment reminder on the 1st of each quarter

[Timer]
OnCalendar=*-01,04,07,10-01 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with:

```bash
systemctl --user enable --now quarterly-investment-reminder.timer
```

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Review Checklist | `references/quarterly-review-checklist.md` | Executing the quarterly review process |
| Spreadsheet Update | `references/spreadsheet-update-guide.md` | Updating investment research spreadsheet sections |

## Constraints

### MUST DO
- Schedule reminders on quarter boundaries (Jan 1, Apr 1, Jul 1, Oct 1)
- Archive previous quarter data before overwriting
- Log each reminder delivery for audit trail
- Make the reminder script idempotent (safe to run multiple times)
- Include both notification and logging in the reminder script
- Use absolute paths in cron entries

### MUST NOT DO
- Provide specific investment advice or stock picks
- Modify spreadsheet data without user confirmation
- Skip the archive step before updates
- Hard-code credentials or API keys in scripts
- Assume a specific spreadsheet tool without asking the user

## Output Templates

Provide: Reminder script, cron/systemd configuration, quarterly review checklist, spreadsheet update procedure
