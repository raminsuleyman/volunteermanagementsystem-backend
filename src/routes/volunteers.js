/**
 * Könüllülər route-ları — BACKEND_GUIDE.md §3.2 (SRS §11–13)
 * GET / | GET /:id | POST / | PUT /:id | DELETE /:id (soft)
 * GET /:id/history | POST /:id/leave | POST /:id/extra-service
 */
import { Router } from "express";
import { z } from "zod";
import {
  EXTRA_SERVICE_WINDOWS,
  LEAVE_HOURS_PER_SHIFT,
} from "../lib/constants.js";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

const toApi = (v) => ({
  id: v.id,
  firstName: v.first_name,
  lastName: v.last_name,
  shifts: v.shifts,
  clubCount: v.club_count,
  initiativeCount: v.initiative_count,
  remainingLeaveHours: Number(v.remaining_leave_hours),
  active: v.active,
});

const volunteerSchema = z.object({
  firstName: z.string().min(1, "Ad mütləqdir").max(100),
  lastName: z.string().min(1, "Soyad mütləqdir").max(100),
  shifts: z.array(z.enum(["seher", "gunorta", "axsam"])).default([]),
  clubCount: z.number().int().min(0).default(0),
  initiativeCount: z.number().int().min(0).default(0),
  remainingLeaveHours: z.number().min(0).default(0),
});

async function findVolunteer(id) {
  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Könüllü tapılmadı");
  return data;
}

// GET /api/volunteers?active=true|false
router.get(
  "/",
  asyncHandler(async (req, res) => {
    let query = supabase.from("volunteers").select("*").order("id");
    if (req.query.active !== "false") query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({ success: true, data: data.map(toApi) });
  })
);

// GET /api/volunteers/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const v = await findVolunteer(req.params.id);
    res.json({ success: true, data: toApi(v) });
  })
);

// POST /api/volunteers
router.post(
  "/",
  validate(volunteerSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { data, error } = await supabase
      .from("volunteers")
      .insert({
        first_name: b.firstName,
        last_name: b.lastName,
        shifts: b.shifts,
        club_count: b.clubCount,
        initiative_count: b.initiativeCount,
        remaining_leave_hours: b.remainingLeaveHours,
      })
      .select()
      .single();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.status(201).json({ success: true, data: toApi(data) });
  })
);

// PUT /api/volunteers/:id
router.put(
  "/:id",
  validate(volunteerSchema.partial()),
  asyncHandler(async (req, res) => {
    await findVolunteer(req.params.id);
    const b = req.body;
    const patch = {};
    if (b.firstName !== undefined) patch.first_name = b.firstName;
    if (b.lastName !== undefined) patch.last_name = b.lastName;
    if (b.shifts !== undefined) patch.shifts = b.shifts;
    if (b.clubCount !== undefined) patch.club_count = b.clubCount;
    if (b.initiativeCount !== undefined) patch.initiative_count = b.initiativeCount;
    if (b.remainingLeaveHours !== undefined) patch.remaining_leave_hours = b.remainingLeaveHours;

    const { data, error } = await supabase
      .from("volunteers")
      .update(patch)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({ success: true, data: toApi(data) });
  })
);

// DELETE /api/volunteers/:id — SOFT DELETE (SRS §11)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findVolunteer(req.params.id);
    const { error } = await supabase
      .from("volunteers")
      .update({ active: false })
      .eq("id", req.params.id);
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({
      success: true,
      data: { message: "Könüllü aktiv siyahıdan çıxarıldı; arxiv qeydləri qorunur" },
    });
  })
);

// GET /api/volunteers/:id/history — iştirak etdiyi keçmiş növbələr
router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    await findVolunteer(req.params.id);
    const { data, error } = await supabase
      .from("shift_volunteers")
      .select("shift_id, shifts ( id, date, shift_type, tl_first_name, tl_last_name, saved_at )")
      .eq("volunteer_id", req.params.id);
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    const history = (data ?? [])
      .map((r) => r.shifts)
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((s) => ({
        id: s.id,
        date: s.date,
        shiftType: s.shift_type,
        teamLeaderFirstName: s.tl_first_name,
        teamLeaderLastName: s.tl_last_name,
        savedAt: s.saved_at,
      }));
    res.json({ success: true, data: history });
  })
);

// POST /api/volunteers/:id/leave — icazə borcu (+3 saat, SRS §12)
router.post(
  "/:id/leave",
  asyncHandler(async (req, res) => {
    const v = await findVolunteer(req.params.id);
    const newHours = Number(v.remaining_leave_hours) + LEAVE_HOURS_PER_SHIFT;
    const { data, error } = await supabase
      .from("volunteers")
      .update({ remaining_leave_hours: newHours })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({ success: true, data: toApi(data) });
  })
);

const extraServiceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarix YYYY-MM-DD formatında olmalıdır"),
  window: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, "Pəncərə HH:MM-HH:MM formatında olmalıdır"),
  hours: z.number().min(0.5).max(1, "Əlavə xidmət maksimum 1 saat ola bilər (SRS §13)"),
});

// POST /api/volunteers/:id/extra-service — təşəbbüs (SRS §13)
router.post(
  "/:id/extra-service",
  validate(extraServiceSchema),
  asyncHandler(async (req, res) => {
    const v = await findVolunteer(req.params.id);
    const { window, hours } = req.body;

    // Könüllünün növbələrindən ən azı biri üçün pəncərə icazəli olmalıdır
    const allowed = (v.shifts ?? []).some((s) =>
      (EXTRA_SERVICE_WINDOWS[s] ?? []).includes(window)
    );
    if (!allowed) {
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        `Bu pəncərə (${window}) könüllünün növbəsinə görə icazəli deyil. İcazəli pəncərələr: ${(v.shifts ?? [])
          .map((s) => `${s}: ${(EXTRA_SERVICE_WINDOWS[s] ?? []).join(", ")}`)
          .join(" | ")}`
      );
    }

    const newLeave = Math.max(0, Number(v.remaining_leave_hours) - hours);
    const { data, error } = await supabase
      .from("volunteers")
      .update({
        remaining_leave_hours: newLeave,
        initiative_count: v.initiative_count + 1,
      })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    res.json({ success: true, data: toApi(data) });
  })
);

export default router;

