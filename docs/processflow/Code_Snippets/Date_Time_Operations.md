# Date & Time Operations

**TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers date and time manipulation techniques within ProcessFlow code snippets.

## Overview

Date and time operations are essential for scheduling, reporting, data processing, and business logic. These are **idempotent operations** that work with temporal data.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Date/Time      │────▶│  Date Processing │────▶│  Formatted      │
│  Input          │     │  Code Snippet    │     │  Output         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available JavaScript / TypeScript Date APIs

| Category | APIs |
|----------|------|
| **Current** | `Date.now()`, `new Date()`, `tf.utils.nowIso()` |
| **Parse** | `Date.parse()`, `new Date(string)`, `parseTimestamp()` helper below |
| **Format** | `toISOString()`, `toUTCString()`, `Intl.DateTimeFormat` |
| **Create** | `new Date(y, m, d, h, min, s)`, `Date.UTC()` |
| **Calculate** | `setDate()`, `setMonth()`, `setFullYear()`, date arithmetic |
| **Timezone** | `Intl.DateTimeFormat` with `timeZone`, `getTimezoneOffset()` |
| **Validation** | `isNaN(date.getTime())`, component range checks |

**Note:** Unix timestamps in seconds are common in APIs; JavaScript `Date` uses milliseconds. When reading numeric timestamps, treat values `< 1e12` as seconds.

```typescript
function parseTimestamp(input: string | number): number | null {
  if (input === "now") return Date.now();
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    const n = Number(input);
    return n < 1e12 ? n * 1000 : n;
  }
  const ms = Date.parse(String(input));
  return Number.isNaN(ms) ? null : ms;
}

function formatYmdHms(ms: number, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date(ms))
    .replace(" ", "T")
    .replace("T", " ");
}
```

---

## Example 1: Date Formatting

Format dates in various formats:

```typescript
const input = process_input.result?.date ?? "now";
const outputFormat = String(process_input.result?.format ?? "Y-m-d H:i:s");
const timezone = String(process_input.result?.timezone ?? "UTC");

const ms = parseTimestamp(input);
if (ms === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: `Invalid date input: ${input}` }, data: null };
}

const d = new Date(ms);
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...opts }).format(d);

const formatted = {
  input,
  timestamp: Math.floor(ms / 1000),
  custom: formatYmdHms(ms, timezone),
  iso8601: d.toISOString(),
  rfc2822: d.toUTCString(),
  date_only: new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d),
  time_only: fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
  human_readable: fmt({
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }),
  day_of_week: fmt({ weekday: "long" }),
  week_number: fmt({ week: "isoWeek" }),
  day_of_year: String(
    Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000)
  ),
  timezone,
};

return { success: true, data: formatted };
```

---

## Example 2: Date Parsing

Parse dates from various formats:

```typescript
const dateString = String(process_input.result?.date_string ?? "");
const expectedFormat = process_input.result?.expected_format as string | undefined;

if (!dateString) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No date string provided" }, data: null };
}

const result: Record<string, unknown> = {
  input: dateString,
  parsed: false,
  timestamp: null,
  components: null,
};

// Try ISO / native parse first
let ms = Date.parse(dateString);
if (!Number.isNaN(ms)) {
  result.timestamp = Math.floor(ms / 1000);
  const d = new Date(ms);
  result.components = {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
  result.parsed = true;
}

// Optional: strict format match (e.g. "YYYY-MM-DD")
if (!result.parsed && expectedFormat === "Y-m-d") {
  const m = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) {
      ms = d.getTime();
      result.timestamp = Math.floor(ms / 1000);
      result.components = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
      result.parsed = true;
    }
  }
}

if (result.parsed && typeof result.timestamp === "number") {
  const ts = result.timestamp * 1000;
  result.formatted = {
    iso: new Date(ts).toISOString(),
    date: new Intl.DateTimeFormat("en-CA").format(new Date(ts)),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ts)),
    readable: new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(ts)),
  };
}

return {
  success: Boolean(result.parsed),
  data: result,
  error: result.parsed ? undefined : `Could not parse date: ${dateString}`,
};
```

---

## Example 3: Date Arithmetic

Add or subtract time from dates:

