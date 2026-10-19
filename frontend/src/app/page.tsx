"use client";

import { useEffect, useState } from "react";
import { Workspace } from "@/components/Workspace";
import { api } from "@/lib/api";

type SessionResponse = { username: string };

export default function Home() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    api<SessionResponse>("/api/auth/session")
      .then((session) => {
        if (isMounted) {
          setCurrentUser(session.username);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const session = await api<SessionResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setError("");
      setPassword("");
      setCurrentUser(session.username);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again."
      );
      setPassword("");
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear the local view even if the server cannot be reached.
    }
    setCurrentUser(null);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (isCheckingSession) {
    return <main className="min-h-screen bg-[var(--surface)]" aria-busy="true" />;
  }

  if (currentUser) {
    return <Workspace username={currentUser} onLogout={() => void handleLogout()} />;
  }

  const isRegister = mode === "register";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project access
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-[var(--navy-dark)]">
          {isRegister ? "Create account" : "Sign in"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          {isRegister
            ? "Pick a username and a password of at least 8 characters."
            : "Use the demo credentials (user / password) or your own account."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-[var(--navy-dark)]">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[var(--navy-dark)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-95"
          >
            {isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? "signin" : "register");
            setError("");
            setPassword("");
          }}
          className="mt-6 text-sm font-semibold text-[var(--primary-blue)] transition hover:text-[var(--navy-dark)]"
        >
          {isRegister ? "Have an account? Sign in" : "Need an account? Create one"}
        </button>
      </div>
    </main>
  );
}
