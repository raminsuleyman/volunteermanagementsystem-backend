/**
 * DOST Növbə İdarəetmə Sistemi — Backend API
 * Express + Supabase (BACKEND_GUIDE.md-ə uyğun)
 */
import cors from "cors";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/error.js";
import areasRoutes from "./routes/areas.js";
import authRoutes from "./routes/auth.js";
import shiftsRoutes from "./routes/shifts.js";
import statsRoutes from "./routes/stats.js";
import volunteersRoutes from "./routes/volunteers.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://volunteermanagementsystem-frontend.vercel.app",
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [])
    ],
    credentials: true,
  })
);
app.use(express.json());

// Login üçün rate limit: 5 cəhd/dəqiqə (BACKEND_GUIDE.md §7)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Çox sayda cəhd. 1 dəqiqə sonra yenidən yoxlayın." },
  },
});
app.use("/api/auth/login", loginLimiter);

// Sağlamlıq yoxlaması
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", time: new Date().toISOString() } });
});

app.use("/api/auth", authRoutes);
app.use("/api/volunteers", volunteersRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/stats", statsRoutes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`DOST Növbə Backend API → http://localhost:${port}/api`);
});