```typescript
const baseDate = process_input.result?.date ?? "now";
const operation = String(process_input.result?.operation ?? "add");
const amount = Number(process_input.result?.amount ?? 1);
const unit = String(process_input.result?.unit ?? "days");

const baseMs = parseTimestamp(baseDate as string | number);
if (baseMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid base date" }, data: null };
}

const d = new Date(baseMs);
const sign = operation === "subtract" ? -1 : 1;
const delta = sign * amount;

switch (unit) {
  case "seconds":
    d.setSeconds(d.getSeconds() + delta);
    break;
  case "minutes":
    d.setMinutes(d.getMinutes() + delta);
    break;
  case "hours":
    d.setHours(d.getHours() + delta);
    break;
  case "weeks":
    d.setDate(d.getDate() + delta * 7);
    break;
  case "months":
    d.setMonth(d.getMonth() + delta);
    break;
  case "years":
    d.setFullYear(d.getFullYear() + delta);
    break;
  default:
    d.setDate(d.getDate() + delta); // days
}

const newMs = d.getTime();
const diffSeconds = Math.abs(Math.floor((newMs - baseMs) / 1000));
const diffDays = Math.floor(diffSeconds / 86400);

return {
  success: true,
  data: {
    original: {
      timestamp: Math.floor(baseMs / 1000),
      formatted: formatYmdHms(baseMs),
    },
    operation,
    amount,
    unit,
    result: {
      timestamp: Math.floor(newMs / 1000),
      formatted: formatYmdHms(newMs),
      iso: new Date(newMs).toISOString(),
    },
    difference: { seconds: diffSeconds, days: diffDays },
  },
};
```

---

## Example 4: Date Difference Calculation

Calculate the difference between two dates:

```typescript
const startDate = process_input.result?.start_date ?? "";
const endDate = process_input.result?.end_date ?? "now";

let startMs = parseTimestamp(startDate as string | number);
let endMs = parseTimestamp(endDate as string | number);

if (startMs === null || endMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date(s) provided" }, data: null };
}

let isReversed = startMs > endMs;
if (isReversed) {
  [startMs, endMs] = [endMs, startMs];
}

const diffSeconds = Math.floor((endMs - startMs) / 1000);
const diffMinutes = Math.floor(diffSeconds / 60);
const diffHours = Math.floor(diffSeconds / 3600);
const diffDays = Math.floor(diffSeconds / 86400);
const diffWeeks = Math.floor(diffDays / 7);
const diffMonths = Math.floor(diffDays / 30.44);
const diffYears = Math.floor(diffDays / 365.25);

let remaining = diffSeconds;
const years = Math.floor(remaining / 31536000);
remaining %= 31536000;
const months = Math.floor(remaining / 2628000);
remaining %= 2628000;
const days = Math.floor(remaining / 86400);
remaining %= 86400;
const hours = Math.floor(remaining / 3600);
remaining %= 3600;
const minutes = Math.floor(remaining / 60);
const seconds = remaining % 60;

return {
  success: true,
  data: {
    start: formatYmdHms(startMs),
    end: formatYmdHms(endMs),
    is_reversed: isReversed,
    total: {
      seconds: diffSeconds,
      minutes: diffMinutes,
      hours: diffHours,
      days: diffDays,
      weeks: diffWeeks,
      months: diffMonths,
      years: diffYears,
    },
    breakdown: { years, months, days, hours, minutes, seconds },
    human_readable: `${years} years, ${months} months, ${days} days, ${hours} hours, ${minutes} minutes`,
  },
};
```

---

## Example 5: Timezone Conversion

Convert dates between timezones:

```typescript
const dateTime = process_input.result?.datetime ?? "now";
const fromTimezone = String(process_input.result?.from_timezone ?? "UTC");
const toTimezone = String(process_input.result?.to_timezone ?? "Europe/Helsinki");

const ms = parseTimestamp(dateTime as string | number);
if (ms === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid datetime" }, data: null };
}

const d = new Date(ms);
const fmtTz = (tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    hour12: false,
  }).format(d);

const offsetFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: toTimezone,
  timeZoneName: "longOffset",
}).formatToParts(d);
const targetOffset =
  offsetFmt.find((p) => p.type === "timeZoneName")?.value ?? "";

return {
  success: true,
  data: {
    input: dateTime,
    source: { timezone: fromTimezone, formatted: fmtTz(fromTimezone) },
    target: {
      timezone: toTimezone,
      formatted: fmtTz(toTimezone),
      offset: targetOffset,
    },
    utc: `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`,
    timestamp: Math.floor(ms / 1000),
  },
};
```

