# Analytics Methodology

This document explains how the analytics dashboard calculates each section.

## Descriptive Analytics

- Counts the appointments that fall within the selected range.
- Uses actual appointment records from the database.
- Breakdowns are based on:
  - service type
  - day of month / week / year
  - appointment status
  - peak hour

## Diagnostic Analytics

- Builds a day-of-week distribution for the selected date range.
- Also computes a service-vs-day correlation to show which services are most common on which weekdays.
- These are based on real appointment timestamps and are intended to help staffing and scheduling decisions.

## Predictive Analytics

- Only available for monthly analysis.
- It uses the selected month as the reference period and looks at recent appointment counts from up to the previous three months.
- The forecast is a conservative rolling average rather than exponential or compounded growth.
- This avoids unrealistic projections like very large client counts caused by unstable growth formulas.

### How the forecast is computed

1. Collect appointment counts for the previous months in the dataset.
2. Include the current selected month count.
3. Use the average of the most recent three months of data.
4. Project next-month demand from that average.

## Prescriptive Analytics

- Provides suggested actions based on low-volume and high-volume days.
- Uses the same appointment counts and day-of-week breakdowns.
- This is a qualitative guidance layer, not a precise operational plan.
