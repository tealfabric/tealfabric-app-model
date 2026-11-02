# Email Sending

**TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers sending emails within ProcessFlow code snippets using the email service.

## Overview

The `email` service provides email sending capabilities with template support, priority queuing, and delivery tracking.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│    email         │────▶│  Email Queue    │
│  (Send)         │     │    Service       │     │  → Delivery     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Services

| Service | Description |
|---------|-------------|
| `email` | Email sending via `email.send(payload)` |
| `notification` | In-app notifications (`send`, `dispatch`, `update`, `remove`) |

## Email Service

Send email through the platform queue:

```typescript
await email.send({
  to: "user@example.com",
  subject: "Subject line",
  html: "<p>Body</p>",       // or text: "plain body"
  process_id: process_id,
});
```

Shared helpers used in the examples below:

```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

---

## Example 1: Send Simple Email

Send a basic email:

```typescript
const to = String(process_input.result?.to ?? "");
const subject = String(process_input.result?.subject ?? "");
const body = String(process_input.result?.body ?? "");
const isHtml = process_input.result?.is_html !== false;

if (!to || !subject || !body) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Missing required fields: to, subject, and body are required" },
    data: null,
  };
}

if (!isValidEmail(to)) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email address" }, data: null };
}

try {
  const htmlBody = isHtml ? body : escapeHtml(body).replace(/\n/g, "<br>");

  await email.send({
    to,
    subject,
    html: htmlBody,
    process_id: process_id,
  });

  tf.log("info", "Email queued successfully", { to });

  return {
    success: true,
    data: { recipient: to, subject, queued: true },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  tf.log("error", "Email failed", { message: err.message });

  return { success: false, error: { code: "RUNTIME_ERROR", message: `Email error: ${err.message}` }, data: null };
}
```

---

## Example 2: Email with Template

Send email using HTML template:

```typescript
const to = String(process_input.result?.to ?? "");
const subject = String(process_input.result?.subject ?? "");
const templateData = (process_input.result?.template_data ?? {}) as Record<string, string>;
const templateName = String(process_input.result?.template ?? "default");

if (!to || !subject) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Recipient and subject required" }, data: null };
}

const templates: Record<string, string> = {
  welcome: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome, {{name}}!</h1>
      <p>Thank you for joining us. We're excited to have you on board.</p>
      <p>Your account has been created successfully.</p>
      <div style="margin: 20px 0;">
        <a href="{{login_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Get Started
        </a>
      </div>
      <p style="color: #666; font-size: 12px;">
        If you didn't create this account, please contact support.
      </p>
    </div>
  `,
  notification: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">{{title}}</h2>
      <p>{{message}}</p>
      {{#if action_url}}
      <div style="margin: 20px 0;">
        <a href="{{action_url}}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          {{action_text}}
        </a>
      </div>
      {{/if}}
    </div>
  `,
  alert: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #dc3545; padding-left: 15px;">
      <h2 style="color: #dc3545;">⚠️ {{title}}</h2>
      <p>{{message}}</p>
      <p style="color: #666; font-size: 12px;">Time: {{timestamp}}</p>
    </div>
  `,
  default: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      {{content}}
    </div>
  `,
};

let htmlBody = templates[templateName] ?? templates.default;

for (const [key, value] of Object.entries(templateData)) {
  htmlBody = htmlBody.replaceAll(`{{${key}}}`, escapeHtml(String(value)));
}

htmlBody = htmlBody.replace(
  /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
  (_, condition, content) => (templateData[condition] ? content : "")
);
htmlBody = htmlBody.replace(/\{\{[^}]+\}\}/g, "");

try {
  await email.send({ to, subject, html: htmlBody, process_id: process_id });

  return {
    success: true,
    data: { recipient: to, subject, template: templateName, queued: true },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return { success: false, error: { code: "RUNTIME_ERROR", message: `Email error: ${err.message}` }, data: null };
}
```

---

## Example 3: Batch Email Sending

Send emails to multiple recipients:

```typescript
const recipients = (process_input.result?.recipients ?? []) as Array<
  string | Record<string, string>
>;
const subject = String(process_input.result?.subject ?? "");
const bodyTemplate = String(process_input.result?.body_template ?? "");

if (!recipients.length || !subject || !bodyTemplate) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Recipients, subject, and body_template required" }, data: null };
}

const results: {
  sent: string[];
  failed: Array<{ email: string; error: string }>;
  invalid: Array<{ email: string; error: string }>;
} = { sent: [], failed: [], invalid: [] };

