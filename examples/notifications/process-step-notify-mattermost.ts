/**
 * Notify support crew via Mattermost (RestAPI webhook integration).
 *
 * Input: analysis, issue_iid, issue_url, issue_data (optional), labels_updated (optional)
 * Capabilities: connector, logging
 */
const integrationId = String(process_input.integration_id ?? "fill-the-id-here");

if (!process_input.analysis) {
  return {
    success: false,
    error: {
      code: "MISSING_ANALYSIS",
      message: "Analysis is required",
      details: "process_input must contain analysis from previous step",
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

const analysis = String(process_input.analysis);
const issueIid = String(process_input.issue_iid);
const issueUrl = String(process_input.issue_url ?? "");
const issueData = (process_input.issue_data ?? {}) as Record<string, unknown>;
const labelsUpdated = Array.isArray(process_input.labels_updated)
  ? (process_input.labels_updated as string[])
  : [];

const issueTitle = String(issueData.title ?? `Issue #${issueIid}`);
const issueState = String(issueData.state ?? "");
const issueLabels = Array.isArray(issueData.labels) ? (issueData.labels as string[]) : [];

tf.log("info", "Preparing Mattermost notification", { issueIid });

let message = `## 🔍 Support Ticket Received and Analysis Completed\n\n`;
message += `**Issue:** [${issueTitle}](${issueUrl})\n`;
message += `**Issue #:** ${issueIid}\n`;

if (issueState) {
  message += `**State:** ${issueState}\n`;
}

if (issueLabels.length > 0) {
  message += `**Labels:** ${issueLabels.map((l) => `\`${l}\``).join(", ")}\n`;
}

if (labelsUpdated.length > 0) {
  message += `**New Labels Added:** ${labelsUpdated.map((l) => `\`${l}\``).join(", ")}\n`;
}

message += "\n---\n\n### Analysis\n\n";

const maxAnalysisLength = 3000;
if (analysis.length > maxAnalysisLength) {
  message += analysis.slice(0, maxAnalysisLength);
  message += "\n\n*[Analysis truncated — full analysis in GitLab issue comments]*\n\n";
  message += `**View full analysis:** [GitLab Issue #${issueIid}](${issueUrl})\n`;
} else {
  message += `${analysis}\n`;
}

message += `\n---\n\n**View Issue:** [${issueUrl}](${issueUrl})\n`;

const result = await integration.executeSync(integrationId, {
  text: message,
  username: "Tealfabric IO Support",
});

if (!result.success) {
  const errorMessage = String(result.error ?? "Unknown Mattermost error");
  tf.log("error", "Mattermost send failed", { errorMessage });
  return {
    success: false,
    error: {
      code: "MATTERMOST_SEND_FAILED",
      message: "Failed to send notification to Mattermost",
      details: errorMessage,
    },
    data: { notification_sent: false, message_prepared: message },
  };
}

const resultData = result.data as Record<string, unknown> | unknown[] | undefined;
let mattermostMessageId: string | null = null;
if (resultData && typeof resultData === "object" && !Array.isArray(resultData)) {
  mattermostMessageId = String((resultData as Record<string, unknown>).id ?? "");
} else if (Array.isArray(resultData) && resultData[0]) {
  mattermostMessageId = String((resultData[0] as Record<string, unknown>).id ?? "");
}

return {
  success: true,
  data: {
    notification_sent: true,
    mattermost_message_id: mattermostMessageId,
    issue_iid: issueIid,
    issue_url: issueUrl,
    issue_title: String(process_input.issue_title ?? ""),
    message_preview: `${message.slice(0, 200)}...`,
    user_id: String(process_input.user_id ?? user_id ?? ""),
    user_email: String(process_input.user_email ?? ""),
    user_full_name: String(process_input.user_full_name ?? ""),
  },
  message: `Successfully sent Mattermost notification for issue #${issueIid}`,
};
