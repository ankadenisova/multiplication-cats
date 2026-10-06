import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

/** Neon HTTP driver. Tagged template: sql`select ... ${param}` */
export const sql = neon(process.env.DATABASE_URL);

/** Timezone used for "today" calculations (family lives in Lisbon). */
export const APP_TZ = "Europe/Lisbon";
