import jwt from "jsonwebtoken";
import User from "../db/User.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server cannot start.");
  process.exit(1);
}

/**
 * Middleware to protect routes and verify JWT token.
 */
export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided, authorization denied" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Reject soft-deleted users — their JWT is still valid until expiry but account is gone
    if (user.isDeleted) {
      return res.status(401).json({ message: "Account has been deleted" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};

/**
 * Middleware to require completed onboarding (resume uploaded).
 * Must be used after `protect`.
 */
export const requireOnboarded = (req, res, next) => {
  if (!req.user.resume) {
    return res.status(403).json({ message: "Please complete onboarding first." });
  }
  next();
};
