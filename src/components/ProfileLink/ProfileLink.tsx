"use client";

import { useState, useEffect } from "react";
import { isLoggedIn, getCurrentUserClient } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * ProfileLink component - always shows as a nav link.
 * When logged out: Redirects to /auth
 * When logged in: Shows "Profile" link to /user or /dm based on role
 */
export default function ProfileLink() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const loggedIn = await isLoggedIn();
      setIsAuthenticated(loggedIn);
      
      if (loggedIn) {
        const currentUser = await getCurrentUserClient();
        setUser(currentUser);
      }
    }
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    // Still loading - show a placeholder
    return (
      <Link href="/auth" style={{ color: "inherit", textDecoration: "none" }}>
        Profile
      </Link>
    );
  }

  if (!isAuthenticated || !user) {
    // Not logged in - redirect to auth
    return (
      <Link href="/auth" style={{ color: "inherit", textDecoration: "none" }}>
        Profile
      </Link>
    );
  }

  // Logged in - show Profile link
  // DM goes to /dm, PLAYER goes to /user
  const profileHref = user.role === "DM" ? "/dm" : "/user";

  return (
    <Link href={profileHref} style={{ color: "inherit", textDecoration: "none" }}>
      Profile
    </Link>
  );
}
