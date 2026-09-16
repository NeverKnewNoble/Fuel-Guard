import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    /**
     * Portal pages are dynamic (they read the session), and Next caches those for 0s by default,
     * so every navigation re-ran the page on the server and re-queried the database. 30s of client
     * router cache means going back to a page you just left reuses it. Raise it if you want longer.
     */
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
