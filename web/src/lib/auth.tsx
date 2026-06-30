import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, INITIAL_AUTH_TYPE } from "@/lib/supabase";
import {
  DEFAULT_PERMISSIONS,
  fetchMyPermissions,
  type Permissions,
} from "@/lib/permissions";

// Did the user land here by following an invite or password-recovery link? Such
// users get an authenticated session but have no password set, so they must be
// routed to /set-password before they can use the app.
const arrivedViaInvite =
  INITIAL_AUTH_TYPE === "invite" || INITIAL_AUTH_TYPE === "recovery";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  permissions: Permissions;
  passwordSetupRequired: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearPasswordSetup: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(arrivedViaInvite);

  useEffect(() => {
    let settled = false;
    const finish = (s: Session | null) => {
      settled = true;
      setSession(s);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      // On an invite/recovery link the session is established asynchronously from
      // the URL hash, so getSession() may still be null here. Keep `loading` true
      // and let onAuthStateChange (SIGNED_IN / PASSWORD_RECOVERY) finish, otherwise
      // AuthGuard would bounce the invited user to /login before the token lands.
      if (!data.session && arrivedViaInvite) return;
      if (!settled) finish(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setPasswordSetupRequired(true);
      finish(s);
    });

    // Fallback for an expired/invalid invite link that never yields an auth event:
    // stop blocking after a short grace period so the user isn't stuck on "Loading…".
    const timeout = window.setTimeout(() => {
      if (!settled) setLoading(false);
    }, 4000);

    return () => {
      subscription.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  // Fetch permissions whenever the user changes (login/logout).
  useEffect(() => {
    if (!session?.user) {
      setPermissions(DEFAULT_PERMISSIONS);
      return;
    }
    fetchMyPermissions()
      .then(setPermissions)
      .catch(() => setPermissions(DEFAULT_PERMISSIONS));
  }, [session?.user?.id]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    setPasswordSetupRequired(false);
    await supabase.auth.signOut();
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }

  function clearPasswordSetup() {
    setPasswordSetupRequired(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        permissions,
        passwordSetupRequired,
        signIn,
        signOut,
        updatePassword,
        clearPasswordSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
