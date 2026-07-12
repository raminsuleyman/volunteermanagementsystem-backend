/**
 * Növbələr / Arxiv route-ları — BACKEND_GUIDE.md §3.3 (SRS §4, §9, §14)
 * GET / | GET /:id | POST / | PUT /:id
 * Frontend-in göndərdiyi assignments strukturu: { "slot-0": { "sorgu": [1,2] }, ... }
 */
import { Router } from "express";
import { z } from "zod";
import { SHIFT_TYPES, generateTimeSlots } from "../lib/constants.js";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

const notesSchema = z.object({
  gelmeyenler: z.string().default(""),
  icazeliler: z.string().default(""),
  gecikenler: z.string().default(""),
  evezeGelenler: z.string().default(""),
  evezeGedenler: z.string().default(""),
  digerNovbedenGelenler: z.string().default(""),
  klubaGedenler: z.string().default(""),
  tesebbus: z.string().default(""),
  digerNovbeyeGedenler: z.string().default(""),
});

const shiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarix YYYY-MM-DD formatında olmalıdır"),
  shiftType: z.enum(["seher", "gunorta", "axsam"]),
  teamLeaderFirstName: z.string().min(1).max(100),
  teamLeaderLastName: z.string().min(1).max(100),
  volunteerIds: z.array(z.number().int().positive()).min(1, "Ən azı bir könüllü seçilməlidir"),
  assignments: z.record(z.string(), z.record(z.string(), z.array(z.number().int().positive()))),
  notes: notesSchema.default({}),
});

const notesToDb = (n) => ({
  gelmeyenler: n.gelmeyenler,
  icazeliler: n.icazeliler,
  gecikenler: n.gecikenler,
  eveze_gelenler: n.evezeGelenler,
  eveze_gedenler: n.evezeGedenler,
  diger_novbeden_gelenler: n.digerNovbedenGelenler,
  kluba_gedenler: n.klubaGedenler,
  tesebbus: n.tesebbus,
  diger_novbeye_gedenler: n.digerNovbeyeGedenler,
});

const notesToApi = (n) => ({
  gelmeyenler: n?.gelmeyenler ?? "",
  icazeliler: n?.icazeliler ?? "",
  gecikenler: n?.gecikenler ?? "",
  evezeGelenler: n?.eveze_gelenler ?? "",
  evezeGedenler: n?.eveze_gedenler ?? "",
  digerNovbedenGelenler: n?.diger_novbeden_gelenler ?? "",
  klubaGedenler: n?.kluba_gedenler ?? "",
  tesebbus: n?.tesebbus ?? "",
  digerNovbeyeGedenler: n?.diger_novbeye_gedenler ?? "",
});

/** Biznes qaydası (SRS §5): assignments-dəki hər könüllü volunteerIds-də olmalıdır */
function validateAssignments(assignments, volunteerIds) {
  const volSet = new Set(volunteerIds);
  for (const [slotKey, areas] of Object.entries(assignments)) {
    const seen = new Set();
    for (const [areaId, ids] of Object.entries(areas)) {
      for (const id of ids) {
        if (!volSet.has(id)) {
          throw new ApiError(
            422,
            "VALIDATION_ERROR",
            `Könüllü #${id} (${slotKey}/${areaId}) növbənin könüllü siyahısında deyil`
          );
        }
        if (seen.has(id)) {
          throw new ApiError(
            422,
            "VALIDATION_ERROR",
            `Könüllü #${id} eyni intervalda (${slotKey}) birdən çox sahəyə təyin olunub`
          );
        }
        seen.add(id);
      }
    }
  }
}

/** Növbənin alt-obyektlərini (slots, assignments, volunteers, notes) DB-yə yazır */
async function writeShiftChildren(shiftId, body) {
  const slots = generateTimeSlots(body.shiftType);

  // time_slots yarat
  const { data: dbSlots, error: slotErr } = await supabase
    .from("time_slots")
    .insert(
      slots.map((s) => ({
        shift_id: shiftId,
        slot_index: s.slotIndex,
        start_time: s.start,
        end_time: s.end,
      }))
    )
    .select();
  if (slotErr) throw new ApiError(500, "DB_ERROR", slotErr.message);

  // slot-index -> db id xəritəsi
  const slotIdByIndex = Object.fromEntries(dbSlots.map((s) => [s.slot_index, s.id]));

  // shift_volunteers
  const { error: svErr } = await supabase.from("shift_volunteers").insert(
    body.volunteerIds.map((vid) => ({ shift_id: shiftId, volunteer_id: vid }))
  );
  if (svErr) throw new ApiError(500, "DB_ERROR", svErr.message);

  // assignments: "slot-N" açarından slot_index çıxarılır
  const rows = [];
  for (const [slotKey, areas] of Object.entries(body.assignments)) {
    const idx = Number(slotKey.replace("slot-", ""));
    const tsId = slotIdByIndex[idx];
    if (tsId === undefined) continue;
    for (const [areaId, ids] of Object.entries(areas)) {
      for (const vid of ids) {
        rows.push({ timeslot_id: tsId, area_id: areaId, volunteer_id: vid });
      }
    }
  }
  if (rows.length > 0) {
    const { error: aErr } = await supabase.from("assignments").insert(rows);
    if (aErr) throw new ApiError(500, "DB_ERROR", aErr.message);
  }

  // notes
  const { error: nErr } = await supabase
    .from("shift_notes")
    .insert({ shift_id: shiftId, ...notesToDb(body.notes) });
  if (nErr) throw new ApiError(500, "DB_ERROR", nErr.message);
}

