import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar, type AppNavItem } from "./app/AppSidebar";

const NAV: AppNavItem[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/items", label: "Items", icon: "collection" },
  { to: "/files", label: "Files", icon: "document" },
  { to: "/integrations", label: "Integrations", icon: "link" },
  { to: "/settings", label: "Settings", icon: "cog" },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg p-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-text-secondary hover:bg-bg-subtle"
          aria-label="Open sidebar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-small font-semibold text-text">App Model</span>
        <span className="w-9" />
      </header>

      <AppSidebar
        appName="App Model"
        navItems={NAV}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto px-4 pb-4 pt-4 md:px-8 md:pb-8 md:pt-8">
          <div className="page-container flex flex-1 flex-col gap-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
