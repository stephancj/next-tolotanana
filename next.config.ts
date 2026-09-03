
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./app/i18n.ts');

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    importScripts: ["/sync-events.js"],
    runtimeCaching: [{
      // Sync and medical APIs must never be served from a stale service-worker cache.
      urlPattern: /\/api\/(sync|records|editions|surgeons|record_surgeons|monitoring|volunteers|public)(\/.*)?$/,
      handler: "NetworkOnly",
      options: { cacheName: "medical-api-network-only" },
    }],
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default withPWA(withNextIntl(nextConfig));
