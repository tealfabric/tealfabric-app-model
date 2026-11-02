# Mathematical & Statistical Calculations

This guide covers mathematical and statistical operations within ProcessFlow code snippets. **TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

The step contract uses **`process_input`** for data from the previous step ([interface v1](../interface/v1/variables.md)). In the examples below, local variables read from `process_input.result` where the step receives a nested payload.

## Overview

Mathematical operations are essential for financial calculations, analytics, reporting, and data analysis. These are **idempotent operations** that produce deterministic results.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Numeric Data   │────▶│  Math/Stats      │────▶│  Calculated     │
│  Input          │     │  Code Snippet    │     │  Results        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available JavaScript Math APIs

| Category | APIs |
|----------|------|
| **Basic** | `Math.abs`, `Math.max`, `Math.min`, `Math.round`, `Math.floor`, `Math.ceil` |
| **Power** | `Math.pow`, `Math.sqrt`, `Math.exp`, `Math.log`, `Math.log10` |
| **Trigonometry** | `Math.sin`, `Math.cos`, `Math.tan`, `Math.asin`, `Math.acos`, `Math.atan` |
| **Random** | `Math.random` (⚠️ use sparingly — not idempotent) |
| **Array** | `reduce`, `filter`, `map`, `length` |
| **Formatting** | `toFixed`, `toLocaleString`, template literals |

---

## Example 1: Basic Statistics

Calculate mean, median, mode, and standard deviation:

```typescript
const rawValues = process_input.result?.values ?? [];

if (!Array.isArray(rawValues) || rawValues.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No numeric values provided" }, data: null };
}

const numbers = rawValues
  .filter((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))))
  .map((v) => Number(v));

if (numbers.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No valid numeric values" }, data: null };
}

const count = numbers.length;
const sum = numbers.reduce((a, b) => a + b, 0);
const mean = sum / count;

const sorted = [...numbers].sort((a, b) => a - b);
const middle = Math.floor(count / 2);
const median =
  count % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];

const frequency = new Map<string, number>();
for (const n of numbers) {
  const key = String(n);
  frequency.set(key, (frequency.get(key) ?? 0) + 1);
}
const maxFreq = Math.max(...frequency.values());
const modes = [...frequency.entries()]
  .filter(([, f]) => f === maxFreq)
  .map(([k]) => Number(k));

const squaredDiffs = numbers.map((x) => Math.pow(x - mean, 2));
const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
const stdDev = Math.sqrt(variance);

const min = Math.min(...numbers);
const max = Math.max(...numbers);
const range = max - min;

return {
  success: true,
  data: {
    count,
    sum: Number(sum.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    mode: modes,
    mode_frequency: maxFreq,
    variance: Number(variance.toFixed(4)),
    std_deviation: Number(stdDev.toFixed(4)),
    min,
    max,
    range,
  },
};
```

---

## Example 2: Percentile Calculation

Calculate percentiles and quartiles:

```typescript
const rawValues = process_input.result?.values ?? [];
const percentiles = (process_input.result?.percentiles ?? [25, 50, 75, 90, 95, 99]) as number[];

const numbers = rawValues
  .filter((v) => typeof v === "number" || !Number.isNaN(Number(v)))
  .map((v) => Number(v))
  .sort((a, b) => a - b);

const count = numbers.length;
if (count === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No numeric values" }, data: null };
}

function calcPercentile(data: number[], percentile: number): number {
  const n = data.length;
  const index = (percentile / 100) * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return data[lower];
  }

  const fraction = index - lower;
  return data[lower] + (data[upper] - data[lower]) * fraction;
}

const results: Record<string, number> = {};
for (const p of percentiles) {
  results[`p${p}`] = Number(calcPercentile(numbers, p).toFixed(4));
}

const q1 = calcPercentile(numbers, 25);
const q2 = calcPercentile(numbers, 50);
const q3 = calcPercentile(numbers, 75);
const iqr = q3 - q1;

const lowerBound = q1 - 1.5 * iqr;
const upperBound = q3 + 1.5 * iqr;
const outliers = numbers.filter((x) => x < lowerBound || x > upperBound);

return {
  success: true,
  data: {
    count,
    percentiles: results,
    quartiles: {
      q1: Number(q1.toFixed(4)),
      q2_median: Number(q2.toFixed(4)),
      q3: Number(q3.toFixed(4)),
      iqr: Number(iqr.toFixed(4)),
    },
    outlier_detection: {
      lower_bound: Number(lowerBound.toFixed(4)),
      upper_bound: Number(upperBound.toFixed(4)),
      outliers,
      outlier_count: outliers.length,
    },
  },
};
```

