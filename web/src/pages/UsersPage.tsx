import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  listUsers,
  updateUserPermissions,
  type PermissionPatch,
  type UserRow,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

type FlagKey =
  | "can_delete_kb"
  | "can_sync_lyro"
  | "can_use_calculator"
  | "can_see_prices"
  | "is_admin";

const FLAG_COLUMNS: { key: FlagKey; label: string }[] = [
  { key: "can_use_calculator", label: "Calculator" },
  { key: "can_see_prices", label: "Prices" },
  { key: "can_delete_kb", label: "Delete KB" },
  { key: "can_sync_lyro", label: "Sync Lyro" },
  { key: "is_admin", label: "Admin" },
];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFlag(row: UserRow, key: FlagKey, next: boolean) {
    const id = `${row.user_id}:${key}`;
    if (pending.has(id)) return;

    // Optimistic update
    const previous = users;
    setUsers((cur) =>
      cur.map((u) => (u.user_id === row.user_id ? { ...u, [key]: next } : u))
    );
    setPending((p) => new Set(p).add(id));

    try {
      const patch: PermissionPatch = { [key]: next };
      const updated = await updateUserPermissions(row.user_id, patch);
      setUsers((cur) =>
        cur.map((u) => (u.user_id === row.user_id ? updated : u))
      );
    } catch (e) {
      // Roll back
      setUsers(previous);
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[14rem]">User</TableHead>
              {FLAG_COLUMNS.map((c) => (
                <TableHead key={c.key} className="w-28 text-center">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-40">Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={FLAG_COLUMNS.length + 2}
                  className="text-center text-muted-foreground py-12"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={FLAG_COLUMNS.length + 2}
                  className="text-center text-muted-foreground py-12"
                >
                  No users.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.user_id === currentUser?.id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium">
                        {u.email ?? <span className="text-muted-foreground italic">no email</span>}
                      </div>
                      {isSelf && (
                        <div className="text-xs text-muted-foreground">you</div>
                      )}
                    </TableCell>
                    {FLAG_COLUMNS.map((c) => {
                      const id = `${u.user_id}:${c.key}`;
                      const isPending = pending.has(id);
                      const lockSelfAdmin = isSelf && c.key === "is_admin";
                      return (
                        <TableCell key={c.key} className="text-center">
                          <input
                            type="checkbox"
                            className={cn(
                              "h-4 w-4 cursor-pointer accent-primary",
                              (isPending || lockSelfAdmin) && "cursor-not-allowed opacity-60"
                            )}
                            checked={u[c.key]}
                            disabled={isPending || lockSelfAdmin}
                            onChange={(e) => toggleFlag(u, c.key, e.target.checked)}
                            title={
                              lockSelfAdmin
                                ? "You can't remove your own admin access. Have another admin do it."
                                : undefined
                            }
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString()
                        : "never"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