/** Bir növbənin tam detalını frontend formatında qaytarır */
async function loadShiftDetail(shiftId) {
  const { data: shift, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  if (!shift) throw new ApiError(404, "NOT_FOUND", "Növbə tapılmadı");

  const [{ data: sv }, { data: slots }, { data: notes }] = await Promise.all([
    supabase.from("shift_volunteers").select("volunteer_id").eq("shift_id", shiftId),
    supabase.from("time_slots").select("*").eq("shift_id", shiftId).order("slot_index"),
    supabase.from("shift_notes").select("*").eq("shift_id", shiftId).maybeSingle(),
  ]);

  const slotIds = (slots ?? []).map((s) => s.id);
  let assignments = {};
  if (slotIds.length > 0) {
    const { data: asg, error: aErr } = await supabase
      .from("assignments")
      .select("*")
      .in("timeslot_id", slotIds);
    if (aErr) throw new ApiError(500, "DB_ERROR", aErr.message);
    const idxBySlotId = Object.fromEntries((slots ?? []).map((s) => [s.id, s.slot_index]));
    for (const a of asg ?? []) {
      const key = `slot-${idxBySlotId[a.timeslot_id]}`;
      assignments[key] ??= {};
      assignments[key][a.area_id] ??= [];
      assignments[key][a.area_id].push(a.volunteer_id);
    }
  }

  return {
    id: shift.id,
    date: shift.date,
    shiftType: shift.shift_type,
    teamLeaderFirstName: shift.tl_first_name,
    teamLeaderLastName: shift.tl_last_name,
    volunteerIds: (sv ?? []).map((r) => r.volunteer_id),
    timeSlots: (slots ?? []).map((s) => ({
      id: `slot-${s.slot_index}`,
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    })),
    assignments,
    notes: notesToApi(notes),
    savedAt: shift.saved_at,
  };
}

// GET /api/shifts?date=&shiftType=&page=&limit=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);

    let query = supabase
      .from("shifts")
      .select("*, shift_volunteers(volunteer_id)", { count: "exact" })
      .order("saved_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (req.query.date) query = query.eq("date", req.query.date);
    if (req.query.shiftType) query = query.eq("shift_type", req.query.shiftType);

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, "DB_ERROR", error.message);

    res.json({
      success: true,
      data: (data ?? []).map((s) => ({
        id: s.id,
        date: s.date,
        shiftType: s.shift_type,
        teamLeaderFirstName: s.tl_first_name,
        teamLeaderLastName: s.tl_last_name,
        volunteerCount: (s.shift_volunteers ?? []).length,
        savedAt: s.saved_at,
      })),
      meta: { page, limit, total: count ?? 0 },
    });
  })
);

// GET /api/shifts/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const detail = await loadShiftDetail(req.params.id);
    res.json({ success: true, data: detail });
  })
);

// POST /api/shifts — Save funksiyası (SRS §9)
router.post(
  "/",
  validate(shiftSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    validateAssignments(body.assignments, body.volunteerIds);

    // Konflikt yoxlaması: eyni gün + tip (409)
    const { data: existing } = await supabase
      .from("shifts")
      .select("id")
      .eq("date", body.date)
      .eq("shift_type", body.shiftType)
      .maybeSingle();
    if (existing) {
      throw new ApiError(
        409,
        "CONFLICT",
        `${body.date} tarixində ${SHIFT_TYPES[body.shiftType].label} növbəsi artıq mövcuddur (id: ${existing.id})`
      );
    }

    const { data: shift, error } = await supabase
      .from("shifts")
      .insert({
        date: body.date,
        shift_type: body.shiftType,
        team_leader_id: Number(req.user.id) || null,
        tl_first_name: body.teamLeaderFirstName,
        tl_last_name: body.teamLeaderLastName,
      })
      .select()
      .single();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);

    try {
      await writeShiftChildren(shift.id, body);
    } catch (e) {
      // uğursuzluqda yarımçıq növbəni təmizlə (cascade)
      await supabase.from("shifts").delete().eq("id", shift.id);
      throw e;
    }

    const detail = await loadShiftDetail(shift.id);
    res.status(201).json({ success: true, data: detail });
  })
);

// PUT /api/shifts/:id — mövcud növbəni yenilə (SRS §14: yalnız yaxın müddətdə)
router.put(
  "/:id",
  validate(shiftSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    validateAssignments(body.assignments, body.volunteerIds);

    const { data: shift, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    if (!shift) throw new ApiError(404, "NOT_FOUND", "Növbə tapılmadı");

    // Tövsiyə: saxlanmadan 24 saat sonra redaktə bağlanır
    const ageHours = (Date.now() - new Date(shift.saved_at).getTime()) / 3600000;
    if (ageHours > 24) {
      throw new ApiError(422, "VALIDATION_ERROR", "Arxivlənmiş növbə 24 saatdan sonra redaktə oluna bilməz");
    }

    // köhnə alt-obyektləri sil, yenidən yaz
    await supabase.from("time_slots").delete().eq("shift_id", shift.id);
    await supabase.from("shift_volunteers").delete().eq("shift_id", shift.id);
    await supabase.from("shift_notes").delete().eq("shift_id", shift.id);

    await supabase
      .from("shifts")
      .update({
        tl_first_name: body.teamLeaderFirstName,
        tl_last_name: body.teamLeaderLastName,
      })
      .eq("id", shift.id);

    await writeShiftChildren(shift.id, body);

    const detail = await loadShiftDetail(shift.id);
    res.json({ success: true, data: detail });
  })
);

export default router;
