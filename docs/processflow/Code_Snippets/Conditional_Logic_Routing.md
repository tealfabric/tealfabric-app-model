# Conditional Logic & Routing

**TypeScript preferred** — new-sandbox. See [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers decision-making and workflow routing within ProcessFlow code snippets.

## Overview

Conditional logic controls process flow based on data conditions. These operations evaluate input and determine the next step, enabling branching workflows.

```
                                    ┌─────────────┐
                              ┌────▶│  Route A    │
┌─────────────────┐     ┌─────┴─────┐     └─────────────┘
│   Input Data    │────▶│ Condition │
└─────────────────┘     │  Check    │     ┌─────────────┐
                        └─────┬─────┘────▶│  Route B    │
                              │           └─────────────┘
                              └──────────▶┌─────────────┐
                                          │  Route C    │
                                          └─────────────┘
```

## Routing Output

ProcessFlow uses the `route` field in output to control branching:

```typescript
return {
  success: true,
  route: "approved", // Determines next step
  data: processedData,
};
```

---

## Example 1: Simple Condition Check

Basic boolean condition evaluation:

```typescript
const data = (process_input.result ?? {}) as Record<string, unknown>;
const condition = (data.condition ?? {}) as Record<string, unknown>;

const field = String(condition.field ?? "");
const operator = String(condition.operator ?? "equals");
const value = condition.value ?? null;
const targetValue = data[field] ?? null;

let result = false;
const strTarget = String(targetValue ?? "");
const listValue = Array.isArray(value) ? value : [value];

switch (operator) {
  case "equals":
  case "==":
    result = targetValue == value;
    break;
  case "not_equals":
  case "!=":
    result = targetValue != value;
    break;
  case "greater_than":
  case ">":
    result = Number(targetValue) > Number(value);
    break;
  case "less_than":
  case "<":
    result = Number(targetValue) < Number(value);
    break;
  case "greater_or_equal":
  case ">=":
    result = Number(targetValue) >= Number(value);
    break;
  case "less_or_equal":
  case "<=":
    result = Number(targetValue) <= Number(value);
    break;
  case "contains":
    result = strTarget.includes(String(value));
    break;
  case "not_contains":
    result = !strTarget.includes(String(value));
    break;
  case "starts_with":
    result = strTarget.startsWith(String(value));
    break;
  case "ends_with":
    result = strTarget.endsWith(String(value));
    break;
  case "is_empty":
    result = targetValue === null || targetValue === "" || (Array.isArray(targetValue) && targetValue.length === 0);
    break;
  case "is_not_empty":
    result = targetValue !== null && targetValue !== "" && !(Array.isArray(targetValue) && targetValue.length === 0);
    break;
  case "in":
    result = listValue.includes(targetValue);
    break;
  case "not_in":
    result = !listValue.includes(targetValue);
    break;
  case "regex":
    result = new RegExp(String(value)).test(strTarget);
    break;
}

return {
  success: true,
  route: result ? "true" : "false",
  data: {
    condition_met: result,
    field,
    operator,
    value,
    actual_value: targetValue,
  },
};
```

---

## Example 2: Multi-Condition Evaluation (AND/OR)

Evaluate multiple conditions with logical operators:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const rules = (process_input.result?.rules ?? []) as Record<string, unknown>[];
const logic = String(process_input.result?.logic ?? "AND").toUpperCase();

if (rules.length === 0) {
  return {
    success: true,
    route: "no_rules",
    data: { message: "No rules to evaluate" },
  };
}

function evaluateCondition(row: Record<string, unknown>, rule: Record<string, unknown>): boolean {
  const field = String(rule.field ?? "");
  const operator = String(rule.operator ?? "equals");
  const value = rule.value ?? null;

  let fieldValue: unknown = row;
  for (const key of field.split(".")) {
    fieldValue = (fieldValue as Record<string, unknown>)?.[key] ?? null;
  }

  const between = Array.isArray(value) ? value : [];

  switch (operator) {
    case "equals": return fieldValue == value;
    case "not_equals": return fieldValue != value;
    case "greater_than": return Number(fieldValue) > Number(value);
    case "less_than": return Number(fieldValue) < Number(value);
    case "greater_or_equal": return Number(fieldValue) >= Number(value);
    case "less_or_equal": return Number(fieldValue) <= Number(value);
    case "contains": return String(fieldValue).includes(String(value));
    case "is_empty":
      return fieldValue === null || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== "" && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case "in": return (Array.isArray(value) ? value : [value]).includes(fieldValue);
    case "between": return Number(fieldValue) >= Number(between[0]) && Number(fieldValue) <= Number(between[1]);
    default: return false;
  }
}

const results = rules.map((rule, index) => ({
  rule_index: index,
  field: rule.field,
  passed: evaluateCondition(data, rule),
}));

const passedCount = results.filter((r) => r.passed).length;
const totalRules = rules.length;

let finalResult: boolean;
switch (logic) {
  case "AND":
  case "ALL":
    finalResult = passedCount === totalRules;
    break;
  case "OR":
  case "ANY":
    finalResult = passedCount > 0;
    break;
  case "NONE":
    finalResult = passedCount === 0;
    break;
  default:
    finalResult = passedCount === totalRules;
}

return {
  success: true,
  route: finalResult ? "pass" : "fail",
  data: {
    result: finalResult,
    logic,
    rules_passed: passedCount,
    rules_total: totalRules,
    rule_results: results,
  },
};
```

---

## Example 3: Approval Workflow Routing

Route based on approval thresholds:

```typescript
const request = (process_input.result ?? {}) as Record<string, unknown>;

const amount = Number(request.amount ?? 0);
const requestType = String(request.type ?? "standard");
const priority = String(request.priority ?? "normal");
const department = String(request.department ?? "");
const requesterLevel = Number(request.requester_level ?? 1);

const rules = {
  auto_approve: { max_amount: 100, types: ["supplies", "maintenance"], min_requester_level: 3 },
  manager_approval: { max_amount: 5000, types: ["standard", "supplies", "maintenance", "equipment"] },
  director_approval: { max_amount: 25000, types: ["standard", "equipment", "services"] },
  executive_approval: { max_amount: 100000, types: ["standard", "equipment", "services", "capital"] },
};

let route = "executive_approval";
let approvalLevel = 4;
let reason = "";

if (
  amount <= rules.auto_approve.max_amount &&
  rules.auto_approve.types.includes(requestType) &&
  requesterLevel >= rules.auto_approve.min_requester_level
) {
  route = "auto_approve";
  approvalLevel = 0;
  reason = "Within auto-approval limits";
} else if (amount <= rules.manager_approval.max_amount && rules.manager_approval.types.includes(requestType)) {
  route = "manager_approval";
  approvalLevel = 1;
  reason = "Requires manager approval";
} else if (amount <= rules.director_approval.max_amount && rules.director_approval.types.includes(requestType)) {
  route = "director_approval";
  approvalLevel = 2;
  reason = "Requires director approval";
} else if (amount <= rules.executive_approval.max_amount) {
  route = "executive_approval";
  approvalLevel = 3;
  reason = "Requires executive approval";
} else {
  route = "board_approval";
  approvalLevel = 4;
  reason = "Requires board approval";
}

if (priority === "urgent" && approvalLevel > 0) {
  route = `urgent_${route}`;
  reason += " (Urgent priority)";
}

return {
  success: true,
  route,
  data: {
    approval_level: approvalLevel,
    reason,
    request_details: { amount, type: requestType, priority, department },
  },
};
```

---

## Example 4: Status-Based Routing

Route based on entity status:

```typescript
const entity = (process_input.result?.entity ?? {}) as Record<string, unknown>;
const action = String(process_input.result?.action ?? "");

const currentStatus = String(entity.status ?? "unknown");
const entityType = String(entity.type ?? "generic");

const stateTransitions: Record<string, Record<string, Record<string, string>>> = {
  order: {
    draft: { submit: "pending", delete: "deleted" },
    pending: { approve: "approved", reject: "rejected", cancel: "cancelled" },
    approved: { process: "processing", cancel: "cancelled" },
    processing: { ship: "shipped", fail: "failed" },
    shipped: { deliver: "delivered", return: "returned" },
    delivered: { complete: "completed", return: "returned" },
    rejected: { resubmit: "pending" },
    cancelled: { reopen: "draft" },
    failed: { retry: "processing", cancel: "cancelled" },
  },
  ticket: {
    new: { assign: "assigned", close: "closed" },
    assigned: { start: "in_progress", reassign: "assigned", close: "closed" },
    in_progress: { resolve: "resolved", escalate: "escalated", block: "blocked" },
    blocked: { unblock: "in_progress", escalate: "escalated" },
    escalated: { resolve: "resolved", close: "closed" },
    resolved: { reopen: "in_progress", close: "closed" },
    closed: { reopen: "new" },
  },
};

const transitions = stateTransitions[entityType] ?? {};
const validActions = transitions[currentStatus] ?? {};

if (!(action in validActions)) {
  return {
    success: false,
    route: "invalid_transition",
    data: {
      error: { code: "VALIDATION_ERROR", message: `Action '${action}' not allowed for status '${currentStatus}'` },
      current_status: currentStatus,
      requested_action: action,
      valid_actions: Object.keys(validActions),
    },
  };
}

const newStatus = validActions[action];

return {
  success: true,
  route: action,
  data: {
    entity_type: entityType,
    previous_status: currentStatus,
    action,
    new_status: newStatus,
    entity: { ...entity, status: newStatus },
    valid_next_actions: Object.keys(transitions[newStatus] ?? {}),
  },
};
```

---

## Example 5: Decision Tree Evaluation

Evaluate a decision tree structure:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const tree = process_input.result?.decision_tree as Record<string, unknown> | undefined;

/**
 * Decision tree node format:
 * {
 *   condition: { field: "amount", operator: ">", value: 1000 },
 *   true_branch: { ... next node or result },
 *   false_branch: { ... next node or result },
 *   result: "final_outcome"  // Only in leaf nodes
 * }
 */

function evaluateCondition(row: Record<string, unknown>, condition: Record<string, unknown>): boolean {
  const field = String(condition.field ?? "");
  const operator = String(condition.operator ?? "==");
  const value = condition.value ?? null;
  const fieldValue = row[field] ?? null;

  switch (operator) {
    case "==":
    case "equals": return fieldValue == value;
    case "!=":
    case "not_equals": return fieldValue != value;
    case ">": return Number(fieldValue) > Number(value);
    case "<": return Number(fieldValue) < Number(value);
    case ">=": return Number(fieldValue) >= Number(value);
    case "<=": return Number(fieldValue) <= Number(value);
    case "in": return (Array.isArray(value) ? value : [value]).includes(fieldValue);
    case "contains": return String(fieldValue).includes(String(value));
    default: return false;
  }
}

function evaluateNode(
  node: Record<string, unknown>,
  row: Record<string, unknown>,
  path: { condition: unknown; result: boolean }[] = []
): { result: string; path: typeof path; error?: { code: string; message: string } } {
  if ("result" in node) {
    return { result: String(node.result), path };
  }

  if (!node.condition) {
    return { result: "error", path, error: { code: "VALIDATION_ERROR", message: "Invalid node structure" } };
  }

  const conditionMet = evaluateCondition(row, node.condition as Record<string, unknown>);
  const nextPath = [...path, { condition: node.condition, result: conditionMet }];

  const nextNode = conditionMet
    ? (node.true_branch as Record<string, unknown> | undefined)
    : (node.false_branch as Record<string, unknown> | undefined);

  if (!nextNode) {
    return { result: "no_path", path: nextPath };
  }

  return evaluateNode(nextNode, row, nextPath);
}

if (!tree || Object.keys(tree).length === 0) {
  return {
    success: false,
    route: "no_tree",
    error: { code: "VALIDATION_ERROR", message: "No decision tree provided" },
    data: null,
  };
}

const evaluation = evaluateNode(tree, data);

return {
  success: true,
  route: evaluation.result,
  data: {
    decision: evaluation.result,
    evaluation_path: evaluation.path,
    input_data: data,
  },
};
```

---

## Example 6: Rule Engine

Configurable rule-based routing:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const rules = [...((process_input.result?.rules ?? []) as Record<string, unknown>[])];
const defaultRoute = String(process_input.result?.default_route ?? "default");

function evaluateCondition(row: Record<string, unknown>, cond: Record<string, unknown>): boolean {
  const fieldPath = String(cond.field ?? "");
  const operator = String(cond.operator ?? "==");
  const value = cond.value ?? null;

  let fieldValue: unknown = row;
  for (const key of fieldPath.split(".")) {
    fieldValue = (fieldValue as Record<string, unknown>)?.[key] ?? null;
  }

  switch (operator) {
    case "==":
    case "equals": return fieldValue == value;
    case "!=":
    case "not_equals": return fieldValue != value;
    case ">": return typeof fieldValue === "number" && fieldValue > Number(value);
    case "<": return typeof fieldValue === "number" && fieldValue < Number(value);
    case ">=": return typeof fieldValue === "number" && fieldValue >= Number(value);
    case "<=": return typeof fieldValue === "number" && fieldValue <= Number(value);
    case "in": return (Array.isArray(value) ? value : [value]).includes(fieldValue);
    case "not_in": return !(Array.isArray(value) ? value : [value]).includes(fieldValue);
    case "contains": return typeof fieldValue === "string" && fieldValue.includes(String(value));
    case "is_empty":
      return fieldValue === null || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== "" && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case "regex": return typeof fieldValue === "string" && new RegExp(String(value)).test(fieldValue);
    default: return false;
  }
}

rules.sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));

