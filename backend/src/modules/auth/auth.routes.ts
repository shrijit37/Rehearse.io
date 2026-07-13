import express, { type Router } from "express";
import { signup, login } from "./auth.controller.ts";

const router: Router = express.Router();


router.post("/signup", signup);
router.post("/login", login);
export default router;

