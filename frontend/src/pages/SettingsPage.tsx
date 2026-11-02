import { useAuth } from "../lib/auth/AuthContext";
import { getPlatformOrigin } from "../lib/auth/platformAuth";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

export function SettingsPage() {
  const { user } = useAuth();
  const origin = getPlatformOrigin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Environment and deployment reference."
      />

      <Card title="Platform user">
        <dl className="space-y-3 text-body">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">User ID</dt>
            <dd className="font-mono text-micro text-text-secondary">{user?.user_id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text">{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Role</dt>
            <dd className="text-text">{user?.role}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Endpoints">
        <dl className="space-y-3 text-body">
          <div>
            <dt className="text-text-muted">Platform origin</dt>
            <dd className="break-all font-mono text-micro text-text-secondary">{origin || "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Auth</dt>
            <dd className="font-mono text-micro text-text-secondary">
              BFF auth_login → WebApp JWT Bearer
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">BFF</dt>
            <dd className="font-mono text-micro text-text-secondary">
              WebApp POST {"{ action, ... }"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Local development">
        <pre className="overflow-x-auto rounded-md bg-bg-muted p-3 font-mono text-micro text-text-secondary">
{`# frontend/.env.local
VITE_BFF_URL=https://dev.tealfabric.io/app-model
VITE_ROUTER_BASENAME=/app-model`}
        </pre>
      </Card>
    </div>
  );
}