---

## Example 3: Financial Calculations

Common financial calculations:

```typescript
const input = process_input.result ?? {};
const calculation = String(input.calculation ?? "compound_interest");

let result: Record<string, unknown>;

switch (calculation) {
  case "compound_interest": {
    const principal = Number(input.principal ?? 0);
    const rate = Number(input.annual_rate ?? 0) / 100;
    const compounds = Number(input.compounds_per_year ?? 12);
    const years = Number(input.years ?? 1);

    const amount = principal * Math.pow(1 + rate / compounds, compounds * years);
    const interest = amount - principal;

    result = {
      principal,
      annual_rate: rate * 100,
      compounds_per_year: compounds,
      years,
      final_amount: Number(amount.toFixed(2)),
      total_interest: Number(interest.toFixed(2)),
      effective_rate: Number((Math.pow(1 + rate / compounds, compounds) - 1) * 100).toFixed(4),
    };
    break;
  }

  case "loan_payment": {
    const principal = Number(input.principal ?? 0);
    const annualRate = Number(input.annual_rate ?? 0) / 100;
    const monthlyRate = annualRate / 12;
    const months = Number(input.months ?? 12);

    let payment: number;
    if (monthlyRate > 0) {
      payment =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
        (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      payment = principal / months;
    }

    const totalPayment = payment * months;
    const totalInterest = totalPayment - principal;

    result = {
      principal,
      annual_rate: annualRate * 100,
      term_months: months,
      monthly_payment: Number(payment.toFixed(2)),
      total_payment: Number(totalPayment.toFixed(2)),
      total_interest: Number(totalInterest.toFixed(2)),
    };
    break;
  }

  case "roi": {
    const gain = Number(input.gain ?? 0);
    const cost = Number(input.cost ?? 0);

    if (cost === 0) {
      return { success: false, error: { code: "BUSINESS_RULE_ERROR", message: "Cost cannot be zero" }, data: null };
    }

    const roi = ((gain - cost) / cost) * 100;

    result = {
      gain,
      cost,
      profit: gain - cost,
      roi_percent: Number(roi.toFixed(2)),
    };
    break;
  }

  case "present_value": {
    const futureValue = Number(input.future_value ?? 0);
    const rate = Number(input.discount_rate ?? 0) / 100;
    const periods = Number(input.periods ?? 1);

    const presentValue = futureValue / Math.pow(1 + rate, periods);

    result = {
      future_value: futureValue,
      discount_rate: rate * 100,
      periods,
      present_value: Number(presentValue.toFixed(2)),
    };
    break;
  }

  default:
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Unknown calculation type" }, data: null };
}

return {
  success: true,
  data: { calculation, result },
};
```

---

## Example 4: Percentage Calculations

Various percentage operations:

```typescript
const input = process_input.result ?? {};
const operations: Record<string, unknown> = {};

if (input.value !== undefined && input.percent !== undefined) {
  const value = Number(input.value);
  const percent = Number(input.percent);
  operations.percent_of_value = {
    value,
    percent,
    result: Number(((value * percent) / 100).toFixed(4)),
  };
}

if (input.part !== undefined && input.whole !== undefined) {
  const part = Number(input.part);
  const whole = Number(input.whole);
  if (whole !== 0) {
    operations.part_of_whole = {
      part,
      whole,
      percent: Number(((part / whole) * 100).toFixed(2)),
    };
  }
}

if (input.old_value !== undefined && input.new_value !== undefined) {
  const oldValue = Number(input.old_value);
  const newValue = Number(input.new_value);
  if (oldValue !== 0) {
    const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
    operations.percentage_change = {
      old_value: oldValue,
      new_value: newValue,
      absolute_change: newValue - oldValue,
      percent_change: Number(change.toFixed(2)),
      direction: change >= 0 ? "increase" : "decrease",
    };
  }
}

if (input.cost !== undefined && input.price !== undefined) {
  const cost = Number(input.cost);
  const price = Number(input.price);

  if (cost > 0 && price > 0) {
    const markup = ((price - cost) / cost) * 100;
    const margin = ((price - cost) / price) * 100;

    operations.pricing = {
      cost,
      price,
      profit: price - cost,
      markup_percent: Number(markup.toFixed(2)),
      margin_percent: Number(margin.toFixed(2)),
    };
  }
}

return { success: true, data: operations };
```

