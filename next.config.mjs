/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',  
      'node_modules/@esbuild/linux-x64',
      'node_modules/**/test/**/*',
      'node_modules/thread-stream/test/**/*',
      'node_modules/thread-stream/bench.js',
      'node_modules/thread-stream/README.md',
      'node_modules/thread-stream/LICENSE',
    ],
  },
  webpack: (config, { isServer }) => {
    // Ignore problematic files and modules
    config.resolve.alias = {
      ...config.resolve.alias,
      'tap': false,
      'fastbench': false,
      'desm': false,
      'pino-elasticsearch': false,
      'why-is-node-running': false,
    }

    // Exclude test files from bundling
    config.module.rules.push({
      test: /\/test\//,
      use: 'ignore-loader',
    })

    config.module.rules.push({
      test: /\.(test|spec)\.(js|mjs|ts|tsx)$/,
      use: 'ignore-loader', 
    })

    config.module.rules.push({
      test: /(bench|syntax-error)\.(js|mjs)$/,
      use: 'ignore-loader',
    })

    config.module.rules.push({
      test: /(LICENSE|README\.md)$/,
      use: 'ignore-loader',
    })

    // Handle binary files
    config.module.rules.push({
      test: /\.(zip|yml|sh)$/,
      use: 'ignore-loader',
    })

    // Add fallbacks for client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }

    return config
  },
}

export default nextConfig
