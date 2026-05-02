import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BookOpen, Inbox, LogOut, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { countPendingUnanswered } from "@/lib/unanswered";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "KB Entries", icon: BookOpen, end: true, key: "kb" },
  { to: "/unanswered", label: "Unanswered", icon: Inbox, end: false, key: "unanswered" },
  { to: "/sync", label: "Sync to Lyro", icon: RefreshCcw, end: false, key: "sync" },
] as const;

export function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Refresh the badge on mount and on every route change so promoting
  // an unanswered question and navigating away updates the count.
  useEffect(() => {
    countPendingUnanswered()
      .then(setPendingCount)
      .catch(() => setPendingCount(null));
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-60 shrink-0 border-r bg-background">
        <div className="flex h-14 items-center border-b px-4 font-semibold tracking-tight">
          SEMCO KB
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map(({ to, label, icon: Icon, end, key }) => (
            <NavLink
              key={key}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {key === "unanswered" && pendingCount !== null && pendingCount > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <div className="text-sm text-muted-foreground">Admin</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
