"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider/AuthProvider";

export default function AdminLink() {
  const { isAuthenticated, isDM, loading } = useAuth();

  if (loading) {
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
    <Link href={isDM ? "/dm" : "/user"} className="help-link" aria-label={isDM ? "DM Admin" : "User profile"}>
      ?
    </Link>
  );
}
