"use client";

import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";

export default function AdminLink() {
  const loggedIn = typeof window !== "undefined" && isLoggedIn();
  const href = loggedIn ? "/thesupersecretpagenobodyhasaccessto" : "/auth";
  
  return (
    <Link href={href} className="help-link" aria-label="Admin login">
      ?
    </Link>
  );
}
