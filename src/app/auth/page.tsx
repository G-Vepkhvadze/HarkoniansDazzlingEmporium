"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, isLoggedIn } from "@/lib/auth";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to admin panel
    if (isLoggedIn()) {
      router.push("/thesupersecretpagenobodyhasaccessto");
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (login(username, password)) {
      router.push("/thesupersecretpagenobodyhasaccessto");
    } else {
      setError("Invalid username or password");
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin Login</h1>
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
        <button type="submit" style={{ padding: '0.6rem 1rem', marginTop: '0.5rem' }}>Login</button>
      </form>
    </div>
  );
}
