import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared client is TypeScript source in the workspace.
  transpilePackages: ["@allowance/client"],
  reactStrictMode: true,
  // /api/agent reads keys/agent.json at runtime; never copy key files into a build.
  outputFileTracingExcludes: { "*": ["../../keys/**", "../../.env*"] },
};

export default config;
