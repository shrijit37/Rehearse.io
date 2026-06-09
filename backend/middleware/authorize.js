/**
 * Role-based access control middleware.
 * Must be used AFTER the `protect` middleware.
 *
 * Usage: router.get("/some-route", protect, authorize("recruiter"), handler)
 * Usage: router.get("/some-route", protect, authorize("recruiter", "admin"), handler)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role || "none"}.`
      });
    }

    next();
  };
};
