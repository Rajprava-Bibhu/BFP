import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { passwordResetTokensTable, refreshTokensTable } from "@workspace/db";
import { eq, or, and, gt, isNull } from "drizzle-orm";
import {
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  generateResetToken,
  sanitizeUser,
} from "../lib/auth.js";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginId = identifier || email;

    if (!loginId || !password) {
      res.status(400).json({ message: "Identifier (email or employee code) and password are required" });
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, loginId.toLowerCase()), eq(usersTable.employeeCode, loginId.toUpperCase())))
      .limit(1);

    if (!users.length) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ message: "Account is inactive. Contact your administrator." });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    const tokenPayload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeCode: user.employeeCode,
    };

    const accessToken = signToken(tokenPayload);
    const refreshToken = signRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      token: accessToken,
      refreshToken,
      expiresIn: 900,
      user: sanitizeUser({ ...user, lastLoginAt: new Date() }),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token required" });
      return;
    }

    let decoded: { id: number };
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }

    const tokens = await db
      .select()
      .from(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.token, refreshToken),
          eq(refreshTokensTable.userId, decoded.id),
          isNull(refreshTokensTable.revokedAt),
          gt(refreshTokensTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!tokens.length) {
      res.status(401).json({ message: "Refresh token revoked or expired" });
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, decoded.id), eq(usersTable.isActive, true)))
      .limit(1);

    if (!users.length) {
      res.status(401).json({ message: "User not found or inactive" });
      return;
    }

    const user = users[0];
    const newAccessToken = signToken({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeCode: user.employeeCode,
    });

    res.json({ token: newAccessToken, expiresIn: 900 });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokensTable.token, refreshToken));
    }
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.json({ success: true });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, authUser.id)).limit(1);
    if (!users.length) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(sanitizeUser(users[0]));
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { firstName, lastName, phone, avatar, city, country, address, gender } = req.body;

    const updated = await db
      .update(usersTable)
      .set({
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
        ...(address !== undefined && { address }),
        ...(gender !== undefined && { gender }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, authUser.id))
      .returning();

    if (!updated.length) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(sanitizeUser(updated[0]));
  } catch (err) {
    console.error("Update me error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current and new password are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ message: "New password must be at least 8 characters" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, authUser.id)).limit(1);
    if (!users.length) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, users[0].passwordHash);
    if (!valid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, authUser.id));

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.userId, authUser.id));

    res.json({ success: true, message: "Password changed successfully. Please log in again." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ message: "Email or employee code required" });
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(
        or(eq(usersTable.email, identifier.toLowerCase()), eq(usersTable.employeeCode, identifier.toUpperCase()))
      )
      .limit(1);

    res.json({
      success: true,
      message: "If an account was found, a reset token has been generated.",
    });

    if (!users.length) return;
    const user = users[0];

    const token = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    console.info(`[AUTH] Password reset token for user ${user.id} (${user.email}): ${token}`);
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ message: "Token and new password are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ message: "Password must be at least 8 characters" });
      return;
    }

    const tokens = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!tokens.length) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const resetRecord = tokens[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, resetRecord.userId));
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.userId, resetRecord.userId));

    res.json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/reset-token-check", async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) {
      res.status(400).json({ valid: false, message: "Token required" });
      return;
    }

    const tokens = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!tokens.length) {
      res.json({ valid: false, message: "Token is invalid or has expired" });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("Token check error:", err);
    res.status(500).json({ valid: false, message: "Internal server error" });
  }
});

export default router;
