# Using LLM in ProcessFlow Code Snippets

Integrate Large Language Models (LLM) into ProcessFlow snippets via `tf.llm` (preferred) or the `llm` root global. **TypeScript preferred**; see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

The LLM service provides tenant-scoped access to LLM capabilities within ProcessFlow code snippets. It handles:

- **Authentication & Configuration**: Uses tenant-specific LLM settings
- **Rate Limiting**: Enforces per-tenant and per-user rate limits
- **Usage Tracking**: Logs all LLM calls with token usage and costs
- **Error Handling**: Provides structured error responses

Requires the **`llm`** capability. Prefer **`tf.llm.callLLM`** in new steps (`llm.callLLM` remains as a compatibility alias).

## Available Methods

### `tf.llm.callLLM(prompt, options?)` / `tf.llm.complete(prompt, options?)`

Makes a synchronous LLM call and returns the complete response. `complete` is an alias of `callLLM`.

**Streaming is not supported** — there is no `callLLMStream` / streaming API. Use a single `callLLM` / `complete` call and wait for the full response.

**Parameters:**

- `prompt` — The prompt/question to send to the LLM
- `options` — Optional configuration overrides:
  - `model` — Model name (e.g., `gpt-4o`, `gpt-5-mini`)
  - `temperature` — Creativity level (0.0 – 1.0)
  - `max_tokens` — Maximum response length
  - `timeout` — Request timeout in seconds

**Returns:**

```typescript
{
  success: true | false,
  call_id: "unique_call_identifier",
  tenant_id: "your_tenant_id",
  user_id: "executing_user_id",
  prompt: "your_prompt",
  response: {
    response: "The LLM response text...",
    usage: {
      prompt_tokens: 50,
      completion_tokens: 100,
      total_tokens: 150,
    },
  },
  execution_time: 1.234,
  usage: { /* ... */ },
  error: null, // or { code, message } if failed
}
```

`llm.chat` is **blocked**. Use `callLLM` or `complete` only.

---

## Example 1: Simple Text Generation

Generate a summary of input data:

```typescript
const data = process_input.result?.data ?? {};

if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "No input data provided" },
    data: null,
  };
}

const prompt =
  "Summarize the following data in 2-3 sentences:\n\n" +
  JSON.stringify(data, null, 2);

const result = await tf.llm.callLLM(prompt, {
  temperature: 0.3,
  max_tokens: 200,
});

if (!result.success) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: (result.error as { message?: string })?.message ?? "LLM call failed" },
    data: null,
  };
}

return {
  success: true,
  data: {
    summary: result.response?.response,
    tokens_used: result.response?.usage?.total_tokens ?? 0,
  },
};
```

---

## Example 2: Data Classification

Classify customer feedback into categories:

```typescript
const feedback = String(process_input.result?.feedback ?? "");

if (!feedback) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No feedback provided" }, data: null };
}

const prompt = `Classify the following customer feedback into one of these categories:
- positive
- negative
- neutral
- feature_request
- bug_report
- question

Respond with ONLY the category name, nothing else.

Feedback: "${feedback}"`;

const result = await tf.llm.callLLM(prompt, {
  temperature: 0.1,
  max_tokens: 20,
});

if (!result.success) {
  return { success: false, error: { code: "RUNTIME_ERROR", message: "Classification failed" }, data: null };
}

let category = String(result.response?.response ?? "")
  .toLowerCase()
  .trim();

const validCategories = [
  "positive",
  "negative",
  "neutral",
  "feature_request",
  "bug_report",
  "question",
];

if (!validCategories.includes(category)) {
  category = "unknown";
}

return {
  success: true,
  data: {
    feedback,
    category,
    confidence: "high",
  },
};
```

---

## Example 3: Structured Data Extraction

Extract structured information from unstructured text:

```typescript
const text = String(process_input.result?.raw_text ?? "");

if (!text) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No text provided" }, data: null };
}

const prompt = `Extract the following information from the text below and return as JSON:
- company_name: string
- contact_email: string or null
- phone_number: string or null
- address: string or null
- products_mentioned: array of strings

Text:
${text}

Respond ONLY with valid JSON, no other text.`;

const result = await tf.llm.callLLM(prompt, {
  temperature: 0.2,
  max_tokens: 500,
});

if (!result.success) {
  return { success: false, error: { code: "RUNTIME_ERROR", message: "Extraction failed" }, data: null };
}

const responseText = String(result.response?.response ?? "");
let extracted: Record<string, unknown> | null = null;

try {
  extracted = JSON.parse(responseText);
} catch {
  const match = responseText.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      extracted = JSON.parse(match[0]);
    } catch {
      // fall through
    }
  }
}

if (!extracted) {
  return { success: false, error: { code: "RUNTIME_ERROR", message: "Failed to parse LLM response as JSON" }, data: null };
}

return {
  success: true,
  data: {
    extracted,
    source_text: text.slice(0, 100) + "...",
  },
};
```

