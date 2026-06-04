import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / Node-only deps out of the bundler. better-sqlite3 is a native
  // addon used by the read-model indexer; marking it external lets it load at
  // runtime instead of being eagerly resolved by the bundler. The old EVM/IPFS
  // externals (helia, @helia/unixfs, libp2p, @libp2p/webrtc, node-datachannel,
  // pinata-web3) were removed in the Sui + Walrus migration — none are imported
  // anymore (storage goes through @mysten/walrus).
  serverExternalPackages: ["better-sqlite3"],
  // /about was merged into the landing page (its unique "how it works" pillars
  // now render under the artifact grid). Redirect old links to the root.
  async redirects() {
    return [{ source: "/about", destination: "/", permanent: true }];
  },
};

export default nextConfig;
