import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, getToken } from "./api";

WebBrowser.maybeCompleteAuthSession();

type User = { user_id: string; email: string; name: string; picture?: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

const processedSessionIds = new Set<string>();

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const exchangeId = useCallback(async (sessionId: string) => {
    if (processedSessionIds.has(sessionId)) return;
    processedSessionIds.add(sessionId);
    try {
      const resp = await api.exchangeSession(sessionId);
      await setToken(resp.session_token);
      setUser(resp.user);
    } catch (e) {
      console.warn("exchange failed", e);
    }
  }, []);

  // Check existing session or process URL session_id on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Check URL for session_id first (web + mobile cold start)
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid = extractSessionId(window.location.href);
        if (sid) {
          await exchangeId(sid);
          // clean URL
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(window.history.state, "", newUrl);
          if (mounted) setLoading(false);
          return;
        }
      } else {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) {
          await exchangeId(sid);
          if (mounted) setLoading(false);
          return;
        }
      }
      // Otherwise check existing token
      const token = await getToken();
      if (token) {
        try {
          const me = await api.me();
          if (mounted) setUser(me);
        } catch {
          await setToken(null);
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [exchangeId]);

  // Deep link listener for mobile hot links
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", (ev) => {
      const sid = extractSessionId(ev.url);
      if (sid) exchangeId(sid);
    });
    return () => sub.remove();
  }, [exchangeId]);

  const signIn = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web"
        ? typeof window !== "undefined"
          ? window.location.origin + "/"
          : ""
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success" && (result as any).url) {
      sid = extractSessionId((result as any).url);
    }
    if (!sid) {
      const initial = await Linking.getInitialURL();
      sid = extractSessionId(initial);
    }
    if (sid) await exchangeId(sid);
  }, [exchangeId]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