---

## Example 6: Business Days Calculation

Calculate business days excluding weekends:

```typescript
const startDate = process_input.result?.start_date ?? "now";
const days = Number(process_input.result?.business_days ?? 5);
const excludeWeekends = process_input.result?.exclude_weekends !== false;
const holidays = (process_input.result?.holidays ?? []) as string[];

let currentMs = parseTimestamp(startDate as string | number);
if (currentMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid start date" }, data: null };
}

let businessDaysAdded = 0;
let totalDays = 0;
const skippedDays: Array<{ date: string; reason: string; day: string }> = [];

while (businessDaysAdded < days) {
  const d = new Date(currentMs);
  d.setDate(d.getDate() + 1);
  currentMs = d.getTime();
  totalDays++;

  const dayOfWeek = d.getDay(); // 0=Sunday, 6=Saturday
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const dateString = new Intl.DateTimeFormat("en-CA").format(d);
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(dateString);

  if (excludeWeekends && isWeekend) {
    skippedDays.push({ date: dateString, reason: "weekend", day: dayName });
    continue;
  }
  if (isHoliday) {
    skippedDays.push({ date: dateString, reason: "holiday", day: dayName });
    continue;
  }
  businessDaysAdded++;
}

const resultDate = new Date(currentMs);

return {
  success: true,
  data: {
    start_date: new Intl.DateTimeFormat("en-CA").format(new Date(parseTimestamp(startDate as string | number)!)),
    business_days_requested: days,
    result_date: new Intl.DateTimeFormat("en-CA").format(resultDate),
    result_day: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(resultDate),
    total_calendar_days: totalDays,
    skipped_days_count: skippedDays.length,
    skipped_days: skippedDays,
  },
};
```

---

## Example 7: Date Range Generation

Generate a range of dates:

```typescript
const startDate = process_input.result?.start_date ?? "now";
const endDate = process_input.result?.end_date ?? "+7 days";
const interval = String(process_input.result?.interval ?? "1 day");
const format = String(process_input.result?.format ?? "Y-m-d");

let startMs = parseTimestamp(startDate as string | number);
let endMs = parseTimestamp(endDate as string | number);

// Relative end like "+7 days"
if (endMs === null && typeof endDate === "string" && endDate.startsWith("+")) {
  const m = endDate.match(/^\+(\d+)\s+(\w+)/);
  if (m && startMs !== null) {
    const d = new Date(startMs);
    const n = Number(m[1]);
    if (m[2].startsWith("day")) d.setDate(d.getDate() + n);
    else if (m[2].startsWith("week")) d.setDate(d.getDate() + n * 7);
    else if (m[2].startsWith("month")) d.setMonth(d.getMonth() + n);
    endMs = d.getTime();
  }
}

if (startMs === null || endMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date(s)" }, data: null };
}

if (startMs > endMs) {
  [startMs, endMs] = [endMs, startMs];
}

const dates: Array<Record<string, unknown>> = [];
let currentMs = startMs;
const maxIterations = 1000;
let iteration = 0;

const intervalMatch = interval.match(/^(\d+)\s+(\w+)/);
const step = intervalMatch ? Number(intervalMatch[1]) : 1;
const stepUnit = intervalMatch?.[2] ?? "day";

while (currentMs <= endMs && iteration < maxIterations) {
  const d = new Date(currentMs);
  const dow = d.getDay();
  dates.push({
    date: new Intl.DateTimeFormat("en-CA").format(d),
    timestamp: Math.floor(currentMs / 1000),
    day_of_week: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d),
    week_number: new Intl.DateTimeFormat("en-US", { week: "isoWeek" }).format(d),
    is_weekend: dow === 0 || dow === 6,
  });

  const next = new Date(currentMs);
  if (stepUnit.startsWith("week")) next.setDate(next.getDate() + step * 7);
  else if (stepUnit.startsWith("month")) next.setMonth(next.getMonth() + step);
  else next.setDate(next.getDate() + step);
  currentMs = next.getTime();
  iteration++;
}

return {
  success: true,
  data: {
    start: new Intl.DateTimeFormat("en-CA").format(new Date(startMs)),
    end: new Intl.DateTimeFormat("en-CA").format(new Date(endMs)),
    interval,
    count: dates.length,
    dates,
  },
};
```

