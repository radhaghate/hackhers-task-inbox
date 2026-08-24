export function AiSuggestionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
      <span aria-hidden>✨</span> {children}
    </span>
  );
}
