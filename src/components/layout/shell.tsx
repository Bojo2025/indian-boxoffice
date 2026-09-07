import { Link, useRouterState } from "@tanstack/react-router";
import { Download, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Pulse" },
  { to: "/now", label: "Now playing" },
  { to: "/rankings", label: "2026" },
  { to: "/movies", label: "Catalogue" },
  { to: "/report", label: "Daily report" },
  { to: "/desk", label: "Desk" },
  { to: "/wires", label: "Wires" },
  { to: "/sources", label: "Sources" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-[11px] font-semibold tracking-[0.12em] text-accent-fg">
              IBO
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-medium tracking-[-0.03em] text-fg">
                Indian Box Office
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
                Consensus desk
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-h-11 items-center px-3 text-sm transition-colors duration-150",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/download"
              className={cn(
                "ml-2 inline-flex min-h-11 items-center gap-1.5 px-3 text-sm transition-colors duration-150",
                pathname.startsWith("/download") ? "text-fg" : "text-paper hover:text-fg",
              )}
            >
              <Download className="size-3.5" />
              Download
            </Link>
          </nav>

          <button
            type="button"
            className="flex size-11 items-center justify-center text-fg lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open ? (
          <nav className="border-t border-border px-4 py-2 lg:hidden">
            {[...NAV, { to: "/download", label: "Download" }].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center border-b border-border/60 text-sm text-paper last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <div id="main">{children}</div>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-lg text-fg">Indian Box Office</p>
            <p className="mt-1 max-w-md text-sm text-muted">
              Independent consensus of published theatrical estimates. India has no official auditor —
              we publish the spread.
            </p>
          </div>
          <p className="text-xs text-subtle">Figures in ₹ crore. India nett / worldwide gross.</p>
        </div>
      </footer>
    </div>
  );
}
