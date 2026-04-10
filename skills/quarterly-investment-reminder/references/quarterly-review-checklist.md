# Quarterly Review Checklist — Top 20 Investors Tracker

Checklist of data points the program asks Claude to research and update each quarter for the Top 20 Investors Tracker spreadsheet.

## The Top 20 Investors

The default investor list tracked by the program:

| # | Investor | Firm |
|---|----------|------|
| 1 | Warren Buffett | Berkshire Hathaway |
| 2 | Ray Dalio | Bridgewater Associates |
| 3 | Cathie Wood | ARK Invest |
| 4 | Michael Burry | Scion Asset Management |
| 5 | Bill Ackman | Pershing Square Capital |
| 6 | David Tepper | Appaloosa Management |
| 7 | Carl Icahn | Icahn Enterprises |
| 8 | Seth Klarman | Baupost Group |
| 9 | Howard Marks | Oaktree Capital |
| 10 | Stanley Druckenmiller | Duquesne Family Office |
| 11 | George Soros | Soros Fund Management |
| 12 | Dan Loeb | Third Point |
| 13 | Paul Singer | Elliott Management |
| 14 | Nelson Peltz | Trian Fund Management |
| 15 | Jeff Ubben | Inclusive Capital Partners |
| 16 | Chase Coleman | Tiger Global Management |
| 17 | Philippe Laffont | Coatue Management |
| 18 | Terry Smith | Fundsmith |
| 19 | Li Lu | Himalaya Capital |
| 20 | Joel Greenblatt | Gotham Asset Management |

## Data Points Collected Per Investor

Each quarterly update asks Claude to research and return:

### 1. Assets Under Management (AUM)

- Latest publicly reported or estimated AUM
- Source: fund annual reports, news, regulatory filings
- Flag if the figure is estimated vs. confirmed

### 2. Top Holdings and Quarterly Changes

- Top 3-5 holdings by portfolio weight
- Indicate if position size increased, decreased, or was unchanged
- Source: SEC 13F filings (filed ~45 days after quarter end)

### 3. New Positions

- Any significant new positions opened during the quarter
- Include approximate position size if disclosed
- Source: 13F filings, 13D/13G filings for activist stakes

### 4. Exited Positions

- Any significant positions fully closed during the quarter
- Note if the exit was gradual (trimming over quarters) or sudden
- Source: 13F filings, news reports

### 5. Sector Shifts

- Notable changes in sector allocation or investment themes
- Examples: rotating from tech to energy, increasing cash position
- Source: 13F sector breakdown, investor letters

### 6. Quarterly Commentary

- Key public statements, shareholder letters, or interviews
- Conference appearances and notable quotes
- Source: Berkshire letters, fund quarterly letters, CNBC/Bloomberg interviews

### 7. Estimated Performance

- Quarterly fund return if publicly reported or reliably estimated
- Note whether the figure is official (audited) or press-estimated
- Source: fund letters, HFR/Preqin databases, financial press

## Data Sources for Verification

Claude should reference these sources when compiling the update:

| Source | What It Provides | Timing |
|--------|-----------------|--------|
| SEC EDGAR 13F filings | Holdings of institutional managers with >$100M AUM | ~45 days after quarter end |
| SEC 13D/13G filings | Activist stakes (>5% ownership) | Within 10 days of crossing threshold |
| Investor quarterly letters | Commentary, performance, outlook | Varies (30-90 days after quarter) |
| WhaleWisdom | Aggregated 13F data and historical tracking | After 13F deadline |
| Dataroma | Superinvestor portfolio tracking | After 13F deadline |
| Financial press (Bloomberg, Reuters) | Performance estimates, news, interviews | Ongoing |

## Quarterly Filing Calendar

Understanding when data becomes available helps set expectations:

| Quarter End | 13F Deadline | Typical Letter Release | Best Time to Run Update |
|-------------|-------------|----------------------|------------------------|
| March 31 | May 15 | April - June | June 1 |
| June 30 | August 14 | July - September | September 1 |
| September 30 | November 14 | October - December | December 1 |
| December 31 | February 14 | January - March | March 1 |

**Note:** The program's default cron runs on the 1st of Jan/Apr/Jul/Oct, which is the start of the new quarter. At that point, the previous quarter's 13F data may not yet be filed. Consider adjusting the cron to run ~45-60 days after quarter end (mid-February, mid-May, mid-August, mid-November) for the most complete data.

## Customizing the Investor List

To track different investors, modify the `PROMPT` variable in either script. Replace the investor names in the parenthetical list. The rest of the column structure remains the same.
