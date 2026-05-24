export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const IS_MOCK = !PRIVY_APP_ID || process.env.NEXT_PUBLIC_MOCK === "1";
export const PINATA_JWT = process.env.PINATA_JWT ?? "";
