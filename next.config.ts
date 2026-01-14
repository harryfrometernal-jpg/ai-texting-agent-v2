import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force dynamic rendering for auth pages to avoid build-time evaluation issues
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: '/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
