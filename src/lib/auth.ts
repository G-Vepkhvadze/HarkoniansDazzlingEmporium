const ADMIN_USERNAME = "Lilliwicke7";
const ADMIN_PASSWORD = "7lovescats";
const SESSION_KEY = "admin_session";

interface Session {
  username: string;
  loggedIn: boolean;
}

export function login(username: string, password: string): boolean {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const session: Session = {
      username,
      loggedIn: true,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return true;
  }
  return false;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;
  try {
    const parsed = JSON.parse(session) as Session;
    return parsed.loggedIn === true && parsed.username === ADMIN_USERNAME;
  } catch {
    return false;
  }
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const parsed = JSON.parse(session) as Session;
    return parsed.username;
  } catch {
    return null;
  }
}
