import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Brain,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    title: "DOTS Protocol Compliance",
    description:
      "Phase-based TB treatment tracking with Intensive and Continuation phase management aligned with WHO DOTS guidelines.",
    icon: Shield,
  },
  {
    title: "AI-Powered Insights",
    description:
      "Smart clinical recommendations based on patient vitals, symptoms, and medication adherence patterns.",
    icon: Brain,
  },
  {
    title: "Real-time Monitoring",
    description:
      "Daily vitals, symptom tracking, and photo-verified medication adherence with instant alert escalation.",
    icon: Activity,
  },
];

const stats = [
  { label: "Active Patients", value: "0", icon: Users },
  { label: "Treatment Success", value: "0%", icon: CheckCircle2 },
  { label: "Adherence Rate", value: "0%", icon: Activity },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 border-b border-border-light bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary-500 text-sm font-bold text-white">
              D
            </div>
            <span className="text-[15px] font-semibold text-text-primary">
              DOTS Daily
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-border-light">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1 text-sm font-medium text-primary-700">
              <Activity className="h-3.5 w-3.5" />
              TB Treatment Monitoring System v2.0
            </div>

            <h1 className="text-[44px] leading-[1.1] font-bold tracking-tight text-text-primary sm:text-[52px]">
              AI-Assisted{" "}
              <span className="text-primary-500">Tuberculosis</span>{" "}
              Treatment Monitoring
            </h1>

            <p className="mt-5 text-[17px] leading-relaxed text-text-secondary max-w-xl mx-auto">
              A DOTS-compliant platform for healthcare providers to monitor
              patient adherence, track symptoms, and receive AI-powered clinical
              recommendations in real time.
            </p>

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Monitoring
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Sign In to Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-[16px] border border-border-light bg-white p-6 text-center"
                >
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] bg-bg-subtle">
                    <Icon className="h-5 w-5 text-primary-500" />
                  </div>
                  <p className="text-[30px] font-bold text-text-primary">
                    {stat.value}
                  </p>
                  <p className="text-sm text-text-secondary">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[28px] font-bold text-text-primary sm:text-[34px]">
              Everything you need to manage TB treatment
            </h2>
            <p className="mt-3 text-[15px] text-text-secondary">
              Built for healthcare providers who demand precision, reliability,
              and real-time visibility into patient outcomes.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-[16px] border border-border-light bg-white p-7 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary-50">
                    <Icon className="h-5 w-5 text-primary-500" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      

      {/* ── Footer ── */}
      <footer className="border-t border-border-light bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary-500 text-xs font-bold text-white">
              D
            </div>
            <span className="text-sm font-medium text-text-primary">
              DOTS Daily
            </span>
          </div>
          <p className="text-xs text-text-tertiary">
            &copy; {new Date().getFullYear()} DOTS Daily v2.0 &mdash; Thesis Project
          </p>
        </div>
      </footer>
    </div>
  );
}
