/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Deshabilitar verificaciones durante el build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configuración para Docker
  experimental: {
    outputFileTracingRoot: './',
  },
}

module.exports = nextConfig