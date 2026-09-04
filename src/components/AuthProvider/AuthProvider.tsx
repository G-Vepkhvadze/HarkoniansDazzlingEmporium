"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isDM: boolean;
  user: {
    id: string;
    username: string;
    role: string;
  } | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isDM: false,
  user: null,
  loading: true,
});

interface AuthProviderProps {
  children: ReactNode;
  initialAuthState: {
    isAuthenticated: boolean;
    isDM: boolean;
    user: {
      id: string;
      username: string;
      role: string;
    } | null;
  };
}

export function AuthProvider({ children, initialAuthState }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthContextType>({
    ...initialAuthState,
    loading: false,
  });

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}