import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  createOrganization,
  getMyOrganizations,
  getOrganization,
  updateOrganization,
  inviteMember,
} from "../controller/organizationController.js";

const router = express.Router();

// All org routes require authentication
router.use(protect);

router.post("/", authorize("recruiter"), createOrganization);
router.get("/", getMyOrganizations);
router.get("/:id", getOrganization);
router.put("/:id", updateOrganization);
router.post("/:id/invite", authorize("recruiter"), inviteMember);

export default router;
