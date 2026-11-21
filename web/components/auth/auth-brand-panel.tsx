"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimate, useReducedMotion, type Variants } from "framer-motion";
import { SWAP_DURATION, SWAP_EASE } from "@/components/auth/swap-motion";
import { Users, ClipboardList, Activity, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";

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
/* Share of past days taken, derived from the pattern above. */
const ADHERENCE = Math.round(((TODAY - MISSED.size) / TODAY) * 100);

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* Parent staggers its children; each child rises and fades in. */
const stack: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

function Logo({ size }: { size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-[12px]" : "h-9 w-9 rounded-[10px]";
  const img = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/imports/image-2.png" alt="Capiz Emmanuel Hospital logo" className={`${img} object-contain`} />
    </div>
  );
}

function DoseCalendar() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[330px]">
      <div className="auth-dose-card rounded-[18px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-white/80">Dose calendar</span>
          <span className="text-[11px] text-white/55">Day {TODAY + 1}</span>
        </div>
        <div className="grid grid-cols-7 gap-x-3 gap-y-2">
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
                {/* Doses pop in one after another, like days being ticked off. */}
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.6 + i * 0.018 }}
                  className={`auth-dose auth-dose--${state}`}
                />
              </span>
            );
          })}
        </div>
      </div>

      {/* Floating adherence chip that pops out over the calendar corner. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 1.5 }}
        className="absolute -right-5 -top-5"
      >
        <div className="auth-glass auth-bob flex items-center gap-2 rounded-[12px] px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white text-primary-700">
            <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[14px] font-bold text-white">{ADHERENCE}%</span>
            <span className="mt-1 text-[10.5px] text-white/70">Adherence</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Plays the "in motion" effects while the panel slides to the other side:
 * the content lags behind and blurs slightly (inertia), and a light sheen
 * sweeps across in the direction of travel. Runs only when `swapped` flips,
 * never on first render.
 */
function useSwapMotion(swapped: boolean) {
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();
  const previous = useRef(swapped);

  useEffect(() => {
    if (previous.current === swapped) return;
    previous.current = swapped;
    if (reduceMotion) return;

    // +1 = panel travelling right (to the recovery layout), -1 = back left.
    const dir = swapped ? 1 : -1;
    const timing = { duration: SWAP_DURATION, ease: SWAP_EASE };

    animate(
      ".auth-slide-content",
      {
        x: [0, -44 * dir, 0],
        filter: ["blur(0px)", "blur(2.5px)", "blur(0px)"],
        opacity: [1, 0.7, 1],
      },
      timing
    );
    animate(
      ".auth-slide-sheen",
      {
        x: dir > 0 ? ["-120%", "260%"] : ["260%", "-120%"],
        opacity: [0, 1, 0],
      },
      timing
    );
  }, [swapped, reduceMotion, animate]);

  return scope;
}

/** Brand side of the sign-in card. Full panel on desktop, a short band on mobile. */
export function AuthBrandPanel({ swapped = false }: { swapped?: boolean }) {
  const scope = useSwapMotion(swapped);

  return (
    <>
      {/* Mobile / tablet band */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
        className="auth-brand isolate relative m-2 mb-0 flex items-center gap-3 overflow-hidden rounded-[18px] px-4 py-4 text-white lg:hidden"
      >
        <div aria-hidden="true" className="auth-brand-seal" />
        <Logo size="sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[14px] font-bold leading-none">Capiz Emmanuel Hospital</span>
          <span className="text-[12px] leading-none text-white/70">DOTS Daily · TB DOTS Center</span>
        </div>
      </motion.div>

      {/* Desktop panel */}
      <motion.aside
        ref={scope}
        variants={stack}
        initial="hidden"
        animate="show"
        className="auth-brand relative isolate hidden flex-1 flex-col overflow-hidden rounded-[22px] px-10 py-9 text-white lg:flex xl:px-12"
      >
        {/* Blurred TB DOTS Center seal behind the panel content */}
        <div aria-hidden="true" className="auth-brand-seal" />
        {/* Light streak that crosses the panel while it slides */}
        <span aria-hidden="true" className="auth-slide-sheen" />

        {/* Plain div (not motion) so the entry stagger above still reaches
            the items inside; the swap effects animate it imperatively. */}
        <div className="auth-slide-content flex flex-1 flex-col justify-between gap-8">
        <motion.div variants={rise} className="flex items-center gap-3">
          <div className="auth-float">
            <Logo size="lg" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold leading-none">DOTS Daily</span>
            <span className="text-[12.5px] leading-none text-white/70">TB DOTS Center</span>
          </div>
        </motion.div>

        <div className="space-y-7">
          <motion.div variants={rise}>
            <h2 className="max-w-[14ch] text-[36px] font-bold leading-[1.08] tracking-[-0.03em] xl:text-[42px]">
              Capiz Emmanuel Hospital
            </h2>
            <p className="mt-3 max-w-[38ch] text-[14.5px] leading-relaxed text-white/75">
              Tuberculosis treatment monitoring for the TB DOTS Center team.
            </p>
          </motion.div>

          <motion.div variants={rise}>
            <DoseCalendar />
          </motion.div>

          <motion.ul variants={stack} className="grid max-w-[420px] grid-cols-2 gap-x-5 gap-y-3">
            {MODULES.map(({ label, icon: Icon }) => (
              <motion.li
                key={label}
                variants={rise}
                className="flex items-center gap-2.5 text-[13px] font-medium text-white/90"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/10 ring-1 ring-white/10">
                  <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
                </span>
                {label}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.p variants={rise} className="flex items-center gap-2 text-[12.5px] text-white/65">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
          For authorized DOTS Center staff only.
        </motion.p>
        </div>
      </motion.aside>
    </>
  );
}
