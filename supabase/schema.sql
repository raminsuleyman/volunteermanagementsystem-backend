-- ============================================================
-- DOST Növbə İdarəetmə Sistemi — Supabase Database Skripti
-- Bu faylı Supabase Dashboard → SQL Editor-a yapışdırıb RUN edin.
-- Skript idempotentdir: təkrar işlədilə bilər.
-- ============================================================

-- ---------- 1. CƏDVƏLLƏR ----------

CREATE TABLE IF NOT EXISTS team_leaders (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteers (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  shifts                TEXT[] NOT NULL DEFAULT '{}',   -- ['seher','gunorta','axsam']
  club_count            INT NOT NULL DEFAULT 0,
  initiative_count      INT NOT NULL DEFAULT 0,
  remaining_leave_hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  active                BOOLEAN NOT NULL DEFAULT true,  -- soft delete (SRS §11)
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS areas (
  id   VARCHAR(50) PRIMARY KEY,   -- 'sorgu', 'aparat', ...
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date           DATE NOT NULL,
  shift_type     VARCHAR(10) NOT NULL CHECK (shift_type IN ('seher','gunorta','axsam')),
  team_leader_id BIGINT REFERENCES team_leaders(id),
  tl_first_name  VARCHAR(100) NOT NULL,   -- TL adı snapshot kimi saxlanılır
  tl_last_name   VARCHAR(100) NOT NULL,
  saved_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, shift_type)               -- bir gündə hər tip növbədən yalnız biri
);

CREATE TABLE IF NOT EXISTS shift_volunteers (
  shift_id     BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
  volunteer_id BIGINT REFERENCES volunteers(id),
  PRIMARY KEY (shift_id, volunteer_id)
);

CREATE TABLE IF NOT EXISTS time_slots (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_id   BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,                -- 0..5
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  UNIQUE (shift_id, slot_index)
);

CREATE TABLE IF NOT EXISTS assignments (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timeslot_id  BIGINT REFERENCES time_slots(id) ON DELETE CASCADE,
  area_id      VARCHAR(50) REFERENCES areas(id),
  volunteer_id BIGINT REFERENCES volunteers(id),
  UNIQUE (timeslot_id, volunteer_id)      -- bir intervalda könüllü yalnız bir sahədə
);

CREATE TABLE IF NOT EXISTS shift_notes (
  shift_id                BIGINT PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
  gelmeyenler             TEXT DEFAULT '',
  icazeliler              TEXT DEFAULT '',
  gecikenler              TEXT DEFAULT '',
  eveze_gelenler          TEXT DEFAULT '',
  eveze_gedenler          TEXT DEFAULT '',
  diger_novbeden_gelenler TEXT DEFAULT '',
  kluba_gedenler          TEXT DEFAULT '',
  tesebbus                TEXT DEFAULT '',
  diger_novbeye_gedenler  TEXT DEFAULT ''
);

-- Refresh token-lərin saxlanması (logout / token ləğvi üçün)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_leader_id BIGINT REFERENCES team_leaders(id) ON DELETE CASCADE,
  token_hash     VARCHAR(255) NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------- 2. İNDEKSLƏR ----------

CREATE INDEX IF NOT EXISTS idx_shifts_date        ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_type        ON shifts(shift_type);
CREATE INDEX IF NOT EXISTS idx_volunteers_active  ON volunteers(active);
CREATE INDEX IF NOT EXISTS idx_timeslots_shift    ON time_slots(shift_id);
CREATE INDEX IF NOT EXISTS idx_assignments_slot   ON assignments(timeslot_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tl  ON refresh_tokens(team_leader_id);

-- ---------- 3. SEED: XİDMƏT SAHƏLƏRİ (SRS §6) ----------

INSERT INTO areas (id, name) VALUES
  ('sorgu',           'Sorğu'),
  ('aparat',          'Aparat'),
  ('esas-giris',      'Əsas giriş'),
  ('ozunexidmet',     'Özünəxidmət'),
  ('zal-1',           '1-ci zal'),
  ('zal-2-sima',      '2-ci zal / SİMA'),
  ('mertebe-2',       '2-ci mərtəbə'),
  ('konullu-masasi',  'Könüllü masası')
ON CONFLICT (id) DO NOTHING;

-- ---------- 4. SEED: İLKİN TEAM LEADER HESABI ----------
-- Email: admin@dost.gov.az | Şifrə: Dost2026!
-- (bcrypt hash aşağıda hazır verilir; girişdən sonra dəyişdirin)

INSERT INTO team_leaders (first_name, last_name, email, password_hash) VALUES
  ('Admin', 'DOST', 'admin@dost.gov.az', '$2a$12$3UxuIBwpOx1qGAxs.WKKBeHJzLiKswNkXgA01jrF/etPcoT2RABX6')
ON CONFLICT (email) DO NOTHING;

-- ---------- 5. SEED: NÜMUNƏ KÖNÜLLÜLƏR (istəyə bağlı, frontend mock datasına uyğun) ----------

INSERT INTO volunteers (first_name, last_name, shifts, club_count, initiative_count, remaining_leave_hours) VALUES
  ('Murad',  'Əliyev',      ARRAY['seher'],                    5, 2, 1),
  ('Leyla',  'Məmmədova',   ARRAY['gunorta'],                  3, 0, 0),
  ('Ramin',  'Süleymanlı',  ARRAY['axsam'],                    7, 1, 2),
  ('Günay',  'Həsənova',    ARRAY['seher','gunorta'],          4, 3, 0),
  ('Solmaz', 'Quliyeva',    ARRAY['gunorta','axsam'],          2, 1, 3),
  ('Şahin',  'Kərimov',     ARRAY['seher'],                    6, 0, 0),
  ('Aysel',  'İbrahimova',  ARRAY['seher','gunorta','axsam'],  8, 4, 0),
  ('Elvin',  'Rzayev',      ARRAY['axsam'],                    1, 0, 3),
  ('Nigar',  'Abbasova',    ARRAY['gunorta'],                  3, 2, 1),
  ('Tural',  'Nəbiyev',     ARRAY['seher'],                    0, 0, 0),
  ('Fidan',  'Cəfərova',    ARRAY['axsam'],                    5, 1, 0),
  ('Kamran', 'Orucov',      ARRAY['gunorta'],                  2, 0, 2)
ON CONFLICT DO NOTHING;

-- ---------- 6. ROW LEVEL SECURITY ----------
-- Backend service_role açarı ilə işlədiyi üçün RLS aktivləşdirilir,
-- lakin anon açar ilə birbaşa giriş bağlanır (bütün sorğular backend-dən keçir).

ALTER TABLE team_leaders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SON. Uğurla icra olunduqda 9 cədvəl, 8 xidmət sahəsi,
-- 1 admin hesabı və 12 nümunə könüllü yaradılmış olacaq.
-- ============================================================
