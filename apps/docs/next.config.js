/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/:path*.md",
        destination: "/api/raw/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
