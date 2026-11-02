import { useEffect, useState } from "react";
import { callBff } from "../lib/api/client";
import type { IntegrationSummary } from "../lib/api/types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await callBff<{ integrations: IntegrationSummary[] }>({
      action: "list_integrations",
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setIntegrations(res.data.integrations ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function probeStatus() {
    setProbing(true);
    setStatus(null);
    const res = await callBff<{ status: string; integration_id: string }>({
      action: "integration_status",
    });
    setProbing(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setStatus(`${res.data.integration_id}: ${res.data.status}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connector listing and health probe." />

      <Card title="Health probe">
        <Button variant="secondary" onClick={probeStatus} disabled={probing}>
          {probing ? "Probing…" : "Check example integration"}
        </Button>
        {status ? <p className="mt-2 text-sm text-text-secondary">{status}</p> : null}
      </Card>

      <Card title="Tenant integrations">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : integrations.length === 0 ? (
          <p className="text-sm text-text-muted">No integrations returned.</p>
        ) : (
          <ul className="divide-y divide-border-subtle text-sm">
            {integrations.map((item) => (
              <li key={item.integration_id} className="flex justify-between py-3">
                <div>
                  <div className="font-medium">{item.name ?? item.integration_id}</div>
                  <div className="text-micro text-text-muted">{item.connector_type}</div>
                </div>
                <span className="text-micro text-text-secondary">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
