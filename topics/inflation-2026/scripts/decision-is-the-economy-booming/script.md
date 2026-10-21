# Is the Economy Booming, or Just Growing?

Story `decision:is-the-economy-booming` (inflation-2026), revision 4. About 3.2 minutes (453 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 22/22 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

The American economy grew in both quarters of 2026 we have numbers for, and yet by September the average hourly paycheck bought less than it had a year before. [s01 ok] So is this a boom, or are workers going backwards? Which side is right depends on which number you look at.

## Setup

Donald Trump has put one side plainly: "The economy is the greatest economy we've ever had by far." [s04 ok] The other side points at the paycheck, and CBS News put it bluntly: inflation "is really just eating up all of the wage growth that Trump has talked about and then some". [s05 ok]

## Investigation

Start with the boom: how fast is the economy actually growing? Real GDP, the value of everything the country produces after stripping out price rises, grew at an annual rate of 2.5 percent in the first quarter of 2026 and 2.2 percent in the second. [s07 ok] That is solid growth, but Federal Reserve officials put the economy's long-run pace at 2.0 percent a year, so this runs only a little above normal, not the surge the word boom suggests. [s08 ok] What about jobs? The unemployment rate was 4.2 percent in September, and it has stayed between 4.1 and 4.3 percent since March. [s10 ok] At its September press conference, the Federal Reserve's chair said "the unemployment rate is basically running consistent with full employment". [s11 ok] But payrolls barely moved: employers added just 29,000 jobs in September. [s12 ok] And the jobs report itself never defines full employment, so calling this full employment is a judgement, not a measurement. [s13 ok] Now the paycheck, the number most people actually feel. In the year to January 2026, pay beat prices, and average hourly earnings after inflation were up 1.2 percent. [s15 ok] Then prices jumped in the spring, and from April on, real hourly pay was lower than a year earlier in every month. [s16 ok] By September, pay was up 3.0 percent on the year and prices 3.7 percent, leaving real hourly earnings 0.7 percent lower. [s17 ok] Trump's boast that wages are "rising much faster than inflation" matched the year to January; it does not match the year to September. [s18 ok] One limit: these are averages across all employees, so they cannot tell you how the worker in the middle of the pay scale did. [s19 ok]

## Answer

So is the economy booming? By these measures, no: it is growing a little faster than the Fed's long-run pace, with unemployment right at the level Fed officials expect it to settle at, but slow hiring. [s20 ok] Growth and shrinking real pay are not a contradiction: in 2026 they ran side by side, because output, jobs and what a paycheck buys are different measurements. [s22 ok]

## Takeaway

So the next time someone tells you the economy is booming, or that it is broken, ask one question: which number?

## Open issues

- **info** s01 (s01.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s11 (s11.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s15 (s15.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s16 (s16.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s17 (s17.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s17 (s17.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s18 (s18.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s18 (s18.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s01 (factual, verified)

> The American economy grew in both quarters of 2026 we have numbers for, and yet by September the average hourly paycheck bought less than it had a year before.

- **s01.a** [verified] Real GDP increased in the first and second quarters of 2026.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BEA GDP, Q2 2026: Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real gross domestic product (GDP) increased at an annual rate of 2.2 percent in the second quarter of 2026 (April, May, and June), according to the third estimate released today by the U.S. Bureau of Economic Analysis (BEA). In the first quarter, real GDP increased 2.5 percent (revised). The contributors to the increas…
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom.
- **s01.b** [verified] Real average hourly earnings for all employees decreased from September 2025 to September 2026.
  - supported (approved): 1 supporting (1 independent, strongest 0.95). modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS Real Earnings, September 2026 right 0.95, direct `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > From September 2025 to September 2026, real average hourly earnings decreased 0.7 percent, seasonally adjusted. The change in real average hourly earnings combined with a 0.6-percent increase in the average workweek resulted in a 0.1-percent decrease in real average weekly earnings over this period.

### s04 (attributed, verified)

> Donald Trump has put one side plainly: "The economy is the greatest economy we've ever had by far."

- **s04.a** [verified] Trump said the economy is the greatest economy the US has ever had.
  - supported (approved): no direct support, 2 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom.
  - qualifies (uncited): BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom.
  - statement: Inflation higher than expected. CNN rolls tape on Trump's economic promises  `RgB5ZtnCT6Q`
    > The economy is the greatest economy we've ever had by far.
  - quotation: "The economy is the greatest economy we've ever had by far." from `RgB5ZtnCT6Q`

### s05 (attributed, verified)

> The other side points at the paycheck, and CBS News put it bluntly: inflation "is really just eating up all of the wage growth that Trump has talked about and then some".

- **s05.a** [verified] A CBS News report said inflation is eating up all of the wage growth and then some.
  - supported (approved): no direct support, 1 source statement. modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - statement: Trump insists "we're richer now" despite report showing rising inflation  `-Xsv7KBW8-Y`
    > inflation is really just eating up all of the wage growth that Trump has talked about and then some
  - quotation: "is really just eating up all of the wage growth that Trump has talked about and then some" from `-Xsv7KBW8-Y`

### s07 (factual, verified)

> Real GDP, the value of everything the country produces after stripping out price rises, grew at an annual rate of 2.5 percent in the first quarter of 2026 and 2.2 percent in the second.

- **s07.a** [verified] BEA's third estimate: real GDP increased at an annual rate of 2.5% in the first quarter of 2026 (revised) and 2.2% in the second quarter.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BEA GDP, Q2 2026: Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real gross domestic product (GDP) increased at an annual rate of 2.2 percent in the second quarter of 2026 (April, May, and June), according to the third estimate released today by the U.S. Bureau of Economic Analysis (BEA). In the first quarter, real GDP increased 2.5 percent (revised). The contributors to the increas…
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom.

### s08 (factual, verified)

> That is solid growth, but Federal Reserve officials put the economy's long-run pace at 2.0 percent a year, so this runs only a little above normal, not the surge the word boom suggests.

- **s08.a** [verified] In the September 2026 Summary of Economic Projections, the median FOMC participant put longer-run real GDP growth at 2.0%.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: fomc-sep-2026-09-16.txt: FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > Variable | Median 1 | Central Tendency 2 | Range 3 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run Change in real GDP | 2.3 | 2.4 | 2.2 | 2.1 | 2.0 | 2.2–2.4 | 2.2–2.6 | 2.1–2.3 | 2.0–2.2 | 2.0–2.2 | 2.1–2.6 | 2.0–2.9 | 1.8–2.6 | 1.8–2.4 | 1.7–2.5
  - qualifies (uncited): BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom.
- **s08.b** [verified] Real GDP growth of 2.5% and 2.2% in the first half of 2026 ran only slightly above the economy's longer-run trend pace: an expansion rather than a boom.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BEA GDP, Q2 2026: Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom. fomc-sep-2026-09-16.txt: FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real gross domestic product (GDP) increased at an annual rate of 2.2 percent in the second quarter of 2026 (April, May, and June), according to the third estimate released today by the U.S. Bureau of Economic Analysis (BEA). In the first quarter, real GDP increased 2.5 percent (revised). The contributors to the increas…
  - qualifies: fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > Variable | Median 1 | Central Tendency 2 | Range 3 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run Change in real GDP | 2.3 | 2.4 | 2.2 | 2.1 | 2.0 | 2.2–2.4 | 2.2–2.6 | 2.1–2.3 | 2.0–2.2 | 2.0–2.2 | 2.1–2.6 | 2.0–2.9 | 1.8–2.6 | 1.8–2.4 | 1.7–2.5

### s10 (factual, verified)

> The unemployment rate was 4.2 percent in September, and it has stayed between 4.1 and 4.3 percent since March.

- **s10.a** [verified] The unemployment rate was 4.2% in September 2026 and has remained between 4.1% and 4.3% since March.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BLS Employment Situation, September 2026: Unemployment was 4.2% in September 2026 and has stayed in a 4.1-4.3% range since March, near common estimates of the natural rate, but payroll growth was weak (+29,000, 45,000/month average) and the release does not define full employment. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Employment Situation, September 2026 partly 0.6, direct `inflation-2026/sources/bls-employment-situation-2026-09.txt#L14-L27`
    > Both nonfarm payroll employment (+29,000) and the unemployment rate (4.2 percent) changed little in September, the U.S. Bureau of Labor Statistics reported today. Employment in all major industries changed little over the month. This news release presents statistics from two monthly surveys. The household survey measur…
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L21`
    > FOMC participants put the longer-run unemployment rate at a 4.2% median (central tendency 4.0-4.3%), so the 4.1-4.2% rate is at the Fed's own estimate of its sustainable level, though projections are judgments and say nothing about weak payroll growth.

### s11 (attributed, verified)

> At its September press conference, the Federal Reserve's chair said "the unemployment rate is basically running consistent with full employment".

- **s11.a** [verified] The Federal Reserve chair said the unemployment rate is running consistent with full employment.
  - supported (approved): no direct support, 2 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): BLS Employment Situation, September 2026 partly 0.6, direct `inflation-2026/sources/bls-employment-situation-2026-09.txt#L14-L27`
    > Unemployment was 4.2% in September 2026 and has stayed in a 4.1-4.3% range since March, near common estimates of the natural rate, but payroll growth was weak (+29,000, 45,000/month average) and the release does not define full employment.
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L21`
    > FOMC participants put the longer-run unemployment rate at a 4.2% median (central tendency 4.0-4.3%), so the 4.1-4.2% rate is at the Fed's own estimate of its sustainable level, though projections are judgments and say nothing about weak payroll growth.
  - statement: FOMC Press Conference, September 16, 2026  `ELU3u2Ny7r0`
    > the unemployment rate is basically running consistent with full employment
  - quotation: "the unemployment rate is basically running consistent with full employment" from `ELU3u2Ny7r0`

### s12 (factual, verified)

> But payrolls barely moved: employers added just 29,000 jobs in September.

- **s12.a** [verified] Nonfarm payroll employment changed little in September 2026 (+29,000).
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BLS Employment Situation, September 2026: Unemployment was 4.2% in September 2026 and has stayed in a 4.1-4.3% range since March, near common estimates of the natural rate, but payroll growth was weak (+29,000, 45,000/month average) and the release does not define full employment. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Employment Situation, September 2026 partly 0.6, direct `inflation-2026/sources/bls-employment-situation-2026-09.txt#L14-L27`
    > Both nonfarm payroll employment (+29,000) and the unemployment rate (4.2 percent) changed little in September, the U.S. Bureau of Labor Statistics reported today. Employment in all major industries changed little over the month. This news release presents statistics from two monthly surveys. The household survey measur…
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L21`
    > FOMC participants put the longer-run unemployment rate at a 4.2% median (central tendency 4.0-4.3%), so the 4.1-4.2% rate is at the Fed's own estimate of its sustainable level, though projections are judgments and say nothing about weak payroll growth.

### s13 (factual, verified)

> And the jobs report itself never defines full employment, so calling this full employment is a judgement, not a measurement.

- **s13.a** [verified] The September 2026 Employment Situation release does not define full employment.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BLS Employment Situation, September 2026: Unemployment was 4.2% in September 2026 and has stayed in a 4.1-4.3% range since March, near common estimates of the natural rate, but payroll growth was weak (+29,000, 45,000/month average) and the release does not define full employment. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Employment Situation, September 2026 partly 0.6, direct `inflation-2026/sources/bls-employment-situation-2026-09.txt#L14-L27`
    > Both nonfarm payroll employment (+29,000) and the unemployment rate (4.2 percent) changed little in September, the U.S. Bureau of Labor Statistics reported today. Employment in all major industries changed little over the month. This news release presents statistics from two monthly surveys. The household survey measur…
  - qualifies (uncited): fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L21`
    > FOMC participants put the longer-run unemployment rate at a 4.2% median (central tendency 4.0-4.3%), so the 4.1-4.2% rate is at the Fed's own estimate of its sustainable level, though projections are judgments and say nothing about weak payroll growth.

### s15 (factual, verified)

> In the year to January 2026, pay beat prices, and average hourly earnings after inflation were up 1.2 percent.

- **s15.a** [verified] Real average hourly earnings (AHE deflated by CPI-U) rose 1.2% over the year to January 2026, as nominal pay outpaced CPI.
  - supported (approved): 1 supporting (1 independent, strongest 0.95).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS CPI, earnings and jobs series 2019-2026 right 0.95, direct `inflation-2026/sources/bls-cpi-earnings-series-2019-2026.txt#L1434-L1434`
    > 2026-01 11.375 1.2 ( 3.7, 2.4)

### s16 (factual, verified)

> Then prices jumped in the spring, and from April on, real hourly pay was lower than a year earlier in every month.

- **s16.a** [verified] Real average hourly earnings were below their year-earlier level in every month from April to September 2026, while CPI ran 3.3% to 4.2%.
  - supported (approved): 1 supporting (1 independent, strongest 0.9). modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS CPI, earnings and jobs series 2019-2026 right 0.9, direct `inflation-2026/sources/bls-cpi-earnings-series-2019-2026.txt#L1436-L1442`
    > 2026-03 11.308 0.1 ( 3.4, 3.3) 2026-04 11.254 -0.2 ( 3.6, 3.8) 2026-05 11.225 -0.8 ( 3.3, 4.2) 2026-06 11.303 -0.1 ( 3.4, 3.5) 2026-07 11.310 -0.1 ( 3.2, 3.3) 2026-08 11.301 -0.2 ( 3.1, 3.4) 2026-09 11.243 -0.7 ( 3.0, 3.7)

### s17 (factual, verified)

> By September, pay was up 3.0 percent on the year and prices 3.7 percent, leaving real hourly earnings 0.7 percent lower.

- **s17.a** [verified] Over the year to September 2026, nominal average hourly earnings rose 3.0% and CPI rose 3.7%.
  - supported (approved): 1 supporting (1 independent, strongest 0.9).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS CPI, earnings and jobs series 2019-2026 right 0.9, direct `inflation-2026/sources/bls-cpi-earnings-series-2019-2026.txt#L1436-L1442`
    > 2026-03 11.308 0.1 ( 3.4, 3.3) 2026-04 11.254 -0.2 ( 3.6, 3.8) 2026-05 11.225 -0.8 ( 3.3, 4.2) 2026-06 11.303 -0.1 ( 3.4, 3.5) 2026-07 11.310 -0.1 ( 3.2, 3.3) 2026-08 11.301 -0.2 ( 3.1, 3.4) 2026-09 11.243 -0.7 ( 3.0, 3.7)
- **s17.b** [verified] From September 2025 to September 2026, real average hourly earnings for all employees decreased 0.7%, seasonally adjusted.
  - supported (approved): 1 supporting (1 independent, strongest 0.95). modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS Real Earnings, September 2026 right 0.95, direct `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > From September 2025 to September 2026, real average hourly earnings decreased 0.7 percent, seasonally adjusted. The change in real average hourly earnings combined with a 0.6-percent increase in the average workweek resulted in a 0.1-percent decrease in real average weekly earnings over this period.

### s18 (factual, verified)

> Trump's boast that wages are "rising much faster than inflation" matched the year to January; it does not match the year to September.

- **s18.a** [verified] Trump said that wages are rising much faster than inflation.
  - supported (approved): no direct support, 1 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): BLS Real Earnings, September 2026 wrong 0.8, partial `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > Real average hourly earnings for all employees fell 0.7% from September 2025 to September 2026 (nominal pay +3.0% vs CPI +3.7%), so the typical worker's purchasing power declined over the past year rather than rose.
  - statement: Trump tells America the economy is strong, blames Biden for nation's struggles  `67ESj3hDZ9U`
    > for the first time in years, wages are rising much faster than inflation
  - quotation: "rising much faster than inflation" from `67ESj3hDZ9U`
- **s18.b** [verified] Real average hourly earnings rose over the year to January 2026, as nominal pay outpaced CPI.
  - supported (approved): 1 supporting (1 independent, strongest 0.95).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: BLS CPI, earnings and jobs series 2019-2026 right 0.95, direct `inflation-2026/sources/bls-cpi-earnings-series-2019-2026.txt#L1434-L1434`
    > 2026-01 11.375 1.2 ( 3.7, 2.4)
- **s18.c** [verified] Real average hourly earnings for all employees fell over the year to September 2026.
  - qualified (qualify): no direct support, 1 qualifying. modality: universal.
  - warning needs-qualification: BLS Real Earnings, September 2026: Real average hourly earnings for all employees fell 0.7% from September 2025 to September 2026 (nominal pay +3.0% vs CPI +3.7%), so the typical worker's purchasing power declined over the past year rather than rose. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Real Earnings, September 2026 wrong 0.8, partial `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > From September 2025 to September 2026, real average hourly earnings decreased 0.7 percent, seasonally adjusted. The change in real average hourly earnings combined with a 0.6-percent increase in the average workweek resulted in a 0.1-percent decrease in real average weekly earnings over this period.

### s19 (factual, verified)

> One limit: these are averages across all employees, so they cannot tell you how the worker in the middle of the pay scale did.

- **s19.a** [verified] The BLS real earnings figures are average hourly earnings for all employees, not a median.
  - qualified (qualify): no direct support, 1 qualifying. modality: universal.
  - warning needs-qualification: BLS Real Earnings, September 2026: Real average hourly earnings for all employees fell 0.7% from September 2025 to September 2026 (nominal pay +3.0% vs CPI +3.7%), so the typical worker's purchasing power declined over the past year rather than rose. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Real Earnings, September 2026 wrong 0.8, partial `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > From September 2025 to September 2026, real average hourly earnings decreased 0.7 percent, seasonally adjusted. The change in real average hourly earnings combined with a 0.6-percent increase in the average workweek resulted in a 0.1-percent decrease in real average weekly earnings over this period.

### s20 (factual, verified)

> So is the economy booming? By these measures, no: it is growing a little faster than the Fed's long-run pace, with unemployment right at the level Fed officials expect it to settle at, but slow hiring.

- **s20.a** [verified] Real GDP growth in the first half of 2026 ran only slightly above the FOMC's longer-run growth median: an expansion rather than a boom.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BEA GDP, Q2 2026: Real GDP grew at 2.5% and 2.2% annual rates in Q1 and Q2 2026, roughly trend growth, while payrolls averaged +45,000 a month and real hourly earnings fell 0.7% over the year; the economy is growing, but the data describe a solid expansion rather than a boom. fomc-sep-2026-09-16.txt: FOMC participants put longer-run real GDP growth at a 2.0% median (central tendency 2.0-2.2%) and project 2.3% for 2026, so 2026 growth runs only slightly above the economy's trend pace, an expansion rather than a boom. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BEA GDP, Q2 2026 partly 0.6, partial `inflation-2026/sources/bea-gdp-2026-q2.txt#L12-L12`
    > Real gross domestic product (GDP) increased at an annual rate of 2.2 percent in the second quarter of 2026 (April, May, and June), according to the third estimate released today by the U.S. Bureau of Economic Analysis (BEA). In the first quarter, real GDP increased 2.5 percent (revised). The contributors to the increas…
  - qualifies: fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L17`
    > Variable | Median 1 | Central Tendency 2 | Range 3 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run Change in real GDP | 2.3 | 2.4 | 2.2 | 2.1 | 2.0 | 2.2–2.4 | 2.2–2.6 | 2.1–2.3 | 2.0–2.2 | 2.0–2.2 | 2.1–2.6 | 2.0–2.9 | 1.8–2.6 | 1.8–2.4 | 1.7–2.5
- **s20.b** [verified] The September 2026 unemployment rate was at the FOMC participants' median longer-run unemployment rate, while payroll growth was weak.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: BLS Employment Situation, September 2026: Unemployment was 4.2% in September 2026 and has stayed in a 4.1-4.3% range since March, near common estimates of the natural rate, but payroll growth was weak (+29,000, 45,000/month average) and the release does not define full employment. fomc-sep-2026-09-16.txt: FOMC participants put the longer-run unemployment rate at a 4.2% median (central tendency 4.0-4.3%), so the 4.1-4.2% rate is at the Fed's own estimate of its sustainable level, though projections are judgments and say nothing about weak payroll growth. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Employment Situation, September 2026 partly 0.6, direct `inflation-2026/sources/bls-employment-situation-2026-09.txt#L14-L27`
    > Both nonfarm payroll employment (+29,000) and the unemployment rate (4.2 percent) changed little in September, the U.S. Bureau of Labor Statistics reported today. Employment in all major industries changed little over the month. This news release presents statistics from two monthly surveys. The household survey measur…
  - qualifies: fomc-sep-2026-09-16.txt partly 0.55, partial `inflation-2026/sources/fomc-sep-2026-09-16.txt#L13-L21`
    > Variable | Median 1 | Central Tendency 2 | Range 3 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run | 2026 | 2027 | 2028 | 2029 | Longer run Change in real GDP | 2.3 | 2.4 | 2.2 | 2.1 | 2.0 | 2.2–2.4 | 2.2–2.6 | 2.1–2.3 | 2.0–2.2 | 2.0–2.2 | 2.1–2.6 | 2.0–2.9 | 1.8–2.6 | 1.8–2.4 | 1.7–2.5…

### s22 (factual, verified)

> Growth and shrinking real pay are not a contradiction: in 2026 they ran side by side, because output, jobs and what a paycheck buys are different measurements.

- **s22.a** [verified] In 2026 real GDP grew and unemployment stayed low while real hourly earnings fell, so growth and falling purchasing power coexisted; the employment side was steady rather than strong.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: BLS Real Earnings, September 2026: In 2026 real hourly earnings fell 0.7% over the year while real GDP grew 2.5% and 2.2% annualized in Q1 and Q2 and unemployment held at 4.1-4.3%, showing growth and falling purchasing power coexisting; but job gains were weak (+29,000 in September, 45,000/month average), so the employment side was steady rather than strong. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: BLS Real Earnings, September 2026 partly 0.7, partial `inflation-2026/sources/bls-real-earnings-2026-09.txt#L11-L14`
    > From September 2025 to September 2026, real average hourly earnings decreased 0.7 percent, seasonally adjusted. The change in real average hourly earnings combined with a 0.6-percent increase in the average workweek resulted in a 0.1-percent decrease in real average weekly earnings over this period.