---

## Example 4: Analyzing a File with LLM

Read a file and have the LLM analyze its contents:

```typescript
// Uploaded files: use files.read (requires `file` capability and uploads on execution)
// Tenant storage paths: use read() when `file` capability is enabled
const filePath = String(process_input.result?.file_path ?? "reports/latest.txt");

let content: string;
try {
  content = files
    ? await files.read(filePath)
    : await read(filePath); // tenant-scoped read (requires `file` capability)
} catch {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: `Could not read file: ${filePath}` },
    data: null,
  };
}

const maxChars = 10000;
if (content.length > maxChars) {
  content = content.slice(0, maxChars) + "\n\n[Content truncated...]";
}

const prompt = `Analyze the following document and provide:
1. A brief summary (2-3 sentences)
2. Key points (bullet list)
3. Any action items or recommendations

Document content:
---
${content}
---`;

const result = await tf.llm.callLLM(prompt, {
  temperature: 0.5,
  max_tokens: 1000,
});

if (!result.success) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: (result.error as { message?: string })?.message ?? "Analysis failed" },
    data: null,
  };
}

return {
  success: true,
  data: {
    file_analyzed: filePath,
    file_size: content.length,
    analysis: result.response?.response,
    tokens_used: result.response?.usage?.total_tokens ?? 0,
  },
};
```

---

## Example 5: LLM Generates Content and Saves to File

Have the LLM generate content and save it to a file:

```typescript
const topic = String(process_input.result?.topic ?? "Introduction to AI");
const outputDir = "generated/articles";

const prompt = `Write a professional article about: "${topic}"

The article should:
- Be approximately 500 words
- Have a clear introduction, body, and conclusion
- Include relevant examples
- Be suitable for a business audience`;

const result = await tf.llm.callLLM(prompt, {
  temperature: 0.7,
  max_tokens: 1500,
});

if (!result.success) {
  return {
    success: false,
    error: {
      code: "RUNTIME_ERROR",
      message: "Content generation failed: " + ((result.error as { message?: string })?.message ?? "Unknown error"),
    },
    data: null,
  };
}

const articleContent = String(result.response?.response ?? "");

const safeFilename = topic
  .toLowerCase()
  .replace(/[^a-zA-Z0-9_-]/g, "_")
  .slice(0, 50);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filename = `${outputDir}/${safeFilename}_${timestamp}.md`;

const fileContent = [
  `# ${topic}`,
  "",
  `_Generated: ${new Date().toISOString()}_`,
  "",
  "---",
  "",
  articleContent,
].join("\n");

// Tenant file write requires `file` capability
let saved = false;
try {
  await write(filename, fileContent);
  saved = true;
} catch {
  // write not available — return content in response
}

return {
  success: true,
  data: {
    topic,
    file_path: saved ? filename : null,
    file_size: fileContent.length,
    word_count: articleContent.split(/\s+/).filter(Boolean).length,
    tokens_used: result.response?.usage?.total_tokens ?? 0,
    content: saved ? undefined : fileContent,
  },
  message: saved
    ? `Article generated and saved to: ${filename}`
    : "Article generated (returned in data.content — no write capability)",
};
```

---

## Example 6: Multi-Step Analysis with File Input/Output

Process a CSV file, analyze with LLM, and generate a report:

```typescript
const inputFile = String(process_input.result?.csv_file ?? "data/sales.csv");
const outputDir = "reports";

let csvContent: string;
try {
  csvContent = files ? await files.read(inputFile) : await read(inputFile);
} catch {
  return { success: false, error: { code: "VALIDATION_ERROR", message: `Cannot read file: ${inputFile}` }, data: null };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const lines = csvContent.split("\n").filter((l) => l.trim() !== "");
const header = parseCsvLine(lines.shift() ?? "");
const rows: Record<string, string>[] = [];

for (const line of lines) {
  if (!line.trim()) continue;
  const values = parseCsvLine(line);
  rows.push(Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""])));
  if (rows.length >= 50) break;
}

if (rows.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No data rows found in CSV" }, data: null };
}

const dataDescription =
  `Columns: ${header.join(", ")}\n\n` +
  `Sample data (first ${rows.length} rows):\n` +
  JSON.stringify(rows, null, 2);

