import type { NextConfig } from "next";
import { resolve } from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: resolve(process.cwd(), "../..") },
};

export default config;
