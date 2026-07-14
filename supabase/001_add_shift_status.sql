-- ============================================================
-- MİQRASİYA: shifts cədvəlinə DRAFT status dəstəyi
-- İdempotentdir: təkrar işlədilə bilər.
-- Supabase Dashboard → SQL Editor-da RUN edin.
-- ============================================================

-- 1. status sütunu əlavə et (mövcud sətirlər 'completed' alacaq)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

-- 2. CHECK constraint: yalnız 'draft' və 'completed'
DO $$ BEGIN
  ALTER TABLE shifts ADD CONSTRAINT chk_shift_status CHECK (status IN ('draft', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Köhnə UNIQUE constraint-i sil (draft + completed cütlərinə icazə vermək üçün)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_date_shift_type_key;

-- 4. Partial unique index: yalnız completed növbələr üçün uniklik
DROP INDEX IF EXISTS idx_shifts_date_type_completed;
CREATE UNIQUE INDEX idx_shifts_date_type_completed
  ON shifts (date, shift_type) WHERE status = 'completed';

-- 5. Status sütununa index (filtr performansı üçün)
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- ============================================================
-- SON. Mövcud bütün shifts sətirləri status='completed' olaraq qalır.
-- Heç bir data itirilmir və ya dəyişdirilmir.
-- ============================================================
