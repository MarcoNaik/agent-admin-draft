/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    "react-markdown",
    "remark-gfm",
    "rehype-highlight",
    "rehype-slug",
  ],
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
