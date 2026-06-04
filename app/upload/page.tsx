import UploadWizard from "@/components/UploadWizard";

// The wizard is a client component and renders inside the WasmGate provided by
// the root layout, so Sui/Seal clients are only ever acquired once the secure
// runtime is ready.
export default function UploadPage() {
  return <UploadWizard />;
}
