import express from "express";
import { signup, login, getUser } from "../controller/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/getuser", getUser);

export default router;
