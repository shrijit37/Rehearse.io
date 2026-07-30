import express from "express";
import { getUser, updateProfile, onboard, getConsent, updateConsent, exportData, deleteAccount } from "./user.controller";

const router = express.Router();

router.get("/", getUser);
router.patch("/profile", updateProfile);
router.post("/onboard", onboard);
router.get("/consent", getConsent);
router.post("/consent", updateConsent);
router.post("/export-data", exportData);
router.delete("/delete-account", deleteAccount);

export default router;