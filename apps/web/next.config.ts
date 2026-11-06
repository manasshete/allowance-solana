import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared client is TypeScript source in the workspace.
  transpilePackages: ["@allowance/client"],
  reactStrictMode: true,
};

export default config;
