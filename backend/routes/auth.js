import express from "express";
import { signup, login, getUser, onboard, updateProfile } from "../controller/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/getuser", protect, getUser);
router.post("/onboard", protect, onboard);
router.patch("/profile", protect, updateProfile);

export default router;