---

## Example 5: Running Totals and Moving Averages

Calculate running statistics:

```typescript
const rawValues = process_input.result?.values ?? [];
const windowSize = Number(process_input.result?.window_size ?? 3);

if (!Array.isArray(rawValues) || rawValues.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No values provided" }, data: null };
}

const numbers = rawValues
  .filter((v) => !Number.isNaN(Number(v)))
  .map((v) => Number(v));
const count = numbers.length;

const runningTotals: Array<Record<string, number>> = [];
let runningTotal = 0;

for (let i = 0; i < count; i++) {
  runningTotal += numbers[i];
  runningTotals.push({
    index: i,
    value: numbers[i],
    running_total: Number(runningTotal.toFixed(4)),
    running_average: Number((runningTotal / (i + 1)).toFixed(4)),
  });
}

const sma: (number | null)[] = [];
for (let i = 0; i < count; i++) {
  if (i < windowSize - 1) {
    sma.push(null);
  } else {
    const window = numbers.slice(i - windowSize + 1, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / windowSize;
    sma.push(Number(avg.toFixed(4)));
  }
}

const multiplier = 2 / (windowSize + 1);
const ema: number[] = [numbers[0]];

for (let i = 1; i < count; i++) {
  ema[i] = Number(
    (numbers[i] * multiplier + ema[i - 1] * (1 - multiplier)).toFixed(4)
  );
}

return {
  success: true,
  data: {
    input_count: count,
    window_size: windowSize,
    final_total: runningTotal,
    final_average: Number((runningTotal / count).toFixed(4)),
    running_totals: runningTotals,
    moving_averages: { sma, ema },
  },
};
```

---

## Example 6: Distribution Analysis

Analyze data distribution:

```typescript
const rawValues = process_input.result?.values ?? [];
const bins = Number(process_input.result?.bins ?? 10);

const numbers = rawValues
  .filter((v) => !Number.isNaN(Number(v)))
  .map((v) => Number(v));
const count = numbers.length;

if (count < 2) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Need at least 2 values" }, data: null };
}

const min = Math.min(...numbers);
const max = Math.max(...numbers);
const range = max - min;
const binWidth = range / bins;

const histogram: Array<{
  bin: number;
  range: string;
  start: number;
  end: number;
  count: number;
  frequency: number;
}> = [];

for (let i = 0; i < bins; i++) {
  const binStart = min + i * binWidth;
  const binEnd = binStart + binWidth;
  histogram.push({
    bin: i + 1,
    range: `${binStart.toFixed(2)} - ${binEnd.toFixed(2)}`,
    start: Number(binStart.toFixed(4)),
    end: Number(binEnd.toFixed(4)),
    count: 0,
    frequency: 0,
  });
}

for (const num of numbers) {
  const binIndex = Math.min(bins - 1, Math.floor((num - min) / binWidth));
  histogram[binIndex].count++;
}

for (const bin of histogram) {
  bin.frequency = Number(((bin.count / count) * 100).toFixed(2));
}

const mean = numbers.reduce((a, b) => a + b, 0) / count;
const m3 =
  numbers.reduce((acc, x) => acc + Math.pow(x - mean, 3), 0) / count;
const m2 =
  numbers.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / count;
const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;

let shape = "symmetric";
if (skewness < -0.5) {
  shape = "left-skewed (negative)";
} else if (skewness > 0.5) {
  shape = "right-skewed (positive)";
}

return {
  success: true,
  data: {
    count,
    min,
    max,
    range,
    bin_width: Number(binWidth.toFixed(4)),
    histogram,
    skewness: Number(skewness.toFixed(4)),
    distribution_shape: shape,
  },
};
```

---

## Example 7: Weighted Calculations

Perform weighted averages and scores:

