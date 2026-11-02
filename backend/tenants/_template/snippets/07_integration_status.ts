/**
 * integration_status — probe a configured integration (read-only).
 * Capabilities: connector, logging
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const integrationId = resolveIntegrationId();
if (!integrationId) {
  return appError(
    "INTEGRATION_NOT_CONFIGURED",
    "example_integration_id is not set in process configuration"
  );
}

try {
  if (typeof integration === "undefined" || !integration?.executeSync) {
    return {
      success: true,
      data: {
        integration_id: integrationId,
        status: "unknown",
        _prototype: true,
        message: "Connector capability not available — returning stub status",
      },
    };
  }

  const result = await integration.executeSync(integrationId, {
    operation: "health",
  });

  const body = parseConfigRecord(result);
  const healthy =
    body.success === true ||
    body.status === "ok" ||
    body.status === "healthy";

  return {
    success: true,
    data: {
      integration_id: integrationId,
      status: healthy ? "healthy" : "degraded",
      raw: body,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: true,
    data: {
      integration_id: integrationId,
      status: "error",
      error: message,
      _prototype: true,
    },
  };
}
