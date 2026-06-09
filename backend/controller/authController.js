import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../db/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../middleware/auditLog.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  process.exit(1);
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role, consentGiven, consentVersion } = req.body;

  // Input validation
  if (!name || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ message: "Name must be between 2 and 100 characters" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Please provide a valid email address" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  if (password.length > 128) {
    return res.status(400).json({ message: "Password must not exceed 128 characters" });
  }
  if (role && !['recruiter', 'candidate'].includes(role)) {
    return res.status(400).json({ message: "Role must be either 'recruiter' or 'candidate'" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) return res.status(400).json({ message: "User already exists" });
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: role || 'candidate',
    consentGiven: consentGiven === true,
    consentDate: consentGiven === true ? new Date() : undefined,
    consentVersion: consentGiven === true ? (consentVersion || '1.0') : undefined,
  });
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

  await logAudit({ userId: user._id, action: "signup", details: `User signed up as ${user.role}`, req });

  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase().trim() }).select("+password");
  if (!user || user.isDeleted) return res.status(400).json({ message: "Invalid credentials" });
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

  await logAudit({ userId: user._id, action: "login", details: "User logged in", req });

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      onboarded: Boolean(user.resume),
    },
    token,
  });
});

export const getUser = asyncHandler(async (req, res) => {
  // First check if user has resume data (for onboarded status), then strip blobs
  const user = await User.findById(req.user._id).select("-password");
  if (!user || user.isDeleted) return res.status(404).json({ message: "User not found" });

  const onboarded = Boolean(user.resume);

  // Strip large base64 blobs from response — they should be fetched separately if needed
  const userData = user.toObject();
  delete userData.resume;
  delete userData.photo;
  delete userData.audio;
  delete userData.resumeName;

  res.json({ user: { ...userData, onboarded } });
});

export const onboard = asyncHandler(async (req, res) => {
  const { resumeName, resume, photo, audio } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { resumeName, resume, photo, audio },
    { new: true }
  );
  if (!user) return res.status(404).json({ message: "User not found" });

  await logAudit({ userId: user._id, action: "onboard", details: "User completed onboarding", req });

  res.json({ message: "Onboarding completed successfully", user });
});
