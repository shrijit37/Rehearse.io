import express from "express";
import { signup, login, getUser, onboard } from "../controller/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/getuser", protect, getUser);
router.post("/onboard", protect, onboard);

export default router;
