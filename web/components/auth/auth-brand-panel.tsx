import { Users, ClipboardList, Activity, BarChart3, ShieldCheck } from "lucide-react";

/* What the portal covers — mirrors the sidebar modules. */
const MODULES = [
  { label: "Patient registration", icon: Users },
  { label: "Treatment phases", icon: ClipboardList },
  { label: "Daily dose monitoring", icon: Activity },
  { label: "Reports", icon: BarChart3 },
];

/* Decorative dose calendar: six weeks of daily doses, a few missed, today
   ringed, the rest of the week still ahead. Fixed pattern so server and
   client render identically. */
const WEEKS = 6;
const TODAY = 38;
const MISSED = new Set([9, 23, 31]);
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function Logo({ size }: { size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-[12px]" : "h-9 w-9 rounded-[10px]";
  const img = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/imports/image-2.png" alt="Capiz Emmanuel Hospital logo" className={`${img} object-contain`} />
    </div>
  );
}

function DoseCalendar() {
  return (
    <div aria-hidden="true" className="auth-dose-card w-full max-w-[340px] rounded-[18px] p-5">
      <div className="grid grid-cols-7 gap-x-3 gap-y-2.5">
        {DAY_LETTERS.map((d, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-white/55">
            {d}
          </span>
        ))}
        {Array.from({ length: WEEKS * 7 }).map((_, i) => {
          const state =
            i === TODAY ? "today" : i > TODAY ? "ahead" : MISSED.has(i) ? "missed" : "taken";
          return (
            <span key={i} className="flex justify-center">
              <span className={`auth-dose auth-dose--${state}`} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Brand side of the sign-in screens. Full panel on desktop, a short band on mobile. */
export function AuthBrandPanel() {
  return (
    <>
      {/* Mobile / tablet band */}
      <div className="auth-brand flex items-center gap-3 px-5 py-4 text-white lg:hidden">
        <Logo size="sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[14px] font-bold leading-none">Capiz Emmanuel Hospital</span>
          <span className="text-[12px] leading-none text-white/70">TB DOTS Center</span>
        </div>
      </div>

      {/* Desktop panel */}
      <aside className="auth-brand sticky top-0 isolate hidden h-screen flex-col justify-between overflow-hidden px-12 py-10 text-white lg:flex xl:px-16">
        {/* Blurred TB DOTS Center seal behind the panel content */}
        <div aria-hidden="true" className="auth-brand-seal" />

        <div className="flex items-center gap-3">
          <Logo size="lg" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold leading-none">DOTS Daily</span>
            <span className="text-[12.5px] leading-none text-white/70">TB DOTS Center</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="max-w-[14ch] text-[38px] font-bold leading-[1.08] tracking-[-0.03em] xl:text-[44px]">
              Capiz Emmanuel Hospital
            </h2>
            <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-white/75">
              Tuberculosis treatment monitoring for the TB DOTS Center team.
            </p>
          </div>

          <DoseCalendar />

          <ul className="grid max-w-[420px] grid-cols-2 gap-x-6 gap-y-3">
            {MODULES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-2.5 text-[13.5px] font-medium text-white/90">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/10">
                  <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-[12.5px] text-white/65">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
          For authorized DOTS Center staff only.
        </p>
      </aside>
    </>
  );
}
