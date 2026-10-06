/* Applies src/db/migrations/*.sql in order, tracking them in schema_migrations. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

async function main() {
  const client = new Client(url); // WebSocket client: supports multi-statement SQL files
  await client.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name as string));
    const dir = join(process.cwd(), "src/db/migrations");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      if (applied.has(f)) continue;
      console.log("applying", f);
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(join(dir, f), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    console.log("migrations up to date");
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
