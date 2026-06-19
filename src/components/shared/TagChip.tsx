export function TagChip({
  label,
  tone,
}: {
  label: string;
  tone?: "default" | "amber" | "teal";
}) {
  return <span className={`chip ${tone ?? "default"}`}>{label}</span>;
}
