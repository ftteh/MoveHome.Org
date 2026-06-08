/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // A2A Agent Card discovery at the spec well-known locations.
      { source: '/.well-known/agent.json', destination: '/api/agent-card' },
      { source: '/.well-known/agent-card.json', destination: '/api/agent-card' }
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'app.giraffe360.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' }
    ]
  }
};

module.exports = nextConfig;
