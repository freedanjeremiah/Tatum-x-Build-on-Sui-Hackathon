// Vitest global setup. Provides a placeholder Tessera package id so unit tests
// that construct a RegistryClient (royalty/group/dispute, with a mocked
// SuiClient) can run without a real deployment or network. Integration tests
// (RUN_INTEGRATION=1) read the real id from the environment, which takes
// precedence when set.
process.env.OV_TESSERA_PACKAGE_ID =
  process.env.OV_TESSERA_PACKAGE_ID ||
  process.env.NEXT_PUBLIC_OV_TESSERA_PACKAGE_ID ||
  "0x0000000000000000000000000000000000000000000000000000000000000abc";
