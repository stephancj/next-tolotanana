
import type { NextConfig } from "next";
// @ts-expect-error PWA module might not have correct types or resolution yet
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default withPWA(nextConfig);