let matchedRule: Record<string, unknown> | null = null;
const evaluatedRules: Record<string, unknown>[] = [];

for (const rule of rules) {
  const conditions = (rule.conditions ?? []) as Record<string, unknown>[];
  const logic = String(rule.logic ?? "AND").toUpperCase();
  const conditionResults = conditions.map((c) => evaluateCondition(data, c));

  const passes =
    logic === "OR"
      ? conditionResults.some(Boolean)
      : conditionResults.every(Boolean);

  evaluatedRules.push({
    name: rule.name ?? "Unnamed",
    priority: rule.priority ?? 999,
    matched: passes,
    route: rule.route ?? "unknown",
  });

  if (passes && matchedRule === null) {
    matchedRule = rule;
  }
}

const route = String(matchedRule?.route ?? defaultRoute);

return {
  success: true,
  route,
  data: {
    matched_rule: matchedRule?.name ?? null,
    evaluated_rules: evaluatedRules,
    total_rules: rules.length,
  },
};
```

---

## Example 7: Time-Based Routing

Route based on time/schedule:

```typescript
const data = (process_input.result ?? {}) as Record<string, unknown>;
const timezone = String(data.timezone ?? "UTC");

const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
const hour = now.getHours();
const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Monday, 7=Sunday
const dayOfMonth = now.getDate();
const month = now.getMonth() + 1;

