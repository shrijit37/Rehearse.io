import express from "express";
import type { Express, Request, Response } from "express";
import authRoutes from "./modules/auth/auth.routes"
import userRoutes from "./modules/user/user.routes"
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { authenticateToken } from "./middleware/auth.middleware";




connectDB();
const port: number = env.PORT;
const app: Express = express();


//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



//routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);

app.get("/health", (req: Request, res: Response) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})