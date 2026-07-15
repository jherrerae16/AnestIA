/** @type {import('next').NextConfig} */
const nextConfig = {
  // Comparte el paquete de esquemas (TS sin transpilar) con el monorepo.
  transpilePackages: ['@anestia/shared'],
  experimental: {
    // permite usar código del workspace
    externalDir: true,
  },
};

export default nextConfig;
