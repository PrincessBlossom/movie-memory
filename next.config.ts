import type { NextConfig } from "next";

/**
 * Security headers on every response.
 *
 * The CSP covers framing, plugins and <base> hijacking. It deliberately
 * leaves out script-src: Next.js injects inline bootstrap scripts, so a strict
 * script policy needs per-request nonces set from middleware. That's listed as
 * a follow-up in the README, not done half-way here with 'unsafe-inline'.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" }, // clickjacking, for older browsers
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
