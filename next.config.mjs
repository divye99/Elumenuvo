/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project (a stray lockfile in the home
  // directory otherwise makes Next infer the wrong root).
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
