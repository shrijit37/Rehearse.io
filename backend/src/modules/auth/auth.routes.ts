import express, { type Router } from "express";
import { claim, session } from "./auth.controller.ts";
import { authenticateToken } from "../../middleware/auth.middleware.ts";

const router: Router = express.Router();

router.get("/session", authenticateToken, session);
router.post("/claim", authenticateToken, claim);
export default router;