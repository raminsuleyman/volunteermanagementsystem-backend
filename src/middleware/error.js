/**
 * Mərkəzi xəta emalı — BACKEND_GUIDE.md §5-dəki status kodlarına uyğun.
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(_req, res) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Endpoint tapılmadı" },
  });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  console.error("Server xətası:", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Server xətası baş verdi" },
  });
}

/** Async route wrapper — try/catch təkrarını aradan qaldırır */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
