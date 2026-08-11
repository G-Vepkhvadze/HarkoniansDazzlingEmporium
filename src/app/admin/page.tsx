"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/thesupersecretpagenobodyhasaccessto'); }, [router]);
  return <div style={{padding:'2rem'}}>Redirecting…</div>;
}
