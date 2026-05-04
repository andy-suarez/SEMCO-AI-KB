import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { countPendingUnanswered } from "@/lib/unanswered";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/kb", label: "Entries", end: true, key: "entries" },
  { to: "/kb/unanswered", label: "Unanswered", end: false, key: "unanswered" },
  { to: "/kb/sync", label: "Sync to Lyro", end: false, key: "sync" },
] as const;

export function KBSectionLayout() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Refresh badge on route change so promoting/dismissing reflects immediately.
  useEffect(() => {
    countPendingUnanswered()
      .then(setPendingCount)
      .catch(() => setPendingCount(null));
  }, [location.pathname]);

  return (
    <div className="space-y-6">
      <div className="border-b">
        <nav className="-mb-px flex gap-2">
          {tabs.map(({ to, label, end, key }) => (
            <NavLink
              key={key}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              {label}
              {key === "unanswered" && pendingCount !== null && pendingCount > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
