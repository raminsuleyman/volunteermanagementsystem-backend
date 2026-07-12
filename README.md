# DOST Növbə İdarəetmə Sistemi — Backend API

**Texnologiyalar:** Node.js (≥18) · Express · Supabase (PostgreSQL) · JWT · Zod

Bu backend, frontend layihəsindəki `BACKEND_GUIDE.md` sənədinə birəbir uyğun hazırlanmışdır. Bütün endpoint-lər, cavab strukturları və biznes qaydaları həmin guide-dakı kontrakta əməl edir.

---

## 1. Supabase Quruluşu (5 dəqiqə)

**Addım 1.** [supabase.com](https://supabase.com) → yeni layihə yaradın (region: Frankfurt tövsiyə olunur).

**Addım 2.** Dashboard → **SQL Editor** → **New query** → `supabase/schema.sql` faylının bütün məzmununu yapışdırın → **RUN**.

Uğurla icra olunduqda yaradılır: 9 cədvəl, 8 xidmət sahəsi (seed), 1 admin hesabı və 12 nümunə könüllü.

**Addım 3.** Dashboard → **Project Settings → API** bölməsindən götürün:

| Parametr | Haradan |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → `service_role` (secret) |

> **Diqqət:** `service_role` açarı yalnız backend-də istifadə olunur, heç vaxt frontend-ə verilmir. RLS aktivdir — anon açarla birbaşa cədvəllərə giriş bağlıdır.

---

## 2. Backend-in işə salınması

```bash
cd dost-novbe-backend
npm install
cp .env.example .env      # .env faylını öz dəyərlərinizlə doldurun
npm run dev               # development (auto-reload)
npm start                 # production
```

Server default olaraq `http://localhost:4000/api` ünvanında işləyir. Yoxlama: `GET /api/health`.

---

## 3. İlkin giriş hesabı

SQL skripti aşağıdakı Team Leader hesabını yaradır:

| Email | Şifrə |
|---|---|
| `admin@dost.gov.az` | `Dost2026!` |

İlk girişdən sonra şifrəni dəyişdirmək tövsiyə olunur. Yeni Team Leader əlavə etmək üçün `password_hash` sahəsinə bcrypt hash yazılmalıdır (Node-da: `require('bcryptjs').hashSync('şifrə', 12)`).

---

## 4. Endpoint Xülasəsi

| Metod | Endpoint | Təsvir |
|---|---|---|
| POST | `/api/auth/login` | Giriş — accessToken + refreshToken qaytarır |
| POST | `/api/auth/refresh` | Access token yeniləmə |
| POST | `/api/auth/logout` | Çıxış (refresh token ləğvi) |
| GET | `/api/auth/me` | Cari istifadəçi |
| GET | `/api/volunteers` | Aktiv könüllülər (`?active=false` ilə hamısı) |
| GET | `/api/volunteers/:id` | Könüllü detalı |
| POST | `/api/volunteers` | Yeni könüllü |
| PUT | `/api/volunteers/:id` | Könüllü yeniləmə |
| DELETE | `/api/volunteers/:id` | Soft delete (arxiv qorunur) |
| GET | `/api/volunteers/:id/history` | Könüllünün keçmiş növbələri |
| POST | `/api/volunteers/:id/leave` | İcazə borcu +3 saat (SRS §12) |
| POST | `/api/volunteers/:id/extra-service` | Təşəbbüs — pəncərə validasiyası ilə (SRS §13) |
| GET | `/api/shifts` | Arxiv siyahısı (filtr: `?date=`, `?shiftType=`, səhifələmə) |
| GET | `/api/shifts/:id` | Növbənin tam detalı (slotlar, təyinatlar, qeydlər) |
| POST | `/api/shifts` | Növbəni yadda saxla (Save, SRS §9) |
| PUT | `/api/shifts/:id` | Növbəni yenilə (24 saat pəncərəsi) |
| GET | `/api/areas` | 8 xidmət sahəsi |
| GET | `/api/stats/overview` | Ana səhifə statistikası |
| GET | `/api/health` | Sağlamlıq yoxlaması (auth tələb etmir) |

Bütün qorunan endpoint-lər `Authorization: Bearer <accessToken>` başlığı tələb edir.

---

## 5. Frontend inteqrasiyası

Frontend layihəsində `client/src/lib/store.ts` funksiyalarını bu API-yə yönləndirin:

```ts
// Nümunə: getVolunteers()
const res = await fetch(`${API_URL}/api/volunteers`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { data } = await res.json();
```

| store.ts funksiyası | API çağırışı |
|---|---|
| `getVolunteers()` | `GET /api/volunteers` |
| `addVolunteer(v)` | `POST /api/volunteers` |
| `updateVolunteer(v)` | `PUT /api/volunteers/:id` |
| `deactivateVolunteer(id)` | `DELETE /api/volunteers/:id` |
| `getShifts()` | `GET /api/shifts` |
| `getShiftById(id)` | `GET /api/shifts/:id` |
| `saveShift(shift)` | `POST /api/shifts` |

**Qeyd:** Frontend mock datasında könüllü id-ləri `"v1"` kimi string-dir; real API-da isə rəqəmsal (`1`) olur. İnteqrasiya zamanı tiplərdə `id: string` → `id: number` uyğunlaşdırması edilməlidir.

---

## 6. Layihə strukturu

```
dost-novbe-backend/
  supabase/
    schema.sql          # Supabase SQL Editor-da RUN ediləcək tam skript
  src/
    index.js            # Express app, route qeydiyyatı, rate limit
    lib/
      supabase.js       # Supabase client (service_role)
      constants.js      # Növbə saatları, əlavə xidmət pəncərələri, slot generatoru
    middleware/
      auth.js           # JWT yoxlaması
      error.js          # ApiError, mərkəzi xəta emalı
      validate.js       # Zod validasiyası
    routes/
      auth.js           # login / logout / refresh / me
      volunteers.js     # CRUD + history + leave + extra-service
      shifts.js         # arxiv, save, detal, yeniləmə
      areas.js          # xidmət sahələri
      stats.js          # ana səhifə statistikası
  .env.example
  package.json
```

---

## 7. Yerləşdirmə (Deploy)

İstənilən Node.js hostinqində işləyir (Railway, Render, Fly.io, VPS). Tələblər: `npm install` → `.env` dəyərləri → `npm start`. `CORS_ORIGIN` dəyişənini frontend-in yayımlandığı domenə uyğunlaşdırın (vergüllə ayrılmış bir neçə domen dəstəklənir).
