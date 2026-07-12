/**
 * Statistika — BACKEND_GUIDE.md §3.4 (Ana səhifə üçün)
 * GET /api/stats/overview
 */
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [vols, shifts] = await Promise.all([
      supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("shifts").select("id", { count: "exact", head: true }),
    ]);
    if (vols.error) throw new ApiError(500, "DB_ERROR", vols.error.message);
    if (shifts.error) throw new ApiError(500, "DB_ERROR", shifts.error.message);

    res.json({
      success: true,
      data: {
        activeVolunteers: vols.count ?? 0,
        archivedShifts: shifts.count ?? 0,
      },
    });
  })
);

export default router;

