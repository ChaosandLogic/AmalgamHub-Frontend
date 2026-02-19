/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Skip ESLint during builds in production
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  async rewrites() {
    // Use API_URL from environment (for Docker/remote) or default to localhost for local dev
    const apiUrl = process.env.API_URL || 'http://localhost:3002';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ]
  },
}

export default nextConfig





