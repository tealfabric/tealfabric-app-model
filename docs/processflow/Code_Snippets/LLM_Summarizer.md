# LLM Summarizer

Use the LLM Summarizer process step to generate concise summaries from any data structure via the platform's native LLM service. **TypeScript preferred**; see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

The LLM Summarizer analyzes input data from previous process steps and generates structured summaries with key insights, bullet points, and takeaways. It automatically handles different data formats and structures, making it ideal for summarizing API responses, database records, documents, or any complex data.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Previous Step │────▶│  LLM Summarizer  │────▶│  Summary Data   │
│  (Any Data)     │     │  (LLM Analysis)  │     │  (Structured)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Features

- **Automatic Data Handling**: Works with any data structure (arrays, objects, strings)
- **Intelligent Extraction**: LLM automatically identifies key facts and insights
- **Structured Output**: Returns consistent JSON format with summary, bullets, and takeaway
- **Size Management**: Automatically truncates large inputs and limits output length
- **Error Handling**: Graceful fallback if JSON parsing fails

## Input Data

The summarizer accepts data from the previous process step in multiple formats:

| Source | Description | Priority |
|--------|-------------|----------|
| `process_input.data` | Output from previous step (recommended) | Highest |
| `process_input` | Direct process input | Fallback |
| Any structure | Arrays, objects, strings | All supported |

### Example Input Formats

**From Previous Step (Recommended):**

```typescript
// Previous step returns:
return {
  success: true,
  data: {
    customer_name: "John Doe",
    order_total: 1250.0,
    items: ["Product A", "Product B"],
    status: "completed",
  },
};

// LLM Summarizer receives process_input.data automatically
```

**Direct Input:**

```typescript
// If previous step returns data directly:
return {
  customer_name: "John Doe",
  order_total: 1250.0,
};

// LLM Summarizer uses process_input directly
```

## Output Structure

The summarizer returns a standardized structure:

```typescript
{
  success: true,
  data: {
    summary: "A concise summary (approximately 200 words)",
    bullets: [
      "Key point 1",
      "Key point 2",
      "Key point 3",
    ],
    takeaway: "One-line takeaway message",
    raw_response: "Original LLM response text",
  },
  message: "Summary generated successfully",
}
```

### Output Fields

| Field | Type | Description | Limits |
|-------|------|-------------|--------|
| `summary` | string | Concise summary of the data | ~200 words (truncated if longer) |
| `bullets` | array | Up to 5 key bullet points | Maximum 5 items |
| `takeaway` | string | One-line key insight | 150 characters (truncated if longer) |
| `raw_response` | string | Original LLM response | Full response text |

## Code Snippet

Copy this code into your process step:

```typescript
/**
 * LLM Summary Process Step
 * Generates a summary using the platform's native LLM service.
 */

try {
  const inputData = process_input.data ?? process_input ?? {};

  if (!inputData || (typeof inputData === "object" && Object.keys(inputData as object).length === 0)) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "No input data provided" },
      data: null,
    };
  }

  let jsonData = JSON.stringify(
    Array.isArray(inputData) ? inputData : { content: inputData },
    null,
    2
  );

  if (jsonData.length > 5000) {
    jsonData = jsonData.slice(0, 5000) + "\n... (truncated)";
  }

  const prompt =
    "Analyze the JSON data and create a concise summary. Extract key facts and insights. Ignore metadata/IDs/timestamps unless relevant.\n" +
    'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["point 1", "point 2"], "takeaway": "one-line"}\n\n' +
    `JSON Data:\n${jsonData}`;

  const llmResult = await tf.llm.callLLM(prompt, { max_tokens: 1000 });

  if (!llmResult.success) {
    throw new Error(
      (llmResult.error as { message?: string })?.message ?? "LLM call failed"
    );
  }

  const responseText = String(
    llmResult.response?.response ?? llmResult.response ?? ""
  );

  if (!responseText) {
    throw new Error("Empty LLM response");
  }

  const fenced = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const bare = responseText.match(/(\{[\s\S]*\})/);
  const jsonText = fenced?.[1] ?? bare?.[1] ?? responseText;

  let summary = "";
  let bullets: string[] = [];
  let takeaway = "";

  try {
    const parsed = JSON.parse(jsonText) as {
      summary?: string;
      bullets?: string[];
      takeaway?: string;
    };

    summary = parsed.summary ?? "";
    bullets = (parsed.bullets ?? [])
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 5);
    takeaway = parsed.takeaway ?? "";
  } catch {
    summary = responseText;
    bullets = [];
    takeaway = "";
  }

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  if (wordCount > 250) {
    summary = summary.split(/\s+/).slice(0, 200).join(" ") + "...";
  }

  if (takeaway.length > 150) {
    takeaway = takeaway.slice(0, 147) + "...";
  }

  return {
    success: true,
    data: { summary, bullets, takeaway, raw_response: responseText },
    message: "Summary generated successfully",
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: {
      code: "LLM_SUMMARY_ERROR",
      message: "Failed to generate summary",
      details: message,
    },
    data: null,
  };
}
```