for (const recipient of recipients) {
  const toEmail = typeof recipient === "object" ? String(recipient.email ?? "") : recipient;
  const personalData =
    typeof recipient === "object" ? recipient : { email: toEmail };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    results.invalid.push({ email: toEmail, error: { code: "VALIDATION_ERROR", message: "Invalid email format" } });
    continue;
  }

  let body = bodyTemplate;
  let personalizedSubject = subject;
  for (const [key, value] of Object.entries(personalData)) {
    body = body.replaceAll(`{{${key}}}`, escapeHtml(String(value)));
    personalizedSubject = personalizedSubject.replaceAll(`{{${key}}}`, String(value));
  }

  try {
    await email.send({
      to: toEmail,
      subject: personalizedSubject,
      html: body,
      process_id: process_id,
    });
    results.sent.push(toEmail);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    results.failed.push({ email: toEmail, error: err.message });
  }
}

tf.log("info", "Batch email complete", {
  sent: results.sent.length,
  failed: results.failed.length,
  invalid: results.invalid.length,
});

return {
  success: results.failed.length === 0 && results.invalid.length === 0,
  data: {
    total_recipients: recipients.length,
    sent_count: results.sent.length,
    failed_count: results.failed.length,
    invalid_count: results.invalid.length,
    results,
  },
};
```

---

## Example 4: Order Confirmation Email

Send formatted order confirmation:

```typescript
const order = (process_input.result?.order ?? {}) as Record<string, unknown>;
const customerEmail = String((order as { customer_email?: string }).customer_email ?? "");

if (!customerEmail || !Object.keys(order).length) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Order data and customer email required" }, data: null };
}

const items = (order.items ?? []) as Array<Record<string, unknown>>;
let itemsHtml = "";
let subtotal = 0;

for (const item of items) {
  const price = Number(item.price ?? 0);
  const qty = Number(item.quantity ?? 1);
  const itemTotal = price * qty;
  subtotal += itemTotal;
  itemsHtml += `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(String(item.name ?? "Product"))}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${qty}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${price.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${itemTotal.toFixed(2)}</td>
    </tr>`;
}

const shipping = Number(order.shipping ?? 0);
const tax = subtotal * 0.24;
const total = subtotal + tax + shipping;
const orderNumber = String(order.order_number ?? "N/A");
const shippingAddress = (order.shipping_address ?? {}) as Record<string, string>;

const createdAt = order.created_at
  ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
      new Date(String(order.created_at))
    )
  : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
      new Date()
    );

const subject = `Order Confirmation #${orderNumber}`;
const body = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #333;">Thank you for your order!</h1>
    <p>Hi ${escapeHtml(String(order.customer_name ?? "Customer"))},</p>
    <p>We've received your order and are processing it now.</p>
    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <strong>Order Number:</strong> ${escapeHtml(orderNumber)}<br>
      <strong>Order Date:</strong> ${createdAt}
    </div>
    <h2 style="color: #333;">Order Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #333; color: white;">
          <th style="padding: 10px; text-align: left;">Product</th>
          <th style="padding: 10px; text-align: center;">Qty</th>
          <th style="padding: 10px; text-align: right;">Price</th>
          <th style="padding: 10px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="margin-top: 20px; text-align: right;">
      <p>Subtotal: €${subtotal.toFixed(2)}</p>
      <p>VAT (24%): €${tax.toFixed(2)}</p>
      <p>Shipping: €${shipping.toFixed(2)}</p>
      <p style="font-size: 18px; font-weight: bold;">Total: €${total.toFixed(2)}</p>
    </div>
    <h2 style="color: #333;">Shipping Address</h2>
    <p>
      ${escapeHtml(shippingAddress.name ?? "")}<br>
      ${escapeHtml(shippingAddress.street ?? "")}<br>
      ${escapeHtml(shippingAddress.postal_code ?? "")} ${escapeHtml(shippingAddress.city ?? "")}<br>
      ${escapeHtml(shippingAddress.country ?? "")}
    </p>
    <p style="margin-top: 30px;">If you have any questions, reply to this email or contact our support.</p>
  </div>`;

try {
  await email.send({ to: customerEmail, subject, html: body, process_id: process_id });

  return {
    success: true,
    data: { recipient: customerEmail, order_number: orderNumber, queued: true },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return { success: false, error: { code: "RUNTIME_ERROR", message: `Failed to send order confirmation: ${err.message}` }, data: null };
}
```

---

## Example 5: Alert/Notification Email

Send system alerts and notifications:

