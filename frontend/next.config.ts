import type { NextConfig } from 'next';

const backendOrigin = process.env.BACKEND_ORIGIN?.trim() || 'http://50.6.45.3';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin.replace(/\/$/, '')}/api/v1/:path*`,
      },
      {
        source: '/api/health',
        destination: `${backendOrigin.replace(/\/$/, '')}/api/health`,
      },
    ];
  },
};

export default nextConfig;
