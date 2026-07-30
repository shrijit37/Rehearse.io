import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

interface AppError extends Error {
    status?: number;
}

/**
 * Express error handler. Centralizes error responses and logging.
 * Placed last in the middleware chain.
 */
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
    console.error(err.stack || err.message);

    // Multer / body-parser errors carry a status code — respect it.
    const status = err.status || 500;
    res.status(status).json({
        message: err.message || "Internal Server Error",
        error: env.APP_ENV === "production" ? undefined : err.stack,
    });
}