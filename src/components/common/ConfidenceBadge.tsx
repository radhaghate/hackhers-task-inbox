export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "text-emerald-700 bg-emerald-50" : pct >= 55 ? "text-amber-700 bg-amber-50" : "text-slate-600 bg-slate-100";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`} title="AI confidence in this classification">
      {pct}% confidence
    </span>
  );
}
