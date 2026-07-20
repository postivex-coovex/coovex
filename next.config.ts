import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ssh2'],
  async redirects() {
    return [
      {
        source: '/onboarding/:path*',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