## Configuration Options

### Customizing the Prompt

You can modify the prompt to change how the LLM analyzes data:

**Default Prompt:**

```typescript
const prompt =
  "Analyze the JSON data and create a concise summary. Extract key facts and insights. Ignore metadata/IDs/timestamps unless relevant.\n" +
  'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["point 1", "point 2"], "takeaway": "one-line"}\n\n' +
  `JSON Data:\n${jsonData}`;
```

**Customization Examples:**

**Focus on Business Metrics:**

```typescript
const prompt =
  "Analyze the JSON data focusing on business metrics, revenue, and KPIs. Extract financial insights and performance indicators.\n" +
  'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["metric 1", "metric 2"], "takeaway": "one-line"}\n\n' +
  `JSON Data:\n${jsonData}`;
```

**Technical Summary:**

```typescript
const prompt =
  "Analyze the JSON data from a technical perspective. Focus on system status, errors, performance metrics, and technical details.\n" +
  'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["technical point 1", "technical point 2"], "takeaway": "one-line"}\n\n' +
  `JSON Data:\n${jsonData}`;
```

**Customer-Focused Summary:**

```typescript
const prompt =
  "Analyze the JSON data from a customer perspective. Focus on customer experience, satisfaction, issues, and feedback.\n" +
  'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["customer insight 1", "customer insight 2"], "takeaway": "one-line"}\n\n' +
  `JSON Data:\n${jsonData}`;
```

### Adjusting Token Limits

Modify the `max_tokens` parameter to control response length:

```typescript
// Shorter responses (faster, cheaper)
const llmResult = await tf.llm.callLLM(prompt, { max_tokens: 500 });

// Longer responses (more detailed)
const llmResult = await tf.llm.callLLM(prompt, { max_tokens: 2000 });
```

### Changing Input Size Limits

Adjust the JSON truncation limit:

```typescript
// Allow larger inputs (default: 5000 characters)
if (jsonData.length > 10000) {
  jsonData = jsonData.slice(0, 10000) + "\n... (truncated)";
}
```

### Modifying Output Limits

Change summary and takeaway length limits:

```typescript
// Longer summary (default: ~200 words)
const words = summary.split(/\s+/).filter(Boolean);
if (words.length > 500) {
  summary = words.slice(0, 400).join(" ") + "...";
}

// Longer takeaway (default: 150 characters)
if (takeaway.length > 300) {
  takeaway = takeaway.slice(0, 297) + "...";
}

// More bullet points (default: 5)
bullets = (parsed.bullets ?? [])
  .map((b) => String(b).trim())
  .filter(Boolean)
  .slice(0, 10);
```

## Use Cases

### 1. Summarizing API Responses

Summarize complex API responses for easier consumption:

```typescript
// Previous step: Fetch data from external API
// Returns: process_input.data with API response

// LLM Summarizer step: Generates summary
// Output: Structured summary of API data
```

### 2. Database Query Results

Summarize database query results:

