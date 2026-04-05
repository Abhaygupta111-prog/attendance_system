import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // ── Webpack: keep face-api / TensorFlow out of the server bundle ──
  // They use browser APIs and must only run client-side.
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent TF.js / face-api from being bundled into the server chunk
      const externals = [
        '@vladmandic/face-api',
        'face-api.js',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-node',
        '@tensorflow/tfjs-core',
        '@tensorflow/tfjs-backend-webgl',
        'canvas',
      ];
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, ...externals]
        : externals;
    }
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'ui-avatars.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
