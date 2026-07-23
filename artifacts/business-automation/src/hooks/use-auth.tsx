import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export interface AuthUser {
  id: number;
  tenantId: number;
  departmentId?: number | null;
  employeeCode?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: "super_admin" | "org_admin" | "department_head" | "employee";
  avatar?: string | null;
  phone?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  employmentType?: string;
  gender?: string | null;
  city?: string | null;
  country?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface LoginParams {
  identifier: string;
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: AuthUser) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTokens = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
  };

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(doRefresh, REFRESH_INTERVAL_MS);
  };

  const doRefresh = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      doLogout();
      return;
    }
    try {
      const data = await apiFetch<{ token: string; expiresIn: number }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      localStorage.setItem("token", data.token);
      scheduleRefresh();
    } catch {
      doLogout();
    }
  };

  const doLogout = async (callApi = false) => {
    if (callApi) {
      const refreshToken = localStorage.getItem("refreshToken");
      try {
        await apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
      } catch {}
    }
    clearTokens();
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    queryClient.clear();
    setLocation("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiFetch<AuthUser>("/auth/me")
      .then((me) => {
        setUser(me);
        scheduleRefresh();
      })
      .catch(() => {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          return apiFetch<{ token: string }>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          })
            .then((d) => {
              localStorage.setItem("token", d.token);
              return apiFetch<AuthUser>("/auth/me");
            })
            .then((me) => {
              setUser(me);
              scheduleRefresh();
            })
            .catch(() => {
              clearTokens();
            });
        } else {
          clearTokens();
        }
      })
      .finally(() => setIsLoading(false));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const login = async ({ identifier, password }: LoginParams) => {
    const data = await apiFetch<{ token: string; refreshToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
    scheduleRefresh();
    toast({
      title: "Welcome back!",
      description: `Signed in as ${data.user.firstName} ${data.user.lastName}`,
    });
    setLocation("/");
  };

  const logout = () => doLogout(true);

  const updateUser = (u: AuthUser) => setUser(u);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