```typescript
const items = (process_input.result?.items ?? []) as Array<{
  label?: string;
  value?: number;
  weight?: number;
}>;

if (items.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No items provided" }, data: null };
}

let totalWeight = 0;
let weightedSum = 0;
const processed: Array<Record<string, unknown>> = [];

for (const item of items) {
  const value = Number(item.value ?? 0);
  const weight = Number(item.weight ?? 1);

  weightedSum += value * weight;
  totalWeight += weight;

  processed.push({
    label: item.label ?? "Item",
    value,
    weight,
    contribution: Number((value * weight).toFixed(4)),
  });
}

const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
const simpleSum = processed.reduce((acc, item) => acc + Number(item.value), 0);
const simpleAverage = simpleSum / processed.length;

for (const item of processed) {
  item.percent_of_total =
    totalWeight > 0
      ? Number(((Number(item.weight) / totalWeight) * 100).toFixed(2))
      : 0;
}

return {
  success: true,
  data: {
    items: processed,
    total_weight: totalWeight,
    weighted_sum: Number(weightedSum.toFixed(4)),
    weighted_average: Number(weightedAverage.toFixed(4)),
    simple_average: Number(simpleAverage.toFixed(4)),
    difference: Number((weightedAverage - simpleAverage).toFixed(4)),
  },
};
```

---

## Example 8: Rounding and Formatting

Various rounding and number formatting options:

```typescript
const number = Number(process_input.result?.number ?? 0);
const decimals = Number(process_input.result?.decimals ?? 2);
const currency = String(process_input.result?.currency ?? "USD");

const factor = Math.pow(10, decimals);

const rounding = {
  original: number,
  round: Number(number.toFixed(decimals)),
  floor: Math.floor(number * factor) / factor,
  ceil: Math.ceil(number * factor) / factor,
  truncate: Math.trunc(number * factor) / factor,
};

function bankersRound(num: number, dec: number): number {
  const f = Math.pow(10, dec);
  const shifted = num * f;
  const base = Math.floor(shifted);
  const fractional = shifted - base;

  if (Math.abs(fractional - 0.5) < Number.EPSILON) {
    return (base % 2 === 0 ? base : base + 1) / f;
  }
  return Number(num.toFixed(dec));
}
rounding.bankers_round = bankersRound(number, decimals);

const currencySymbols: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ",
};
const symbol = currencySymbols[currency] ?? "";

const formatting: Record<string, string | number> = {
  number_format: number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }),
  with_thousands: number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }),
  european: number.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }),
  currency: `${symbol}${number.toFixed(decimals)}`,
  percentage: `${(number * 100).toFixed(decimals)}%`,
  scientific: number.toExponential(decimals),
  padded: number.toFixed(decimals).padStart(10 + (decimals > 0 ? decimals + 1 : 0), "0"),
};

function sigFigs(num: number, n: number): number {
  if (num === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(num)));
  const power = n - d;
  const magnitude = Math.pow(10, power);
  return Math.round(num * magnitude) / magnitude;
}
formatting.sig_figs_3 = sigFigs(number, 3);

return {
  success: true,
  data: {
    input: number,
    decimals,
    rounding,
    formatting,
  },
};
```

---

## Example 9: Correlation Calculation

Calculate correlation between two data sets:

