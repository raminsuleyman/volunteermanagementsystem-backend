/**
 * Sabitlər — frontend-dəki types.ts ilə sinxron saxlanılmalıdır.
 */

// Növbə tipləri və saatları (SRS §3)
export const SHIFT_TYPES = {
  seher:   { label: "Səhər",   start: "09:00", end: "12:00" },
  gunorta: { label: "Günorta", start: "12:00", end: "15:00" },
  axsam:   { label: "Axşam",   start: "15:00", end: "18:00" },
};

// Əlavə xidmət pəncərələri (SRS §13)
export const EXTRA_SERVICE_WINDOWS = {
  seher:   ["12:00-13:00"],
  gunorta: ["11:00-12:00", "15:00-16:00"],
  axsam:   ["14:00-15:00"],
};

// İcazə borcu: bir növbə = 3 saat (SRS §12)
export const LEAVE_HOURS_PER_SHIFT = 3;

// Slot açarları: slot-0 .. slot-5
export const SLOT_COUNT = 6;

/** Növbə tipinə görə 6 x 30 dəqiqəlik intervalı hesabla (SRS §4 addım 4) */
export function generateTimeSlots(shiftType) {
  const info = SHIFT_TYPES[shiftType];
  const [h] = info.start.split(":").map(Number);
  const fmt = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const startMin = h * 60 + i * 30;
    return { slotIndex: i, start: fmt(startMin), end: fmt(startMin + 30) };
  });
}
