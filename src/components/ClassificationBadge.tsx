const CONFIG: Record<string, { emoji: string; label: string; classes: string }> = {
  strong: { emoji: "🟢", label: "Strong match", classes: "bg-[#EAF3EE] text-moss border-moss/30" },
  moderate: { emoji: "🟡", label: "Moderate — caution", classes: "bg-[#FBF3E4] text-[#8A6A1F] border-[#E6C878]" },
  poor: { emoji: "🔴", label: "Poor match", classes: "bg-[#FBEAE5] text-clay border-clay/30" }
};

export default function ClassificationBadge({ classification }: { classification: string }) {
  const c = CONFIG[classification] || CONFIG.poor;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-sm border ${c.classes}`}>
      <span>{c.emoji}</span>
      <span>{c.label}</span>
    </span>
  );
}
