import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Calculator, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const sections = [
  { to: "/kb", label: "KB Entries", icon: BookOpen },
  { to: "/calculator", label: "Product Calculator", icon: Calculator },
] as const;

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-60 shrink-0 border-r bg-background">
        <div className="flex h-14 items-center border-b px-4 font-semibold tracking-tight">
          SEMCO KB
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {sections.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
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
