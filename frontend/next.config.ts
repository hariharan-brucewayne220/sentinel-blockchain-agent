import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ['@rainbow-me/rainbowkit'],
  turbopack: {},
}

export default nextConfig
