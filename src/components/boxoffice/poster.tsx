import { useState } from "react";
import { cn } from "@/lib/utils";

export function Poster({
  posterKey,
  title,
  className,
}: {
  posterKey: string;
  title: string;
  className?: string;
}) {
  const [src, setSrc] = useState(posterKey ? `/posters/${posterKey}.jpg` : "");

  if (!posterKey) {
    return (
      <div className={cn("flex h-full w-full items-end bg-surface p-3", className)}>
        <span className="font-display text-sm leading-tight text-paper">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={cn("h-full w-full object-cover", className)}
      onError={() => {
        if (src.endsWith(".jpg")) setSrc(`/posters/${posterKey}.svg`);
      }}
    />
  );
}
