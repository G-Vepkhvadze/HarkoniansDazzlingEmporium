import { UserRole } from "@prisma/client";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}
