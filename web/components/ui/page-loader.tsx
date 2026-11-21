import { cn } from "@/lib/utils";

interface IPageLoaderProps {
  /** Full viewport with the brand mark (route guards), or a compact block inside a card. */
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

/** Indeterminate green load bar used wherever the portal waits on auth or a page. */
export function PageLoader({ fullScreen = false, label = "Loading…", className }: IPageLoaderProps) {
  const bar = (
    <div role="status" aria-live="polite" className="flex w-48 flex-col items-center gap-3">
      <div className="load-track">
        <div className="load-bar" />
      </div>
      <span className="text-[12px] font-medium text-text-tertiary">{label}</span>
    </div>
  );

  if (!fullScreen) {
    return (
      <div className={cn("flex min-h-[320px] items-center justify-center", className)}>{bar}</div>
    );
  }

  return (
    <div className={cn("auth-stage flex min-h-screen items-center justify-center px-4", className)}>
      <div className="flex flex-col items-center gap-7">
        <div className="flex items-center gap-3">
          <div className="auth-float flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] bg-white shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/imports/image-2.png" alt="Capiz Emmanuel Hospital logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold leading-none text-text-primary">DOTS Daily</span>
            <span className="text-[12.5px] leading-none text-text-secondary">TB DOTS Center</span>
          </div>
        </div>
        {bar}
      </div>
    </div>
  );
}
