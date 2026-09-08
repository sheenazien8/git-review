import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // Silence Turbopack error when webpack config is present (from Serwist)
  turbopack: {},
};

export default withSerwist(nextConfig);
