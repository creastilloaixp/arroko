import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isAdmin: false,
    isLoading: true,
    error: null,
  });

  // Check if user is admin
  const withTimeout = async <T>(p: PromiseLike<T>, ms: number): Promise<T> => {
    return await Promise.race([
      Promise.resolve(p),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)
      ) as Promise<T>,
    ]);
  };

  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      console.log("🔍 Checking admin status for user:", userId);

      const { data, error } = await withTimeout(
        supabase!.rpc("is_admin"),
        10000,
      );
      if (!error) {
        const isAdminRpc = Boolean(data);
        console.log("✅ Admin status check result (rpc):", isAdminRpc);
        return isAdminRpc;
      }

      console.warn(
        "⚠️ RPC is_admin failed, falling back to direct check:",
        error,
      );
      const { data: direct, error: directErr } = await withTimeout(
        supabase!
          .from("admin_users")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle(),
        10000,
      );
      if (directErr) {
        console.error("❌ Fallback direct check failed:", directErr);
        return false;
      }
      const isAdminDirect = !!direct;
      console.log("✅ Admin status check result (direct):", isAdminDirect);
      return isAdminDirect;
    } catch (err) {
      console.error("💥 Exception checking admin status (rpc/direct):", err);
      return false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Public experiences (including ArroKids) must remain available in demo
    // environments where Supabase has not been configured yet.
    if (!supabase) {
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: "Supabase no está configurado",
      }));
      return () => { mounted = false; };
    }

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase!.auth.getSession();

        if (error) throw error;

        if (mounted) {
          if (session?.user) {
            const isAdmin = await checkAdminStatus(session.user.id);
            setAuthState({
              user: session.user,
              session,
              isAdmin,
              isLoading: false,
              error: null,
            });
          } else {
            setAuthState({
              user: null,
              session: null,
              isAdmin: false,
              isLoading: false,
              error: null,
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setAuthState({
            user: null,
            session: null,
            isAdmin: false,
            isLoading: false,
            error: error instanceof Error
              ? error.message
              : "Error initializing auth",
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          if (session?.user) {
            const isAdmin = await checkAdminStatus(session.user.id);
            setAuthState({
              user: session.user,
              session,
              isAdmin,
              isLoading: false,
              error: null,
            });
          } else {
            setAuthState({
              user: null,
              session: null,
              isAdmin: false,
              isLoading: false,
              error: null,
            });
          }
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: "Supabase no está configurado" };
    try {
      console.log("🔐 Starting sign in process...");
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      console.log("📡 Calling Supabase signInWithPassword...");
      const { data, error } = await withTimeout(
        supabase!.auth.signInWithPassword({
          email,
          password,
        }),
        5000,
      );

      console.log("📥 Sign in response received:", {
        hasData: !!data,
        hasError: !!error,
      });

      if (error) {
        console.error("❌ Sign in error:", error);
        throw error;
      }

      if (data.user) {
        console.log("👤 User authenticated, checking admin status...");
        const isAdmin = await checkAdminStatus(data.user.id);

        if (!isAdmin) {
          console.warn("⛔ User is not an admin, signing out...");
          await supabase!.auth.signOut();
          setAuthState({
            user: null,
            session: null,
            isAdmin: false,
            isLoading: false,
            error: "No tienes permisos de administrador",
          });
          return {
            success: false,
            error: "No tienes permisos de administrador",
          };
        }

        console.log("✅ Sign in successful, user is admin");
        setAuthState({
          user: data.user,
          session: data.session,
          isAdmin: true,
          isLoading: false,
          error: null,
        });

        return { success: true };
      }

      console.error("❌ No user data received");
      return { success: false, error: "Error al iniciar sesión" };
    } catch (error) {
      console.error("💥 Sign in exception:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Error al iniciar sesión";
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  // Sign out
  const signOut = async (): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: "Supabase no está configurado" };
    try {
      const { error } = await supabase!.auth.signOut();

      if (error) throw error;

      setAuthState({
        user: null,
        session: null,
        isAdmin: false,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Error al cerrar sesión";
      return { success: false, error: errorMessage };
    }
  };

  return {
    ...authState,
    signIn,
    signOut,
  };
};
