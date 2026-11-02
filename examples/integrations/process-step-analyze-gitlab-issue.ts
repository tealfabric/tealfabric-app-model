/**
 * Analyze GitLab issue with LLM, post comment, update labels.
 *
 * Input: issue_data, issue_iid, project_id
 * Capabilities: connector, llm, logging
 */
const integrationId = String(process_input.integration_id ?? "fill-integration-id-here");
const projectId = String(process_input.project_id ?? "0");

if (!process_input.issue_data) {
  return {
    success: false,
    error: {
      code: "MISSING_ISSUE_DATA",
      message: "Issue data is required",
      details: "process_input must contain issue_data from previous step",
    },
    data: null,
  };
}

if (!process_input.issue_iid) {
  return {
    success: false,
    error: {
      code: "MISSING_ISSUE_IID",
      message: "Issue IID is required",
      details: "process_input must contain issue_iid",
    },
    data: null,
  };
}

const issueData = process_input.issue_data as Record<string, unknown>;
const issueIid = String(process_input.issue_iid);
const issueTitle = String(issueData.title ?? "Untitled Issue");
const issueDescription = String(issueData.description ?? "");
const issueState = String(issueData.state ?? "");
const issueLabels = Array.isArray(issueData.labels) ? (issueData.labels as string[]) : [];
const issueAuthor = (issueData.author ?? {}) as Record<string, unknown>;
const issueUrl = String(issueData.web_url ?? "");

tf.log("info", "Analyzing GitLab issue", { issueIid, issueTitle });

const analysisPrompt = `You are a technical support analyst reviewing a GitLab issue. Provide detailed, factual, technical analysis for developers.

Analysis Guidelines:
- Provide detailed, factual, technical analysis for developers
- Include root cause identification and specific fix proposals
- Avoid vague remarks - be specific and actionable
- Include code examples, file locations, and testing steps if applicable
- Tag with "Fix Review" if fix is identified, "Agent Question" if clarification needed

Issue Details:
Title: ${issueTitle}
State: ${issueState}
Labels: ${issueLabels.join(", ")}
Author: ${issueAuthor.name ?? "Unknown"} (${issueAuthor.username ?? "unknown"})
Created: ${issueData.created_at ?? "Unknown"}
Updated: ${issueData.updated_at ?? "Unknown"}

Description:
${issueDescription}

Provide a comprehensive technical analysis of this issue. Include:
1. Root cause analysis (if identifiable)
2. Specific fix proposals (if applicable)
3. Code examples or file locations (if relevant)
4. Testing steps (if applicable)
5. Any questions or clarifications needed

Format your response in markdown for better readability.`;

let analysis = "";

try {
  const llmResult = await llm.callLLM(analysisPrompt, {
    max_tokens: 10000,
    temperature: 0.3,
  });

  if (!llmResult.success) {
    const errorMessage = String(llmResult.error ?? "LLM analysis failed");
    tf.log("error", "LLM analysis failed", { errorMessage });
    return {
      success: false,
      error: {
        code: "LLM_ANALYSIS_FAILED",
        message: "Failed to generate analysis using LLM",
        details: errorMessage,
      },
      data: null,
    };
  }

  const responseObj = llmResult.response as { response?: string } | undefined;
  analysis = String(responseObj?.response ?? "");

  if (!analysis) {
    return {
      success: false,
      error: {
        code: "EMPTY_ANALYSIS",
        message: "LLM returned empty analysis",
        details: "The LLM service did not generate any analysis content",
      },
      data: null,
    };
  }

  tf.log("info", "Analysis generated", { length: analysis.length });
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: {
      code: "LLM_EXCEPTION",
      message: "Exception during LLM analysis",
      details: message,
    },
    data: null,
  };
}

const commentResult = await integration.executeSync(integrationId, {
  operation: "send",
  endpoint: `projects/${projectId}/issues/${issueIid}/notes`,
  method: "POST",
  data: { body: analysis },
});

if (!commentResult.success) {
  const errorMessage = String(commentResult.error ?? "Comment post failed");
  tf.log("error", "Failed to post GitLab comment", { errorMessage });
  return {
    success: false,
    error: {
      code: "COMMENT_POST_FAILED",
      message: "Analysis generated but failed to post comment",
      details: errorMessage,
    },
    data: { analysis, comment_posted: false },
  };
}

tf.log("info", "Analysis comment posted", { issueIid });

const labelsToAdd: string[] = [];
const content = `${issueTitle} ${issueDescription} ${analysis}`.toLowerCase();

if (analysis.includes("Fix Review")) labelsToAdd.push("Fix Review");
if (analysis.includes("Agent Question")) labelsToAdd.push("Agent Question");
if (/ready for aut|ready for automated/i.test(analysis)) labelsToAdd.push("Ready for AUT");
if (/ready for uat/i.test(analysis)) labelsToAdd.push("Ready for UAT");

if (content.includes("critical") || content.includes("urgent")) {
  labelsToAdd.push("Priority: High");
} else if (content.includes("bug") || content.includes("error")) {
  labelsToAdd.push("Priority: Medium");
} else {
  labelsToAdd.push("Priority: Low");
}

if (content.includes("ssl") && content.includes("connector")) labelsToAdd.push("Component: Connectors");
if (content.includes("authentication") || content.includes("login")) labelsToAdd.push("Component: Auth");
if (content.includes("ui") || content.includes("frontend") || content.includes("css")) {
  labelsToAdd.push("Component: Frontend");
}
if (content.includes("api") || content.includes("backend")) labelsToAdd.push("Component: Backend");
if (content.includes("database") || content.includes("sql")) labelsToAdd.push("Component: Database");
if (analysis.includes("Root Cause")) labelsToAdd.push("Status: Analyzed");

const uniqueLabels = [...new Set(labelsToAdd)];
let labelsUpdated: string[] = [];

if (uniqueLabels.length > 0) {
  const allLabels = [...new Set([...issueLabels, ...uniqueLabels])];
  const labelUpdateResult = await integration.executeSync(integrationId, {
    operation: "send",
    endpoint: `projects/${projectId}/issues/${issueIid}`,
    method: "PUT",
    data: { labels: allLabels.join(",") },
  });

  if (labelUpdateResult.success) {
    labelsUpdated = uniqueLabels;
    tf.log("info", "Labels updated", { labels: uniqueLabels });
  } else {
    tf.log("warn", "Label update failed", { error: labelUpdateResult.error });
  }
}

return {
  success: true,
  data: {
    analysis,
    comment_posted: true,
    labels_updated: labelsUpdated,
    issue_iid: issueIid,
    project_id: projectId,
    issue_url: issueUrl,
    issue_title: issueTitle,
    user_id: String(process_input.user_id ?? user_id ?? ""),
    user_email: String(process_input.user_email ?? ""),
    user_full_name: String(process_input.user_full_name ?? ""),
  },
  message: `Successfully analyzed and posted analysis to issue #${issueIid}`,
};
