"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, isLoggedIn } from "@/lib/auth";
import Link from "next/link";

function AuthPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  useEffect(() => {
    // If already logged in, redirect to homepage or returnUrl
    isLoggedIn().then((loggedIn) => {
      if (loggedIn) {
        router.push(returnUrl || "/");
      }
    });
  }, [router, returnUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const success = await login(username, password);
      if (success) {
        // Redirect to returnUrl or homepage after successful login
        router.push(returnUrl || "/");
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Login</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', maxWidth: '420px', margin: '2rem auto' }}>
        <label>
          Username
          <input className="auth-input-box" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        <label>
          Password
          <input className="auth-input-box" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }} />
        </label>
        {error ? <div style={{ color: 'var(--red)' }}>{error}</div> : null}
        <button type="submit" style={{ padding: '0.6rem 1rem', marginTop: '0.5rem' }} disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Don't have an account? <Link href="/auth/register" style={{ color: 'var(--accent)' }}>Register here</Link>
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}><h1>Login</h1><p>Loading...</p></div>}>
      <AuthPageContent />
    </Suspense>
  );
}
