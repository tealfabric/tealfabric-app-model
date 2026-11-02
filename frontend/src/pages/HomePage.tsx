import { useEffect, useState } from "react";
import { callBff } from "../lib/api/client";
import { useAuth } from "../lib/auth/AuthContext";
import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callBff<{ status: string; app: string }>({ action: "health" })
      .then((res) => {
        if (res.success) setHealth(res.data.status);
        else setError(res.error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome"
        description="App Model reference app — prototype UI with platform-backed BFF."
      />

      <Card title="Session">
        <dl className="grid gap-3 text-body sm:grid-cols-2">
          <div>
            <dt className="text-small text-text-muted">User</dt>
            <dd className="text-text">{user?.full_name ?? user?.email}</dd>
          </div>
          <div>
            <dt className="text-small text-text-muted">Role</dt>
            <dd className="text-text">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-small text-text-muted">Tenant</dt>
            <dd className="font-mono text-micro text-text-secondary">{user?.tenant_id ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card title="BFF health">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <p className="text-body text-text-secondary">
            Router status: <strong className="text-text">{health ?? "unknown"}</strong>
          </p>
        )}
      </Card>

      <Card title="Architecture">
        <ul className="list-disc space-y-1 pl-5 text-body text-text-secondary">
          <li>React SPA delivered from tenant CDN via WebApp shell</li>
          <li>WebApp JWT Bearer (`webapp_access`) via BFF login</li>
          <li>ProcessFlow BFF for DataPool, files, integrations</li>
          <li>Sandbox-compliant TypeScript process steps</li>
        </ul>
      </Card>
    </div>
  );
}