```typescript
const xValues = process_input.result?.x ?? [];
const yValues = process_input.result?.y ?? [];

const x = xValues.filter((v) => !Number.isNaN(Number(v))).map(Number);
const y = yValues.filter((v) => !Number.isNaN(Number(v))).map(Number);

const n = Math.min(x.length, y.length);
if (n < 2) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Need at least 2 paired values" }, data: null };
}

const xPaired = x.slice(0, n);
const yPaired = y.slice(0, n);

const meanX = xPaired.reduce((a, b) => a + b, 0) / n;
const meanY = yPaired.reduce((a, b) => a + b, 0) / n;

let covariance = 0;
let varX = 0;
let varY = 0;

for (let i = 0; i < n; i++) {
  const dx = xPaired[i] - meanX;
  const dy = yPaired[i] - meanY;
  covariance += dx * dy;
  varX += dx * dx;
  varY += dy * dy;
}

covariance /= n;
varX /= n;
varY /= n;

const stdX = Math.sqrt(varX);
const stdY = Math.sqrt(varY);
const correlation = stdX * stdY > 0 ? covariance / (stdX * stdY) : 0;

const slope = varX > 0 ? covariance / varX : 0;
const intercept = meanY - slope * meanX;
const rSquared = correlation * correlation;

let interpretation = "no correlation";
const absCorr = Math.abs(correlation);
if (absCorr >= 0.9) interpretation = "very strong";
else if (absCorr >= 0.7) interpretation = "strong";
else if (absCorr >= 0.5) interpretation = "moderate";
else if (absCorr >= 0.3) interpretation = "weak";
else if (absCorr > 0) interpretation = "very weak";

if (correlation < 0 && absCorr > 0.1) {
  interpretation += " negative";
} else if (correlation > 0 && absCorr > 0.1) {
  interpretation += " positive";
}

return {
  success: true,
  data: {
    n,
    correlation: Number(correlation.toFixed(4)),
    interpretation,
    r_squared: Number(rSquared.toFixed(4)),
    covariance: Number(covariance.toFixed(4)),
    regression: {
      slope: Number(slope.toFixed(4)),
      intercept: Number(intercept.toFixed(4)),
      equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
    },
    statistics: {
      x_mean: Number(meanX.toFixed(4)),
      y_mean: Number(meanY.toFixed(4)),
      x_std: Number(stdX.toFixed(4)),
      y_std: Number(stdY.toFixed(4)),
    },
  },
};
```

---

## Example 10: Unit Conversion

Convert between different units:

```typescript
const value = Number(process_input.result?.value ?? 0);
const fromUnit = String(process_input.result?.from_unit ?? "").toLowerCase();
const toUnit = String(process_input.result?.to_unit ?? "").toLowerCase();
const category = String(process_input.result?.category ?? "length").toLowerCase();

const conversions: Record<string, Record<string, number>> = {
  length: {
    m: 1, km: 1000, cm: 0.01, mm: 0.001,
    mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254,
  },
  weight: {
    kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495,
  },
  volume: {
    l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588,
  },
  data: {
    b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776,
  },
};

if (!conversions[category] && category !== "temperature") {
  return { success: false, error: { code: "VALIDATION_ERROR", message: `Unknown category: ${category}` }, data: null };
}

if (category === "temperature") {
  let result = value;

  if (fromUnit === "f") result = ((value - 32) * 5) / 9;
  else if (fromUnit === "k") result = value - 273.15;

  if (toUnit === "f") result = (result * 9) / 5 + 32;
  else if (toUnit === "k") result = result + 273.15;

  return {
    success: true,
    data: {
      value,
      from_unit: fromUnit,
      to_unit: toUnit,
      result: Number(result.toFixed(4)),
      category,
    },
  };
}

const units = conversions[category];
if (!units[fromUnit] || !units[toUnit]) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Unknown unit" }, data: null };
}

const baseValue = value * units[fromUnit];
const converted = baseValue / units[toUnit];

return {
  success: true,
  data: {
    value,
    from_unit: fromUnit,
    to_unit: toUnit,
    result: Number(converted.toFixed(6)),
    category,
    formula: `${value} ${fromUnit} = ${converted.toFixed(6)} ${toUnit}`,
  },
};
```

---

## Best Practices

### 1. Handle Division by Zero

```typescript
if (divisor === 0) {
  return { success: false, error: { code: "BUSINESS_RULE_ERROR", message: "Division by zero" }, data: null };
}
```

### 2. Use Appropriate Precision

```typescript
// Financial calculations — 2 decimal places
const amount = Number(value.toFixed(2));

// Scientific calculations — more precision
const result = Number(value.toFixed(6));
```

### 3. Validate Numeric Input

```typescript
const input = process_input.result ?? process_input;
const numbers = (Array.isArray(input) ? input : [input]).filter(
  (v) => typeof v === "number" || !Number.isNaN(Number(v))
);
if (numbers.length === 0) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "No valid numbers" },
    data: null,
  };
}
```

### 4. Consider Floating Point Precision

```typescript
if (Math.abs(a - b) < 0.0001) {
  // Values are approximately equal
}
```

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [Array & Collection Operations](Array_Collection_Operations.md)
- [Date & Time Operations](Date_Time_Operations.md)
