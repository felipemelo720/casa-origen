import type { LucideIcon } from 'lucide-react';

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border bg-background flex items-center gap-3 rounded-xl border p-3">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <p className="text-muted-foreground min-w-0 truncate text-sm">{label}</p>
      <p className="ml-auto shrink-0 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
