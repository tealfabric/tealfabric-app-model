/**
 * LLM summary step — generates structured summary via platform llm service.
 * Capabilities: llm (or connector profile with LLM access)
 */
try {
  const inputData =
    (process_input.data as Record<string, unknown> | undefined) ??
    (process_input as Record<string, unknown>);

  if (!inputData || Object.keys(inputData).length === 0) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "No input data provided" },
      data: null,
    };
  }

  let jsonData = JSON.stringify(inputData, null, 2);
  if (jsonData.length > 5000) {
    jsonData = `${jsonData.slice(0, 5000)}\n... (truncated)`;
  }

  const prompt =
    "Analyze the JSON data and create a concise summary. Extract key facts and insights. " +
    "Ignore metadata/IDs/timestamps unless relevant.\n" +
    'Return ONLY valid JSON (no markdown): {"summary": "~200 words", "bullets": ["point 1"], "takeaway": "one-line"}\n\n' +
    `JSON Data:\n${jsonData}`;

  const llmResult = await llm.callLLM(prompt, { max_tokens: 1000 });

  if (!llmResult.success) {
    const msg =
      (llmResult.error as { message?: string } | undefined)?.message ?? "LLM call failed";
    throw new Error(msg);
  }

  const responseObj = llmResult.response as { response?: string } | string | undefined;
  const responseText =
    typeof responseObj === "string"
      ? responseObj
      : String(responseObj?.response ?? llmResult.response ?? "");

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
    summary = String(parsed.summary ?? "");
    bullets = (parsed.bullets ?? [])
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 5);
    takeaway = String(parsed.takeaway ?? "");
  } catch {
    summary = responseText;
  }

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  if (wordCount > 250) {
    summary = `${summary.split(/\s+/).slice(0, 200).join(" ")}...`;
  }
  if (takeaway.length > 150) {
    takeaway = `${takeaway.slice(0, 147)}...`;
  }

  return {
    success: true,
    data: { summary, bullets, takeaway, raw_response: responseText },
    message: "Summary generated successfully",
  };
} catch (e: unknown) {
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
