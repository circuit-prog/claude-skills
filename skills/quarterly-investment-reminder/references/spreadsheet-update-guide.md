# Top 20 Investors Tracker — Spreadsheet Format Guide

Column definitions and formatting guidelines for the Top 20 Investors Tracker spreadsheet that Claude updates each quarter.

## Spreadsheet Column Definitions

The program asks Claude to produce a Markdown table with these columns:

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Investor | Text | Full name of the investor | Warren Buffett |
| Firm | Text | Fund or management company | Berkshire Hathaway |
| AUM (est.) | Currency | Estimated assets under management | $780B |
| Top Holdings (Q change) | Text | Top 3-5 positions with change indicators | AAPL (+), BAC (=), CVX (-) |
| New Positions | Text | Positions opened this quarter | CRM, SNOW |
| Exited Positions | Text | Positions fully closed this quarter | TSM |
| Sector Shift | Text | Thematic or sector rotation notes | Increasing energy, reducing tech |
| Quarterly Commentary | Text | Notable public statements or letters | "Cash is king in uncertain markets" |
| Performance (est.) | Percentage | Estimated quarterly return | +3.2% (est.) |

### Change Indicators for Top Holdings

Use these symbols to denote quarterly changes:

- `(+)` — Position size increased this quarter
- `(-)` — Position size decreased this quarter
- `(=)` — Position size unchanged
- `(NEW)` — Position opened this quarter (also listed in New Positions)

## Output File Format

Each run produces a Markdown file saved to the output directory:

```
~/Documents/investment-updates/
├── Q1_2026_update_2026-03-15_090000.md
├── Q2_2026_update_2026-06-15_090000.md
├── Q3_2026_update_2026-09-15_090000.md
└── Q4_2026_update_2026-12-15_090000.md
```

### File Structure

Each output file contains three sections:

```markdown
# Top 20 Investors Tracker — Q2 2026 Update

## Investor Table

| Investor | Firm | AUM (est.) | Top Holdings (Q change) | New Positions | Exited Positions | Sector Shift | Quarterly Commentary | Performance (est.) |
|----------|------|-----------|------------------------|---------------|-----------------|-------------|---------------------|-------------------|
| Warren Buffett | Berkshire Hathaway | $780B | AAPL (+), BAC (=), ... | ... | ... | ... | ... | +2.1% |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## Quarterly Highlights

1. Most notable move across all 20 investors
2. Second most notable move
3. ...

## Data Sources

- SEC EDGAR 13F filings (filed 2026-05-15)
- Berkshire Hathaway Q1 2026 shareholder letter
- ...
```

## Converting Output to a Spreadsheet

Claude's output is Markdown. To convert it into an actual spreadsheet:

### Option A: Manual Copy-Paste

1. Open the output `.md` file
2. Copy the Markdown table
3. Paste into Google Sheets or Excel (some editors parse Markdown tables directly)

### Option B: Automated Conversion with Python

```python
"""Convert the Markdown output to an Excel spreadsheet."""
import re
import sys
from pathlib import Path

import openpyxl


def md_table_to_rows(md_text: str) -> list[list[str]]:
    """Extract rows from a Markdown table."""
    lines = md_text.strip().split("\n")
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        # Skip separator rows (|---|---|...)
        if re.match(r"^\|[\s\-:|]+\|$", line):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        rows.append(cells)
    return rows


def convert(md_path: str, xlsx_path: str) -> None:
    """Read a Markdown file and write the investor table to Excel."""
    md_text = Path(md_path).read_text(encoding="utf-8")

    # Extract just the table section
    table_lines = [
        line for line in md_text.split("\n")
        if line.strip().startswith("|")
    ]
    table_text = "\n".join(table_lines)
    rows = md_table_to_rows(table_text)

    if not rows:
        print("No table found in the Markdown file.")
        sys.exit(1)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Top 20 Investors"

    for row in rows:
        ws.append(row)

    # Auto-size columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    wb.save(xlsx_path)
    print(f"Saved: {xlsx_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python md_to_xlsx.py <input.md> <output.xlsx>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
```

### Option C: Pipe the Conversion into the Cron Job

Extend the bash or Python program to run the conversion automatically after Claude responds:

```bash
# Append to quarterly-investment-reminder.sh after Claude writes the .md file:
python3 ~/bin/md_to_xlsx.py "$OUTPUT_FILE" "${OUTPUT_FILE%.md}.xlsx"
```

This produces both the raw Markdown and an Excel file each quarter.

## Environment Variables

Both the bash and Python scripts accept these overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `OUTPUT_DIR` | `~/Documents/investment-updates` | Where output files are saved |
| `LOG_FILE` | `~/investment-reminder.log` | Log file path |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Model to use (Python script only) |
| `MAX_TOKENS` | `8192` | Max response tokens (Python script only) |
| `ANTHROPIC_API_KEY` | (none) | Required for the Python script |
| `SPREADSHEET_PATH` | `~/Documents/Top_20_Investors_Tracker.xlsx` | Reference path for the tracker |

## Schedule

The default cron runs ~45 days after each quarter ends (Feb 15, May 15, Aug 15, Nov 15), which is right after the SEC 13F filing deadline. This ensures the most complete data is available.

```cron
# Default: 45 days after quarter end, after 13F deadline
0 9 15 2,5,8,11 * ~/bin/quarterly-investment-reminder.sh

# Alternative: Two runs — early estimate at quarter start + post-13F final
0 9 1 1,4,7,10 * ~/bin/quarterly-investment-reminder.sh    # early
0 9 15 2,5,8,11 * ~/bin/quarterly-investment-reminder.sh   # final
```
