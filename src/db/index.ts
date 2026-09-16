import { drizzle } from "drizzle-orm/neon-http";
import { relations } from "./relations";

/**
 * Checked here rather than left to `drizzle(undefined!)`, which fails deep inside the driver with
 * no hint of what's wrong. On Vercel, set it in Project → Settings → Environment Variables for
 * every environment the build runs in, or `next build` stops on the first module that imports this.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env (locally) or add it to the project's environment variables.");
}

export const db = drizzle(connectionString, { relations });
export * as schema from "./schema";
