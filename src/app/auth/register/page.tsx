"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    // Validate password match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Registration successful - redirect to login or returnUrl
      setSuccess("Registration successful! Redirecting to login...");
      setTimeout(() => {
        router.push(returnUrl ? `/auth?returnUrl=${encodeURIComponent(returnUrl)}` : "/auth");
      }, 2000);
    } catch {
      setError("An error occurred during registration");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Register</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', maxWidth: '420px', margin: '2rem auto' }}>
        <label>
          Username
          <input className="auth-input-box" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          Password (min 8 characters)
          <input className="auth-input-box" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          Confirm Password
          <input className="auth-input-box" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        {error ? <div style={{ color: 'var(--red)' }}>{error}</div> : null}
        {success ? <div style={{ color: 'var(--green)' }}>{success}</div> : null}
        <button type="submit" style={{ padding: '0.6rem 1rem', marginTop: '0.5rem' }} disabled={isLoading}>
          {isLoading ? "Registering..." : "Register"}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account? <Link href="/auth" style={{ color: 'var(--accent)' }}>Login here</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}><h1>Register</h1><p>Loading...</p></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
