"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password === "iamathielsdad") {
      localStorage.setItem("isAdmin", "true");
      router.push("/thesupersecretpagenobodyhasaccessto");
    } else {
      setError("Incorrect password");
    }
  }

  return (
    <div style={{padding: '2rem'}}>
      <h1>Admin Login</h1>
      <form onSubmit={submit} style={{display: 'grid', gap: '0.5rem', maxWidth: '420px'}}>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{display: 'block', width: '100%', padding: '0.5rem'}} />
        </label>
        {error ? <div style={{color: 'var(--red)'}}>{error}</div> : null}
        <button type="submit" style={{padding: '0.6rem 1rem', marginTop: '0.5rem'}}>Enter</button>
      </form>
    </div>
  );
}
