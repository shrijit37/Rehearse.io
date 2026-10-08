import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        // Only used by `drizzle-kit migrate`. At runtime the app reads
        // DATABASE_URL itself; scripts/migrate injects the external URL.
        url: process.env.DATABASE_URL_EXTERNAL || process.env.DATABASE_URL || "",
    },
    strict: true,
    verbose: true,
});
