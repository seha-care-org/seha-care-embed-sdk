import type { NextConfig } from "next";
import { resolve } from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@seha-care/embed-sdk"],
  turbopack: { root: resolve(process.cwd(), "../..") },
};

export default config;
