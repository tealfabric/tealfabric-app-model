import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";
import { AuthShell } from "../components/auth/studio/AuthShell";
import { AuthCard } from "../components/auth/studio/AuthCard";
import { AuthIntro } from "../components/auth/studio/AuthIntro";
import { StudioTextInput } from "../components/auth/studio/StudioTextInput";
import { StudioButton } from "../components/auth/studio/StudioButton";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Spinner } from "../components/ui/Spinner";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-subtle">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <Spinner />
          <p className="text-small">Checking session</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const message = await login(email, password);
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle px-4 py-10">
      <AuthShell wide>
        <AuthCard className="mx-auto max-w-3xl">
          <div className="grid min-h-[28rem] grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col justify-center bg-gradient-to-br from-[#0e7c6b] to-[#0b6356] px-8 py-12 text-text-inverse md:px-10">
              <p className="font-display text-base font-semibold">App Model</p>
              <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">
                TealFabric reference app
              </h2>
              <p className="mt-4 text-base text-white/80">
                ProcessFlow BFF, DataPool, storage, and integrations — signed in with your
                platform user account.
              </p>
            </div>

            <div className="flex flex-col justify-center px-8 py-12 md:px-10">
              <AuthIntro eyebrow="Welcome back" title="Sign in">
                Use your TealFabric platform credentials.
              </AuthIntro>

              <form onSubmit={onSubmit} className="mt-8 space-y-0">
                <div className="overflow-hidden rounded-2xl">
                  <StudioTextInput
                    label="Email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <StudioTextInput
                    label="Password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? (
                  <div className="mt-4">
                    <ErrorMessage message={error} />
                  </div>
                ) : null}
                <div className="mt-6">
                  <StudioButton type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Signing in…" : "Sign in"}
                  </StudioButton>
                </div>
              </form>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    </div>
  );
}
