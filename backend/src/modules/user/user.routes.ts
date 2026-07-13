import express from "express";
import { getUser, updateProfile, onboard } from "./user.controller";

const router = express.Router();

router.get("/", getUser);
router.patch("/profile", updateProfile);
router.post("/onboard", onboard);

export default router;