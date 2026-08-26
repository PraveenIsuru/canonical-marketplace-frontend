import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    /*
     * Product images are served from S3 compatible object storage. Add the real host
     * when the storage bucket exists. The localhost entry covers the local filesystem
     * driver used in development.
     */
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  /*
   * Cache Components stays off. The classic model, meaning `export const revalidate`
   * and `revalidatePath()`, is what the revalidation webhook depends on.
   */
};

export default nextConfig;
