import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/Button";
import { NavIcon, type NavIconName } from "./NavIcon";
import { cn } from "../../lib/ui/cn";

export type AppNavItem = {
  to: string;
  label: string;
  icon: NavIconName;
  end?: boolean;
};

type AppSidebarProps = {
  appName: string;
  brandMark?: string;
  navItems: AppNavItem[];
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function AppSidebar({
  appName,
  brandMark = "TF",
  navItems,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [profileOpen]);

  const nav = (
    <nav className={cn("flex-1 overflow-y-auto py-4 min-h-0", collapsed ? "px-2" : "px-3")}>
      <ul role="list" className="space-y-7">
        <li>
          {!collapsed && (
            <div className="px-3 py-2 text-micro font-medium text-text-muted">Workspace</div>
          )}
          <ul role="list" className={cn("space-y-1", !collapsed && "mt-2")}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "nav-link",
                      collapsed && "justify-center px-2 w-full min-w-0",
                      isActive && "active"
                    )
                  }
                >
                  <NavIcon name={item.icon} />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </nav>
  );

  const footer = (
    <div className={cn("border-t border-border-subtle p-3", collapsed && "px-2")}>
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className={cn("nav-link w-full", collapsed ? "justify-center px-2" : "gap-2")}
          title={user?.email}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-subtle text-micro font-semibold text-brand">
            {(user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-left text-small text-text">
              {user?.email}
            </span>
          )}
        </button>
        {profileOpen ? (
          <div
            className={cn(
              "absolute z-40 rounded-md border border-border bg-bg py-1 shadow-modal",
              collapsed ? "left-full bottom-0 ml-2 w-56" : "bottom-full left-0 right-0 mb-2"
            )}
          >
            <div className="border-b border-border-subtle px-3 py-2">
              <p className="truncate text-small font-medium text-text">
                {user?.full_name ?? user?.email}
              </p>
              <p className="truncate text-micro text-text-muted">{user?.role}</p>
            </div>
            <div className="p-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setProfileOpen(false);
                  void logout();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-text/30"
            aria-label="Close menu"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-60 flex-col border-r border-border-subtle bg-bg shadow-modal">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-4">
              <span className="text-small font-semibold text-text">{appName}</span>
              <button
                type="button"
                className="rounded-sm p-2 text-text-secondary hover:bg-bg-subtle"
                onClick={onMobileClose}
                aria-label="Close sidebar"
              >
                ✕
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "relative hidden overflow-hidden border-r border-border-subtle bg-bg transition-all duration-300 ease-in-out md:sticky md:top-0 md:flex md:h-screen md:flex-none md:flex-col",
          collapsed ? "w-12" : "w-60"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute top-1/2 -right-2 z-10 flex h-12 w-3 items-center justify-center overflow-hidden rounded-md bg-border-strong transition-all hover:w-6 hover:bg-text-muted"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={cn("h-3 w-3 text-text-inverse", collapsed && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          className={cn(
            "flex shrink-0 items-center gap-3 border-b border-border-subtle p-4",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-micro font-bold text-text-inverse">
            {brandMark}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-small font-semibold text-text">{appName}</p>
              <p className="truncate text-micro text-text-muted">TealFabric app</p>
            </div>
          )}
        </div>

        {nav}
        {footer}
      </aside>
    </>
  );
}
