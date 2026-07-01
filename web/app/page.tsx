export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center justify-center px-8 py-24 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          DOTS Daily v2
        </h1>
        <p className="mb-8 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Tuberculosis Treatment Monitoring System — Admin Portal
        </p>
        <div className="flex gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-4 text-left text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-50">
              Project Status
            </p>
            <p>Architecture setup — ready for feature development.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
