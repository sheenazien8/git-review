import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // required for the slim Docker image (see Dockerfile)
  output: "standalone",
  // Silence Turbopack error when webpack config is present (from Serwist)
  turbopack: {},
};

export default withSerwist(nextConfig);
