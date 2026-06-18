import { createContext, type ReactNode, useContext, useMemo } from "react";

type LocalSession = {
  access_token: string;
  user: { id: string; email?: string };
} | null;

export type AuthContextType = {
  session: LocalSession;
  supabase: null;
  isRefreshingSession: false;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<null>;
  handleAuthCallback: (url: string) => Promise<void>;
  setSessionFromTokens: (
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>;
  getHeaders: () => null;
  getAvatarUrl: () => Promise<null>;
};

const noop = async () => {};
const nullAsync = async () => null;

const LOCAL_AUTH: AuthContextType = {
  session: {
    access_token: "local-first-token",
    user: { id: "local-user", email: "local@meetspace.app" },
  },
  supabase: null,
  isRefreshingSession: false,
  signIn: noop,
  signOut: noop,
  refreshSession: nullAsync,
  handleAuthCallback: noop,
  setSessionFromTokens: noop,
  getHeaders: () => null,
  getAvatarUrl: nullAsync,
};

const AuthContext = createContext<AuthContextType>(LOCAL_AUTH);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => LOCAL_AUTH, []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
