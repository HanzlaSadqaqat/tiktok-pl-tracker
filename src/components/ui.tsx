import { tone } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", tone: t = "navy" }: { title?: string; children: React.ReactNode; className?: string; tone?: "navy" | "slate" | "accent" }) {
  const bg = t === "slate" ? "bg-slate" : t === "accent" ? "bg-accent" : "bg-navy";
  return (
    <section className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {title && <h2 className={`${bg} px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white`}>{title}</h2>}
      {children}
    </section>
  );
}

export function MetricRow({
  label,
  value,
  signed,
  strong,
}: {
  label: string;
  value: string;
  signed?: number;
  strong?: boolean;
}) {
  const color = signed !== undefined ? tone(signed) : strong ? "text-accent" : "text-navy";
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-line/70 px-4 py-2.5 last:border-0 ${strong ? "bg-accent-soft" : ""}`}>
      <span className={`text-sm ${strong ? "font-semibold text-navy" : "text-ink/80"}`}>{label}</span>
      <span className={`num text-right font-semibold ${strong ? "text-base" : "text-sm"} ${color}`}>{value}</span>
    </div>
  );
}

const BADGE: Record<string, string> = {
  Profitable: "bg-pos-soft text-pos",
  "Low margin": "bg-warn-soft text-warn",
  Loss: "bg-neg-soft text-neg",
  Cancelled: "bg-canvas text-muted",
  Realized: "bg-pos-soft text-pos",
  Estimated: "bg-accent-soft text-accent",
  Excluded: "bg-canvas text-muted",
  Paid: "bg-pos-soft text-pos",
  Pending: "bg-warn-soft text-warn",
};

export function Badge({ children }: { children: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[children] ?? "bg-canvas text-ink"}`}>{children}</span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center text-sm text-muted">{children}</div>;
}
