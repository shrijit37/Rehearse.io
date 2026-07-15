import express from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import {
    handleCreateOrganization,
    handleGetMyOrganizations,
    handleGetOrganization,
    handleUpdateOrganization,
    handleInviteMember,
} from "./organization.controller";

const router = express.Router();

// All org routes require authentication
router.use(authenticateToken);

router.post("/", authorize("recruiter"), handleCreateOrganization);
router.get("/", handleGetMyOrganizations);
router.get("/:id", handleGetOrganization);
router.put("/:id", handleUpdateOrganization);
router.post("/:id/invite", authorize("recruiter"), handleInviteMember);

export default router;