---

## Example 8: Relative Date Descriptions

Convert dates to human-readable relative descriptions:

```typescript
const dateTime = process_input.result?.datetime ?? "now";
const referenceTime = process_input.result?.reference ?? "now";

const ms = parseTimestamp(dateTime as string | number);
const refMs = parseTimestamp(referenceTime as string | number);

if (ms === null || refMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date(s)" }, data: null };
}

const diff = Math.floor((ms - refMs) / 1000);
const absDiff = Math.abs(diff);
const isPast = diff < 0;

const intervals: [number, string][] = [
  [31536000, "year"],
  [2592000, "month"],
  [604800, "week"],
  [86400, "day"],
  [3600, "hour"],
  [60, "minute"],
  [1, "second"],
];

let relativeText = "just now";
for (const [seconds, unit] of intervals) {
  const value = Math.floor(absDiff / seconds);
  if (value >= 1) {
    const plural = value > 1 ? "s" : "";
    relativeText = isPast
      ? `${value} ${unit}${plural} ago`
      : `in ${value} ${unit}${plural}`;
    break;
  }
}

const dateKey = (t: number) => new Intl.DateTimeFormat("en-CA").format(new Date(t));
const timeKey = (t: number) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(t)
  );

if (absDiff < 60) {
  relativeText = isPast ? "just now" : "in a moment";
} else if (dateKey(ms) === dateKey(refMs)) {
  relativeText = `today at ${timeKey(ms)}`;
} else {
  const yesterday = new Date(refMs);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(refMs);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(ms) === dateKey(yesterday.getTime())) {
    relativeText = `yesterday at ${timeKey(ms)}`;
  } else if (dateKey(ms) === dateKey(tomorrow.getTime())) {
    relativeText = `tomorrow at ${timeKey(ms)}`;
  }
}

return {
  success: true,
  data: {
    datetime: formatYmdHms(ms),
    reference: formatYmdHms(refMs),
    relative: relativeText,
    is_past: isPast,
    difference_seconds: diff,
  },
};
```

---

## Example 9: Schedule/Cron Time Checking

Check if current time matches a schedule:

```typescript
/**
 * Check if current time matches a simple schedule pattern
 * Pattern format: "HH:MM" or "weekday HH:MM" or "day-of-month HH:MM"
 */

const schedule = String(process_input.result?.schedule ?? "09:00");
const checkTime = process_input.result?.check_time ?? "now";
const toleranceMinutes = Number(process_input.result?.tolerance_minutes ?? 5);

const checkMs = parseTimestamp(checkTime as string | number);
if (checkMs === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid check time" }, data: null };
}

const d = new Date(checkMs);
const currentHour = d.getHours();
const currentMinute = d.getMinutes();
const currentDayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "long" })
  .format(d)
  .toLowerCase();
const currentDayOfMonth = d.getDate();

const parts = schedule.trim().split(/\s+/);
let matches = false;
let matchReason = "";

if (parts.length === 1) {
  const timeParts = parts[0].split(":");
  const schedHour = Number(timeParts[0]);
  const schedMinute = Number(timeParts[1] ?? 0);
  const diffMinutes = Math.abs(
    currentHour * 60 + currentMinute - (schedHour * 60 + schedMinute)
  );
  matches = diffMinutes <= toleranceMinutes;
  matchReason = matches ? "Time matches" : "Time does not match";
} else if (parts.length === 2) {
  const dayPart = parts[0].toLowerCase();
  const timeParts = parts[1].split(":");
  const schedHour = Number(timeParts[0]);
  const schedMinute = Number(timeParts[1] ?? 0);

  const dayMatches = /^\d+$/.test(dayPart)
    ? Number(dayPart) === currentDayOfMonth
    : dayPart === currentDayOfWeek;

  const diffMinutes = Math.abs(
    currentHour * 60 + currentMinute - (schedHour * 60 + schedMinute)
  );
  const timeMatches = diffMinutes <= toleranceMinutes;
  matches = dayMatches && timeMatches;
  matchReason = dayMatches
    ? timeMatches
      ? "Day and time match"
      : "Day matches but time does not"
    : "Day does not match";
}

return {
  success: true,
  data: {
    schedule,
    check_time: formatYmdHms(checkMs),
    matches,
    reason: matchReason,
    current: {
      day_of_week: currentDayOfWeek,
      day_of_month: currentDayOfMonth,
      time: `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`,
    },
    tolerance_minutes: toleranceMinutes,
  },
};
```