```typescript
// Previous step: Query database
return {
  success: true,
  data: {
    records: [
      { customer: "John", order: 1250, status: "completed" },
      { customer: "Jane", order: 890, status: "pending" },
    ],
    total: 2140,
    count: 2,
  },
};

// LLM Summarizer: Creates summary of query results
```

### 3. Document Analysis

Summarize document content or extracted text:

```typescript
// Previous step: Extract text from document
return {
  success: true,
  data: {
    document_text: "Long document content...",
    metadata: { title: "Report", pages: 10 },
  },
};

// LLM Summarizer: Creates executive summary
```

### 4. Integration Data Summaries

Summarize data from integrations:

```typescript
// Previous step: Fetch integration data
return {
  success: true,
  data: {
    sales_data: [],
    customer_data: [],
    product_data: [],
  },
};

// LLM Summarizer: Creates business insights summary
```

## Error Handling

The summarizer handles errors gracefully:

### Validation Error

```typescript
// If no input data provided:
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "No input data provided",
  },
  data: null,
}
```

### LLM Service Error

```typescript
// If LLM call fails:
{
  success: false,
  error: {
    code: "LLM_SUMMARY_ERROR",
    message: "Failed to generate summary",
    details: "LLM service call failed: Connection timeout",
  },
  data: null,
}
```

### Fallback Behavior

If JSON parsing fails, the summarizer uses the raw LLM response as the summary:

```typescript
// Fallback output:
{
  success: true,
  data: {
    summary: "Raw LLM response text",
    bullets: [],
    takeaway: "",
    raw_response: "Raw LLM response text",
  },
}
```

## Best Practices

### 1. Use `process_input.data` Structure

Always return data in the standard format from previous steps:

```typescript
// Good
return {
  success: true,
  data: yourData,
};

// Avoid — works but less explicit
return yourData;
```

### 2. Filter Sensitive Data

Remove sensitive information before summarizing:

```typescript
const sensitive = new Set(["password", "api_key", "ssn", "credit_card"]);
const filteredData = Object.fromEntries(
  Object.entries(process_input.data as Record<string, unknown>).filter(
    ([key]) => !sensitive.has(key)
  )
);
```

### 3. Limit Input Size

For very large datasets, consider pre-filtering:

```typescript
// In previous step, select only relevant fields:
return {
  success: true,
  data: {
    key_metrics: data.metrics,
    recent_events: (data.events as unknown[]).slice(0, 10),
  },
};
```

### 4. Customize for Your Domain

Modify the prompt to match your business domain:

```typescript
// E-commerce domain
const prompt = "Analyze e-commerce order data. Focus on customer behavior, product trends, and sales patterns...";

// Healthcare domain
const prompt = "Analyze patient data. Focus on health metrics, treatment outcomes, and care patterns...";

// Finance domain
const prompt = "Analyze financial data. Focus on transactions, balances, and financial health indicators...";
```

## Troubleshooting

### Issue: "No input data provided"

**Cause:** Previous step didn't return data in expected format.

**Solution:** Ensure previous step returns:

```typescript
return {
  success: true,
  data: yourData,
};
```

### Issue: Summary is too generic

**Cause:** Prompt doesn't specify domain or focus area.

**Solution:** Customize the prompt to include domain-specific instructions:

```typescript
const prompt = "Analyze [YOUR DOMAIN] data. Focus on [SPECIFIC ASPECTS]...";
```

### Issue: Summary is truncated

**Cause:** Input data exceeds 5000 character limit.

**Solution:** Increase truncation limit or pre-filter data in previous step.

### Issue: LLM call fails

**Cause:** LLM service unavailable or misconfigured.

**Solution:** Check LLM service configuration in platform settings.

## Related Documentation

- [LLM Integration Guide](./LLM_Integration.md) — General LLM usage patterns
- [Process Communication](./Process_Communication.md) — Passing data between steps
- [Data Transformation](./Data_Transformation_Mapping.md) — Transforming data structures

## Summary

The LLM Summarizer is a powerful tool for automatically generating structured summaries from any data source. It handles complex data structures, provides consistent output, and can be customized for your specific needs. Use it to create executive summaries, extract key insights, and make complex data more accessible.
