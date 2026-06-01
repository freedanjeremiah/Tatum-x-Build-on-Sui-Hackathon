import TokensClient from "@/components/TokensClient";

export const metadata = {
  title: "My License Tokens — OpenVault",
  description: "License tokens held by your connected wallet, read on-chain.",
};

/** Wallet-gated page; the client wrapper handles connect/Privy-absent states. */
export default function TokensPage() {
  return <TokensClient />;
}
