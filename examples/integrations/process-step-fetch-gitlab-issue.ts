/**
 * Fetch GitLab issue content via integration connector.
 *
 * Input (process_input): issue_iid, project_id
 * Output: issue_data and metadata for downstream steps
 *
 * Capabilities: connector
 */
const integrationId = String(process_input.integration_id ?? "fill-integration-id-here");
const projectId = String(process_input.project_id ?? "");

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

if (!projectId) {
  return {
    success: false,
    error: {
      code: "MISSING_PROJECT_ID",
      message: "Project ID is required",
      details: "process_input must contain project_id",
    },
    data: null,
  };
}

const issueIid = String(process_input.issue_iid);
tf.log("info", "Fetching GitLab issue", { issueIid, projectId });

const result = await integration.executeSync(integrationId, {
  operation: "receive",
  endpoint: `projects/${projectId}/issues/${issueIid}`,
});

if (!result.success) {
  const errorMessage = String(result.error ?? "Unknown error fetching issue");
  tf.log("error", "GitLab fetch failed", { errorMessage });
  return {
    success: false,
    error: {
      code: "GITLAB_FETCH_FAILED",
      message: "Failed to fetch issue from GitLab",
      details: errorMessage,
    },
    data: null,
  };
}

type IntegrationPayload = {
  result?: { data?: unknown; success?: boolean };
  data?: unknown;
  message_count?: number;
};

const payload = result as IntegrationPayload;
const dataSource =
  payload.result && typeof payload.result === "object" ? payload.result : payload;

let issueData: Record<string, unknown> | null = null;
const rawData = dataSource.data;

if (Array.isArray(rawData) && rawData.length > 0) {
  issueData = rawData[0] as Record<string, unknown>;
} else if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
  const obj = rawData as Record<string, unknown>;
  if ("iid" in obj || "id" in obj) {
    issueData = obj;
  }
}

if (!issueData || (!issueData.iid && !issueData.id)) {
  tf.log("error", "Invalid GitLab issue payload", {
    keys: Object.keys(payload),
    message_count: dataSource.message_count ?? payload.message_count,
  });
  return {
    success: false,
    error: {
      code: "EMPTY_ISSUE_DATA",
      message: "GitLab API returned empty or invalid issue data",
      details: "Issue may not exist or access may be denied",
    },
    data: null,
  };
}

const userId = String(process_input.user_id ?? user_id ?? "");
const userEmail = String(process_input.user_email ?? "");
const userFullName = String(process_input.user_full_name ?? "");

tf.log("info", "GitLab issue fetched", { title: issueData.title });

return {
  success: true,
  data: {
    issue_data: issueData,
    issue_iid: issueIid,
    project_id: projectId,
    issue_title: String(issueData.title ?? ""),
    issue_description: String(issueData.description ?? ""),
    issue_state: String(issueData.state ?? ""),
    issue_labels: Array.isArray(issueData.labels) ? issueData.labels : [],
    issue_author: issueData.author ?? null,
    issue_created_at: issueData.created_at ?? null,
    issue_updated_at: issueData.updated_at ?? null,
    issue_url: issueData.web_url ?? null,
    user_id: userId,
    user_email: userEmail,
    user_full_name: userFullName,
  },
  message: `Successfully fetched issue #${issueIid} from GitLab`,
};
