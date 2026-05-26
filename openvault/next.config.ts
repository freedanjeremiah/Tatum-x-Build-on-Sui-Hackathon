import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / Node-only deps out of the bundler. better-sqlite3 is a native
  // addon; helia/libp2p pull optional native transports (node-datachannel) that
  // aren't built here. Marking them external lets them load at runtime and
  // prevents the bundler from eagerly resolving unbuilt native addons in the
  // dynamic-import branches of lib/storage (real-mode only).
  serverExternalPackages: [
    "better-sqlite3",
    "helia",
    "@helia/unixfs",
    "libp2p",
    "@libp2p/webrtc",
    "node-datachannel",
    "pinata-web3",
  ],
};

export default nextConfig;