const insightPrompt = `Analyze this dataset and provide insights:

${dataDescription}

Please provide:
1. Data quality assessment
2. Key patterns or trends
3. Notable outliers or anomalies
4. Recommendations for further analysis`;

const insightResult = await tf.llm.callLLM(insightPrompt, {
  temperature: 0.5,
  max_tokens: 1000,
});

if (!insightResult.success) {
  return { success: false, error: { code: "RUNTIME_ERROR", message: "Insight analysis failed" }, data: null };
}

const insights = String(insightResult.response?.response ?? "");

const summaryPrompt = `Based on this analysis, write a brief executive summary (3-4 sentences) suitable for business stakeholders:

${insights}`;

const summaryResult = await tf.llm.callLLM(summaryPrompt, {
  temperature: 0.3,
  max_tokens: 200,
});

const summary = summaryResult.success
  ? String(summaryResult.response?.response ?? "")
  : "Summary generation failed.";

const reportFilename = `${outputDir}/analysis_report_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
const report = [
  "# Data Analysis Report",
  "",
  `**Generated:** ${new Date().toISOString()}`,
  `**Source File:** ${inputFile}`,
  `**Rows Analyzed:** ${rows.length}`,
  "",
  "---",
  "",
  "## Executive Summary",
  "",
  summary,
  "",
  "---",
  "",
  "## Detailed Analysis",
  "",
  insights,
  "",
  "---",
  "",
  "## Data Preview",
  "",
  "```json",
  JSON.stringify(rows.slice(0, 5), null, 2),
  "```",
].join("\n");

let reportSaved = false;
try {
  await write(reportFilename, report);
  reportSaved = true;
} catch {
  // write not available
}

const totalTokens =
  (insightResult.response?.usage?.total_tokens ?? 0) +
  (summaryResult.response?.usage?.total_tokens ?? 0);

return {
  success: true,
  data: {
    source_file: inputFile,
    rows_analyzed: rows.length,
    report_file: reportSaved ? reportFilename : null,
    report_size: report.length,
    executive_summary: summary,
    total_tokens_used: totalTokens,
    report: reportSaved ? undefined : report,
  },
  message: reportSaved
    ? `Analysis complete. Report saved to: ${reportFilename}`
    : "Analysis complete. Report returned in data.report",
};
```

---

## Best Practices

### 1. Handle Errors Gracefully

Always check `result.success` before using the response:

```typescript
const result = await tf.llm.callLLM(prompt);
if (!result.success) {
  tf.log(
    "error",
    `LLM call failed: ${(result.error as { message?: string })?.message ?? "Unknown"}`
  );
  return { success: false, error: { code: "RUNTIME_ERROR", message: "AI processing failed" }, data: null };
}
```

### 2. Use Appropriate Temperature

- **Low (0.1–0.3)**: Classification, extraction, factual responses
- **Medium (0.4–0.6)**: Balanced creativity and accuracy
- **High (0.7–0.9)**: Creative writing, brainstorming

### 3. Limit Input Size

LLMs have token limits. Truncate or summarize large inputs:

```typescript
const maxChars = 8000;
if (content.length > maxChars) {
  content = content.slice(0, maxChars) + "\n[Truncated...]";
}
```

### 4. Validate LLM Output

When expecting structured output (JSON, categories), always validate:

```typescript
try {
  const json = JSON.parse(String(result.response?.response ?? ""));
  // use json
} catch {
  // Handle invalid JSON
}
```

### 5. Log Token Usage

Monitor costs by logging token usage:

```typescript
tf.log("info", `LLM tokens used: ${result.response?.usage?.total_tokens ?? 0}`);
```

---

## Rate Limits

The LLM service enforces rate limits:

| Limit Type | Default |
|------------|---------|
| Tenant per hour | 1,000 calls |
| User per hour | 100 calls |
| Tenant per day | 10,000 calls |
| User per day | 1,000 calls |

If rate limits are exceeded, `tf.llm.callLLM()` returns an error with the rate limit information.

---

## File Operations Reference

When working with files in LLM code snippets:

| API | Description |
|-----|-------------|
| `files.read(path)` | Read uploaded file (requires uploads on execution) |
| `files.list()` | List uploaded files |
| `read(path)` / `write(path, data)` | Tenant-scoped read/write (requires `file` capability) |

All tenant paths are relative to: `storage/tenantdata/<tenant_id>/`

---

## See Also

- [ProcessFlow Code Snippets Guide](../PROCESSFLOW_CODE_SNIPPETS_GUIDE.md)
- [ProcessFlow Quick Reference](../PROCESSFLOW_QUICK_REFERENCE.md)
- [Email MIME Parsing](Email_MIME_Parsing.md)
