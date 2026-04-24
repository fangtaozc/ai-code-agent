import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: '/bridge',
  // Allow both localhost and 127.0.0.1 in dev (they are the same machine but
  // different origins from the browser's perspective, which causes Next.js 15+
  // to warn about cross-origin /_next/* requests).
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
