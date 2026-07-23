import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "bizauto-jwt-secret-2024";
const JWT_EXPIRES_IN = "15m";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "bizauto-refresh-secret-2024";
const REFRESH_EXPIRES_IN = "7d";

export interface AuthUser {
  id: number;
  tenantId: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  employeeCode?: string | null;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ id: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export function verifyRefreshToken(token: string): { id: number } {
  return jwt.verify(token, REFRESH_SECRET) as { id: number };
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}

export function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    departmentId: user.departmentId,
    employeeCode: user.employeeCode,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    designation: user.designation,
    joiningDate: user.joiningDate,
    employmentType: user.employmentType,
    gender: user.gender,
    city: user.city,
    country: user.country,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
