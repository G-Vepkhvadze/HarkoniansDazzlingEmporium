"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

interface ProfileLinkProps {
  onNavigate?: () => void;
}

/**
 * ProfileLink component - always shows as a nav link.
 * When logged out: Redirects to /auth
 * When logged in: Shows "Profile" link to /user or /dm based on role
 */
export default function ProfileLink({ onNavigate }: ProfileLinkProps) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    // Still loading - show a placeholder
    return (
      <Link href="/auth" onClick={onNavigate}>
        Profile
      </Link>
    );
  }

  if (!isAuthenticated || !user) {
    // Not logged in - redirect to auth
    return (
      <Link href="/auth" onClick={onNavigate}>
        Profile
      </Link>
    );
  }

  // Logged in - show Profile link
  // DM goes to /dm, PLAYER goes to /user
  const profileHref = user.role === "DM" ? "/dm" : "/user";

  return (
    <Link href={profileHref} onClick={onNavigate}>
      Profile
    </Link>
  );
}
