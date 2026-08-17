"use client";

import { useState, useEffect } from "react";
import { isLoggedIn, getCurrentUserClient } from "@/lib/auth";
import Link from "next/link";

/**
 * ProfileLink component - shows as a nav link that changes based on login state.
 * When logged out: Shows nothing (or could show "Login" but user wants it empty)
 * When logged in: Shows "Profile" link to /user or /dm based on role
 */
export default function ProfileLink() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);

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
    // Still loading - don't show anything yet
    return null;
  }

  if (!isAuthenticated || !user) {
    // Not logged in - show nothing for Profile
    return null;
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
