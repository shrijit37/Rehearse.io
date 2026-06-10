// Centralized configuration constants for the backend
// These values should be kept in sync with ai-service/app/main.py

export const MAX_AUDIO_SIZE_MB = parseInt(process.env.MAX_AUDIO_SIZE_MB || "25");
export const MAX_AUDIO_SIZE = MAX_AUDIO_SIZE_MB * 1024 * 1024;
