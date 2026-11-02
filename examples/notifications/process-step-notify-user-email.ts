/**
 * Send support-ticket acknowledgment email to the user.
 *
 * Input: user_id, user_email (preferred), issue_iid, issue_url (optional)
 * Capabilities: connector
 */
const integrationId = String(process_input.integration_id ?? "fill-in-integration-id-here");

const userId = String(process_input.user_id ?? user_id ?? "");

if (!userId) {
  return {
    success: false,
    error: {
      code: "MISSING_USER_ID",
      message: "User ID is required",
      details: "process_input must contain user_id or user_id must be in context",
    },
    data: null,
  };
}

let userEmail = String(process_input.user_email ?? "");
let userFullName = String(process_input.user_full_name ?? "User");

if (!userEmail) {
  tf.log("info", "Email not in process_input, attempting API lookup", { userId });

  const host = String(http_headers?.Host ?? "localhost");
  const protocol =
    http_headers?.["X-Forwarded-Proto"] === "https" ? "https" : "https";
  const baseUrl = `${protocol}://${host}`;

  const apiResponse = await api.get(`${baseUrl}/api/v1/users/${userId}`);

  if (apiResponse.success) {
    const responseData = apiResponse.data as Record<string, unknown> | undefined;
    const user = (responseData?.user ?? responseData) as Record<string, unknown> | undefined;
    if (user?.email) {
      userEmail = String(user.email);
      userFullName = String(user.full_name ?? "User");
    }
  }
}

if (!userEmail) {
  return {
    success: false,
    error: {
      code: "USER_EMAIL_NOT_FOUND",
      message: "User email address is required",
      details: `Could not find email for user ID: ${userId}`,
    },
    data: null,
  };
}

tf.log("info", "Sending email notification", { userEmail, userFullName });

const issueIid = String(process_input.issue_iid ?? "");
const issueUrl = String(process_input.issue_url ?? "");
const issueTitle = String(process_input.issue_title ?? "Support Request");
const emailSubject = "Support Request Received - We'll Get Back to You Soon";

let emailBodyHtml =
  "<html><body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>";
emailBodyHtml += "<div style='max-width: 600px; margin: 0 auto; padding: 20px;'>";
emailBodyHtml += "<h2 style='color: #2c3e50;'>Support Request Received</h2>";
emailBodyHtml += `<p>Dear ${userFullName},</p>`;
emailBodyHtml +=
  "<p>Thank you for contacting us. We have received your support request and our team is reviewing it.</p>";

if (issueIid && issueUrl) {
  emailBodyHtml += `<p><strong>Request Reference:</strong> <a href='${issueUrl}' style='color: #3498db;'>Issue #${issueIid}</a></p>`;
}

emailBodyHtml +=
  "<p>We will get back to you as soon as possible. Our support team typically responds within 24 hours during business days.</p>";
emailBodyHtml += "<h3 style='color: #2c3e50; margin-top: 30px;'>Need Immediate Assistance?</h3>";
emailBodyHtml +=
  "<p>You can also discuss your topic with our Support agent directly in Tealfabric IO:</p>";
emailBodyHtml +=
  "<p style='margin: 20px 0;'><a href='https://tealfabric.io' style='background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;'>Open Support Chat</a></p>";
emailBodyHtml +=
  "<p style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9em;'>Best regards,<br>Support Team</p>";
emailBodyHtml += "</div></body></html>";

let emailBodyText = "Support Request Received\n\n";
emailBodyText += `Dear ${userFullName},\n\n`;
emailBodyText +=
  "Thank you for contacting us. We have received your support request and our team is reviewing it.\n\n";

if (issueIid && issueUrl) {
  emailBodyText += `Request Reference: Issue #${issueIid}\nView issue: ${issueUrl}\n\n`;
}

emailBodyText +=
  "We will get back to you as soon as possible. Our support team typically responds within 24 hours during business days.\n\n";
emailBodyText += "Best regards,\nSupport Team\n";

const result = await integration.executeSync(integrationId, {
  operation: "send",
  to: userEmail,
  subject: emailSubject,
  body: emailBodyText,
  html_body: emailBodyHtml,
  is_html: true,
});

if (!result.success) {
  const errorMessage = String(result.error ?? "Email send failed");
  tf.log("error", "Email notification failed", { errorMessage });
  return {
    success: false,
    error: {
      code: "EMAIL_SEND_FAILED",
      message: "Failed to send email notification",
      details: errorMessage,
    },
    data: { email_sent: false, user_email: userEmail, user_full_name: userFullName },
  };
}

return {
  success: true,
  data: {
    email_sent: true,
    user_id: userId,
    user_email: userEmail,
    user_full_name: userFullName,
    email_subject: emailSubject,
    issue_iid: issueIid,
    issue_url: issueUrl,
  },
  message: `Successfully sent email notification to ${userFullName} (${userEmail})`,
};
