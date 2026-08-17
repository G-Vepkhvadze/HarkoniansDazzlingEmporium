"use client";

import Link from "next/link";
import { isLoggedIn, isDMClient } from "@/lib/auth";
import { useState, useEffect } from "react";

export default function AdminLink() {
  const [isDm, setIsDm] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const loggedIn = await isLoggedIn();
      setIsAuthenticated(loggedIn);
      
      if (loggedIn) {
        const dm = await isDMClient();
        setIsDm(dm);
      }
    }
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Link href="/auth" className="help-link" aria-label="Login">
        ?
      </Link>
    );
  }

  // If logged in, redirect to appropriate page
  return (
    <Link href={isDm ? "/dm" : "/user"} className="help-link" aria-label={isDm ? "DM Admin" : "User profile"}>
      ?
    </Link>
  );
}
