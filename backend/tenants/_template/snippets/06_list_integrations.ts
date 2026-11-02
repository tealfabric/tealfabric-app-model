/**
 * list_integrations — connector inventory prototype.
 * Capabilities: connector, api, logging
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const base = String(app_url ?? "").replace(/\/$/, "");
const listUrl = `${base}/api/v1/integrations?limit=50`;

try {
  const result = (await api.get(listUrl)) as Record<string, unknown>;
  const body = parseConfigRecord(result.data ?? result);
  const integrations =
    body.integrations ??
    body.data?.integrations ??
    body.results ??
    [];

  const rows = Array.isArray(integrations) ? integrations : [];
  const summarized = rows.map((row: unknown) => {
    const r = parseConfigRecord(row);
    return {
      integration_id: r.integration_id ?? r.id,
      name: r.name,
      connector_type: r.connector_type ?? r.type,
      status: r.status ?? "unknown",
    };
  });

  return {
    success: true,
    data: {
      integrations: summarized,
      total: summarized.length,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  tf.log("warn", "list_integrations failed", { message });
  return {
    success: true,
    data: {
      integrations: [],
      total: 0,
      _prototype: true,
      message: "Integration list unavailable in this environment",
    },
  };
}