let route = "standard";
let reason = "";

const isBusinessHours = hour >= 9 && hour < 17 && dayOfWeek >= 1 && dayOfWeek <= 5;
const isWeekend = dayOfWeek >= 6;
const isPeakHours = hour >= 10 && hour < 14;

const holidays: Record<string, string> = {
  "1-1": "New Year",
  "12-25": "Christmas",
  "12-26": "Boxing Day",
};
const dateKey = `${month}-${dayOfMonth}`;
const isHoliday = dateKey in holidays;

if (isHoliday) {
  route = "holiday_queue";
  reason = `Holiday: ${holidays[dateKey] ?? "Unknown"}`;
} else if (isWeekend) {
  route = "weekend_queue";
  reason = "Weekend support";
} else if (!isBusinessHours) {
  route = "after_hours_queue";
  reason = "Outside business hours";
} else if (isPeakHours) {
  route = "peak_hours_queue";
  reason = "Peak hours - additional capacity";
} else {
  route = "standard_queue";
  reason = "Normal business hours";
}

const priority = String(data.priority ?? "normal");
if (priority === "urgent") {
  route = `urgent_${route}`;
  reason += " (Urgent priority override)";
}

return {
  success: true,
  route,
  data: {
    reason,
    time_info: {
      current_time: now.toISOString(),
      timezone,
      hour,
      day_of_week: dayOfWeek,
      is_business_hours: isBusinessHours,
      is_weekend: isWeekend,
      is_holiday: isHoliday,
      is_peak_hours: isPeakHours,
    },
  },
};
```

---

## Example 8: Error Handling and Retry Logic

Route based on errors and retry attempts:

```typescript
const execution = (process_input.result ?? {}) as Record<string, unknown>;

