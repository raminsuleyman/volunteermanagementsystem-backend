/**
 * Zod validasiya middleware — sorğu gövdəsini yoxlayır (BACKEND_GUIDE.md §7).
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return res.status(422).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: msg },
    });
  }
  req.body = result.data;
  next();
};

