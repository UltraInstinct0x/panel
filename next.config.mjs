/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    // Ensure markdown post sources are present in standalone runtime output.
    outputFileTracingIncludes: {
      '/*': ['./content/blog/**/*'],
    },
  },
};
export default nextConfig;