```typescript
const alertType = String(process_input.result?.type ?? "info");
const title = String(process_input.result?.title ?? "");
const message = String(process_input.result?.message ?? "");
const recipients = (process_input.result?.recipients ?? []) as string[];
const details = (process_input.result?.details ?? {}) as Record<string, unknown>;

if (!title || !message || !recipients.length) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Title, message, and recipients required" }, data: null };
}

const styles: Record<string, { color: string; icon: string; label: string }> = {
  info: { color: "#17a2b8", icon: "ℹ️", label: "Information" },
  warning: { color: "#ffc107", icon: "⚠️", label: "Warning" },
  error: { color: "#dc3545", icon: "❌", label: "Error" },
  critical: { color: "#721c24", icon: "🚨", label: "Critical" },
};

const style = styles[alertType] ?? styles.info;

let detailsHtml = "";
if (Object.keys(details).length) {
  detailsHtml =
    '<div style="background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; font-family: monospace; font-size: 12px;">';
  for (const [key, value] of Object.entries(details)) {
    const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    detailsHtml += `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(displayValue)}<br>`;
  }
  detailsHtml += "</div>";
}

const subject = `[${style.label}] ${title}`;
const timestamp = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZoneName: "short",
}).format(new Date());

const body = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="border-left: 4px solid ${style.color}; padding-left: 15px;">
      <h1 style="color: ${style.color};">${style.icon} ${escapeHtml(title)}</h1>
      <p style="font-size: 16px;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    </div>
    ${detailsHtml}
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
      <p>Timestamp: ${timestamp}</p>
      <p>Alert Type: ${style.label}</p>
      <p>Tenant: ${escapeHtml(String(tenant_id ?? "N/A"))}</p>
    </div>
  </div>`;

const results: { sent: string[]; failed: string[] } = { sent: [], failed: [] };

for (const recipient of recipients) {
  try {
    await email.send({ to: recipient, subject, html: body, process_id: process_id });
    results.sent.push(recipient);
  } catch {
    results.failed.push(recipient);
  }
}

tf.log("info", "Alert email sent", {
  type: alertType,
  title,
  recipients: results.sent.length,
});

return {
  success: results.failed.length === 0,
  data: {
    alert_type: alertType,
    title,
    sent_count: results.sent.length,
    failed_count: results.failed.length,
    results,
  },
};
```

---

## Example 6: Email with Attachments Reference

Reference files for email (actual attachment handling via integration):

```typescript
/**
 * Note: Direct file attachments require integration setup.
 * This example shows how to reference files in email body.
 */

const to = String(process_input.result?.to ?? "");
const subject = String(process_input.result?.subject ?? "");
const message = String(process_input.result?.message ?? "");
const attachmentUrls = (process_input.result?.attachment_urls ?? []) as Array<
  string | { name?: string; url?: string }
>;

if (!to || !subject) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Recipient and subject required" }, data: null };
}

let attachmentsHtml = "";
if (attachmentUrls.length) {
  attachmentsHtml =
    '<div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">';
  attachmentsHtml += '<h3 style="margin-top: 0;">📎 Attachments</h3>';
  attachmentsHtml += '<ul style="list-style: none; padding: 0;">';

  for (const attachment of attachmentUrls) {
    const name =
      typeof attachment === "object"
        ? String(attachment.name ?? "File")
        : attachment.split("/").pop() ?? "File";
    const url =
      typeof attachment === "object"
        ? String(attachment.url ?? attachment)
        : attachment;
    attachmentsHtml += `<li style="margin: 5px 0;"><a href="${escapeHtml(url)}" style="color: #007bff;">${escapeHtml(name)}</a></li>`;
  }

  attachmentsHtml += "</ul></div>";
}

const body = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    ${escapeHtml(message).replace(/\n/g, "<br>")}
    ${attachmentsHtml}
  </div>`;

try {
  await email.send({ to, subject, html: body, process_id: process_id });

  return {
    success: true,
    data: {
      recipient: to,
      subject,
      attachment_count: attachmentUrls.length,
      queued: true,
    },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return { success: false, error: { code: "RUNTIME_ERROR", message: `Email error: ${err.message}` }, data: null };
}
```

---

## Best Practices

### 1. Validate Email Addresses
```typescript
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email" }, data: null };
}
```

### 2. Use HTML Email Templates
```typescript
let body = template;
for (const [key, value] of Object.entries(data)) {
  body = body.replaceAll(`{{${key}}}`, escapeHtml(String(value)));
}
```

### 3. Log Email Operations
```typescript
tf.log("info", "Email sent", { recipient, subject });
```

### 4. Handle Failures Gracefully
```typescript
try {
  await email.send({ to: recipient, subject, html: body, process_id: process_id });
} catch {
  await notification.send({
    process_id: process_id,
    title: "Email Delivery Failed",
    message: `Failed to send email to ${recipient}`,
    tenant_id: tenant_id,
  });
}
```

---

## Security Considerations

| ⚠️ Warning | Solution |
|------------|----------|
| Don't expose internal data | Sanitize all dynamic content with `escapeHtml` |
| Validate recipient addresses | Use regex or strict validation |
| Don't include sensitive data in URLs | Use secure tokens |
| Rate limit bulk sending | Process in batches |

---

## See Also

- [SMS/Push Notifications](Notifications.md)
- [Email MIME Parsing](Email_MIME_Parsing.md)

Related topics (template rendering, batch import/export) may be covered in platform or planned docs.
