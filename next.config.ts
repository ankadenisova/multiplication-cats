import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  // UI language (en | ru). Copied into the client bundle at build time so that
  // client components read the same value as the server. See src/lib/i18n.
  env: { APP_LOCALE: process.env.APP_LOCALE ?? "en" },
};

export default nextConfig;
