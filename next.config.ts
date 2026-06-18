import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:file*.pdf',
        headers: [
          { key: 'Content-Type', value: 'application/pdf' },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  // @ts-ignore - 'eslint' exists but might have type mismatches in certain environments
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
