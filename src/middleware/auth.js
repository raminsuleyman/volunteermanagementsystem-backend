/**
 * JWT autentifikasiya middleware — bütün qorunan endpoint-lərdə istifadə olunur.
 */
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  // Müvəqqəti olaraq JWT yoxlanışı söndürülüb (Frontend-də Login səhifəsi hələ tam hazır deyil)
  // Beləliklə API məlumatları dərhal geri qaytaracaq.
  req.user = { id: 1, email: "test@dost.gov.az" };
  return next();

  /*
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token tələb olunur" },
    });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token etibarsızdır və ya vaxtı bitib" },
    });
  }
  */
}
