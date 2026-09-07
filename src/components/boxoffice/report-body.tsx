import { cn } from "@/lib/utils";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function ReportBody({ body, className }: { body: string; className?: string }) {
  const blocks = body.split(/\n{2,}/);
  return (
    <div className={cn("report-body", className)}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return <h2 key={i}>{trimmed.replace(/^##\s+/, "")}</h2>;
        }
        return <p key={i}>{inline(trimmed.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}
