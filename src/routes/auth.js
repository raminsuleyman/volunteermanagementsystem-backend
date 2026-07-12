/**
 * Auth route-ları — BACKEND_GUIDE.md §3.1
 * POST /api/auth/login | POST /api/auth/logout | POST /api/auth/refresh | GET /api/auth/me
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
}

const loginSchema = z.object({
  email: z.string().email("Düzgün email daxil edin"),
  password: z.string().min(1, "Şifrə mütləqdir"),
});

// POST /api/auth/login
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from("team_leaders")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email və ya şifrə yanlışdır");
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // refresh token hash-ini saxla (logout üçün)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await supabase.from("refresh_tokens").insert({
      team_leader_id: user.id,
      token_hash: sha256(refreshToken),
      expires_at: expiresAt,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
        },
      },
    });
  })
);

// POST /api/auth/refresh
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) throw new ApiError(401, "UNAUTHORIZED", "Refresh token tələb olunur");

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token etibarsızdır");
    }

    // token bazada mövcuddurmu (ləğv olunmayıb)?
    const { data: stored } = await supabase
      .from("refresh_tokens")
      .select("id")
      .eq("token_hash", sha256(refreshToken))
      .maybeSingle();
    if (!stored) throw new ApiError(401, "UNAUTHORIZED", "Refresh token ləğv edilib");

    const { data: user } = await supabase
      .from("team_leaders")
      .select("*")
      .eq("id", payload.sub)
      .maybeSingle();
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "İstifadəçi tapılmadı");

    res.json({ success: true, data: { accessToken: signAccessToken(user) } });
  })
);

// POST /api/auth/logout
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      await supabase.from("refresh_tokens").delete().eq("token_hash", sha256(refreshToken));
    }
    res.json({ success: true, data: { message: "Çıxış edildi" } });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: user, error } = await supabase
      .from("team_leaders")
      .select("id, first_name, last_name, email, created_at")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    if (!user) throw new ApiError(404, "NOT_FOUND", "İstifadəçi tapılmadı");
    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  })
);

export default router;