---

## Example 10: Fiscal Period Calculation

Determine fiscal year, quarter, and period:

```typescript
const date = process_input.result?.date ?? "now";
const fiscalYearStart = Number(process_input.result?.fiscal_year_start ?? 1);

const ms = parseTimestamp(date as string | number);
if (ms === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date" }, data: null };
}

const d = new Date(ms);
const year = d.getFullYear();
const month = d.getMonth() + 1;
const day = d.getDate();

let fiscalYear = year;
if (month < fiscalYearStart) fiscalYear = year - 1;

let fiscalMonth = month - fiscalYearStart + 1;
if (fiscalMonth <= 0) fiscalMonth += 12;

const fiscalQuarter = Math.ceil(fiscalMonth / 3);
const fiscalHalf = fiscalMonth <= 6 ? 1 : 2;

const fiscalYearStartDate = new Date(fiscalYear, fiscalYearStart - 1, 1);
const fiscalYearEndDate = new Date(fiscalYear + 1, fiscalYearStart - 1, 0);
const daysInFiscalYear =
  Math.floor((fiscalYearEndDate.getTime() - fiscalYearStartDate.getTime()) / 86400000) + 1;
const daysElapsed =
  Math.floor((ms - fiscalYearStartDate.getTime()) / 86400000) + 1;
const yearProgress = Math.round((daysElapsed / daysInFiscalYear) * 10000) / 100;

return {
  success: true,
  data: {
    date: new Intl.DateTimeFormat("en-CA").format(d),
    calendar: { year, month, quarter: Math.ceil(month / 3) },
    fiscal: {
      year: fiscalYear,
      year_label: `FY${fiscalYear}`,
      month: fiscalMonth,
      quarter: fiscalQuarter,
      quarter_label: `Q${fiscalQuarter}`,
      half: fiscalHalf,
      half_label: `H${fiscalHalf}`,
    },
    progress: {
      days_elapsed: daysElapsed,
      days_total: daysInFiscalYear,
      percent_complete: yearProgress,
    },
    fiscal_year_config: {
      start_month: fiscalYearStart,
      start_date: new Intl.DateTimeFormat("en-CA").format(fiscalYearStartDate),
      end_date: new Intl.DateTimeFormat("en-CA").format(fiscalYearEndDate),
    },
  },
};
```

---

## Best Practices

### 1. Always Validate Date Inputs
```typescript
const ms = parseTimestamp(input);
if (ms === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date" }, data: null };
}
```

### 2. Be Explicit About Timezones
```typescript
const data = {
  timestamp: Date.now(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
```

### 3. Use ISO 8601 for Data Exchange
```typescript
const iso = new Date(ms).toISOString(); // 2024-12-18T19:30:00.000Z
```

### 4. Handle Edge Cases
```typescript
const d = new Date(year, month - 1, day);
if (d.getMonth() !== month - 1 || d.getDate() !== day) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date" }, data: null };
}
```

---

## Common Formats Reference

| Format | Example | TypeScript |
|--------|---------|------------|
| ISO 8601 | 2024-12-18T19:30:00+00:00 | `new Date().toISOString()` |
| RFC 2822 | Wed, 18 Dec 2024 19:30:00 GMT | `new Date().toUTCString()` |
| MySQL | 2024-12-18 19:30:00 | `formatYmdHms(Date.now())` |
| Date only | 2024-12-18 | `new Intl.DateTimeFormat('en-CA').format(d)` |
| Time only | 19:30:00 | `Intl.DateTimeFormat` with `hour`, `minute`, `second` |
| Human | December 18, 2024 | `Intl.DateTimeFormat` with `month: 'long'` |

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [Mathematical & Statistical Calculations](Math_Statistics.md)
- [Conditional Logic & Routing](Conditional_Logic_Routing.md)
