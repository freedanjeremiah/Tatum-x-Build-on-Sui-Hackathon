export default function Spinner({ lg = false }: { lg?: boolean }) {
  return <span className={`spinner${lg ? " spinner-lg" : ""}`} />;
}