const success = Boolean(execution.success ?? false);
const error = execution.error ?? null;
const errorCode = String(execution.error_code ?? "");
const retryCount = Number(execution.retry_count ?? 0);
const maxRetries = Number(execution.max_retries ?? 3);

const retryableErrors = ["TIMEOUT", "CONNECTION_REFUSED", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "TEMPORARY_ERROR"];
const fatalErrors = ["AUTHENTICATION_FAILED", "INVALID_REQUEST", "NOT_FOUND", "VALIDATION_ERROR", "FORBIDDEN"];

let route = "unknown";
let action = "unknown";
let delay = 0;

if (success) {
  route = "success";
  action = "continue";
} else if (fatalErrors.includes(errorCode)) {
  route = "fatal_error";
  action = "abort";
} else if (retryableErrors.includes(errorCode)) {
  if (retryCount < maxRetries) {
    route = "retry";
    action = "retry";
    delay = Math.min(Math.pow(2, retryCount) * 1000, 30000);
  } else {
    route = "max_retries_exceeded";
    action = "escalate";
  }
} else if (retryCount < maxRetries) {
  route = "retry";
  action = "retry";
  delay = 5000;
} else {
  route = "unknown_error";
  action = "manual_review";
}

const nextRetryAt = delay > 0 ? new Date(Date.now() + delay).toISOString() : null;

return {
  success: true,
  route,
  data: {
    action,
    original_success: success,
    error_code: errorCode,
    error_message: error,
    retry_info: {
      current_attempt: retryCount + 1,
      max_attempts: maxRetries,
      should_retry: action === "retry",
      delay_ms: delay,
      next_retry_at: nextRetryAt,
    },
  },
};
```

---

## Best Practices

### 1. Use Clear Route Names

```typescript
// Good
const route = "approve_standard";
const route = "reject_insufficient_funds";
const route = "escalate_to_manager";

// Avoid
const route = "r1";
const route = "path_a";
```

### 2. Always Have a Default Route

```typescript
const route = matchedRoute ?? "default";
```

### 3. Log Routing Decisions

```typescript
tf.log("info", `Routing to: ${route}`, { reason });
```

### 4. Return Decision Context

```typescript
return {
  success: true,
  route,
  data: {
    reason,
    evaluated_conditions: conditions,
    input_summary: summary,
  },
};
```

---

## See Also

- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
- [Process-to-Process Communication](Process_Communication.md)
- [ProcessFlow Event Handling Guide](../PROCESSFLOW_EVENT_HANDLING_GUIDE.md)
