import express from "express";
import {
    getProfile,
    getMedia,
    parseResume,
    updateProfile,
    onboard,
    getConsent,
    updateConsent,
    exportData,
    deleteAccount,
} from "./user.controller";

const router = express.Router();

// The candidate's own record, and the files it refers to.
router.get("/", getProfile);
router.patch("/profile", updateProfile);
router.get("/profile/media/:kind", getMedia);
router.post("/profile/parse-resume", parseResume);

router.post("/onboard", onboard);
router.get("/consent", getConsent);
router.post("/consent", updateConsent);
router.post("/export-data", exportData);
router.delete("/delete-account", deleteAccount);

export default router;
