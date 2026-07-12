/**
 * Xidmət sahələri — BACKEND_GUIDE.md §3.3 (SRS §6)
 * GET /api/areas
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from("areas").select("*").order("id");
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({ success: true, data });
  })
);

export default router;
