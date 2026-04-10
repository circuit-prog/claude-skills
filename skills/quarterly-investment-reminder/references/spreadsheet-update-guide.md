# Investment Research Spreadsheet Update Guide

Detailed guide for updating each section of the investment research spreadsheet during the quarterly review cycle.

## Spreadsheet Structure Overview

A well-organized investment research spreadsheet typically contains these sheets/tabs:

| Tab | Purpose | Update Frequency |
|-----|---------|-----------------|
| Holdings | Current portfolio positions and values | Quarterly |
| Performance | Returns tracking and benchmark comparison | Quarterly |
| Income | Dividends, interest, distributions | Quarterly |
| Allocation | Asset class breakdown and targets | Quarterly |
| Research | Individual security analysis and thesis notes | As needed |
| Watchlist | Prospective investments under evaluation | Quarterly |
| Transactions | Buy/sell log for the quarter | As transactions occur |

## Updating the Holdings Tab

### Column Layout

```
| Ticker | Name | Shares | Cost Basis | Avg Cost | Current Price | Market Value | Gain/Loss | Gain/Loss % | Sector | Account |
```

### Update Process

1. **Export current positions** from your brokerage account
2. **Cross-reference** exported data with spreadsheet rows
3. **Update share counts** for any positions where you bought or sold partial lots
4. **Update current price** for each holding using end-of-quarter closing prices
5. **Recalculate formulas** for Market Value, Gain/Loss, and Gain/Loss %

### Formula Reference

```
Market Value    = Shares * Current Price
Gain/Loss       = Market Value - Cost Basis
Gain/Loss %     = (Market Value - Cost Basis) / Cost Basis * 100
Average Cost    = Cost Basis / Shares
```

### Handling Special Cases

**Stock splits:**
- Multiply share count by split ratio
- Divide cost basis per share by split ratio
- Total cost basis remains unchanged

**Spin-offs:**
- Add new row for the spun-off entity
- Allocate original cost basis proportionally (check IRS guidance or brokerage allocation)
- Note the spin-off date and allocation method

**Mergers/Acquisitions:**
- If cash deal: remove position, record realized gain/loss in Transactions tab
- If stock deal: update ticker, name, and share count based on exchange ratio
- If mixed: split into cash proceeds and new shares accordingly

## Updating the Performance Tab

### Quarter-over-Quarter Tracking

```
| Period | Start Value | Contributions | Withdrawals | End Value | Return % | S&P 500 % | Difference |
```

### Calculating Returns

**Simple return** (no cash flows during quarter):
```
Return % = (End Value - Start Value) / Start Value * 100
```

**Modified Dietz method** (with cash flows):
```
Return % = (End Value - Start Value - Net Flows) / (Start Value + Weighted Flows) * 100
```

Where Weighted Flows accounts for the timing of contributions and withdrawals within the quarter.

### Benchmark Comparison

Record quarter-end values for your chosen benchmarks:

- S&P 500 (broad US market)
- NASDAQ Composite (tech-heavy)
- Russell 2000 (small cap)
- MSCI EAFE (international developed)
- Bloomberg US Aggregate Bond (fixed income)
- Your custom blended benchmark (if applicable)

Calculate alpha: `Alpha = Portfolio Return - Benchmark Return`

## Updating the Income Tab

### Tracking Quarterly Income

```
| Date | Ticker | Type | Amount Per Share | Shares | Total Amount | Tax Treatment | Account |
```

**Type categories:**
- Qualified Dividend
- Non-Qualified Dividend
- Return of Capital
- Short-Term Capital Gain
- Long-Term Capital Gain
- Interest

### Quarterly Income Summary

At the bottom of each quarter's entries, add a summary row:

```
| Q2 2026 Total | -- | -- | -- | -- | $X,XXX.XX | -- | -- |
```

Track the trailing 12-month income and project forward annual income based on current holdings and most recent distribution rates.

## Updating the Allocation Tab

### Target vs. Actual Allocation

```
| Asset Class | Target % | Current Value | Current % | Difference | Action Needed |
```

**Common asset classes:**
- US Large Cap
- US Mid Cap
- US Small Cap
- International Developed
- Emerging Markets
- US Bonds
- International Bonds
- REITs
- Commodities
- Cash/Money Market

### Rebalancing Decision

Apply a threshold-based approach:

1. Calculate the drift for each asset class: `Drift = Current % - Target %`
2. If any class drifts beyond your threshold (e.g., +/- 5%), flag for rebalancing
3. Prioritize rebalancing using new contributions before selling existing holdings
4. Document the rebalancing plan in the Action Items section

## Updating the Research Tab

### Per-Security Research Entry

```
| Ticker | Last Updated | Thesis | Bull Case | Bear Case | Fair Value Est. | Current Price | Rating | Next Catalyst |
```

### Quarterly Research Refresh

For each holding, update:

1. **Thesis status** - Still intact? Any material changes?
2. **Valuation metrics** - P/E, P/B, PEG, EV/EBITDA from latest earnings
3. **Growth metrics** - Revenue growth, EPS growth, margin trends
4. **Fair value estimate** - Recalculate or note if unchanged
5. **Rating** - Strong Buy / Buy / Hold / Sell / Strong Sell
6. **Next catalyst** - Earnings date, product launch, regulatory decision

### When to Escalate Research

Flag a position for deeper research if any of these apply:
- Stock has declined more than 20% from purchase price
- Original thesis has a material change
- Sector or macro headwinds have emerged
- Position has grown to more than 10% of portfolio
- Management change or accounting concerns

## Updating the Watchlist Tab

### Watchlist Entry Format

```
| Ticker | Name | Sector | Target Entry Price | Current Price | Thesis | Added Date | Priority |
```

### Quarterly Watchlist Maintenance

1. **Remove** any entries you are no longer interested in
2. **Update current prices** for remaining entries
3. **Reassess target entry prices** based on updated fundamentals
4. **Add new ideas** discovered during the quarter
5. **Promote to Holdings** any watchlist items you purchased
6. **Rank by priority** (High / Medium / Low) for next quarter

## Version Control and Archiving

### File Naming Convention

```
Investment_Research_YYYY_QN.xlsx
```

Examples:
- `Investment_Research_2026_Q1.xlsx`
- `Investment_Research_2026_Q2.xlsx`

### Archive Process

```bash
# Create archive directory if it doesn't exist
mkdir -p ~/Documents/Investments/archive

# Copy current spreadsheet to archive with quarter label
cp ~/Documents/Investments/Investment_Research.xlsx \
   ~/Documents/Investments/archive/Investment_Research_2026_Q2.xlsx

# Now update the working copy with new quarter data
```

### Backup Best Practices

- Keep at least 8 quarters (2 years) of archived snapshots
- Store a secondary backup in cloud storage or external drive
- Never edit archived copies; they serve as point-in-time records
