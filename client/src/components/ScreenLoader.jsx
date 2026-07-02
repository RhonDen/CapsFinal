import { Loader2 } from 'lucide-react';

function ScreenLoader({
  title = 'Loading…',
  subtitle = 'Please wait',
  className = '',
}) {
  return (
    <div
      className={
        `fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm dark:bg-slate-950/70 ${className}`
      }
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_26px_70px_-36px_rgba(12,36,61,0.42)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <Loader2 className="mx-auto mb-4 h-7 w-7 animate-spin text-silver-lake" />
        <h2 className="text-lg font-semibold text-maastricht dark:text-slate-100">
          {title}
        </h2>
        <p className="mt-1 text-sm text-police/80 dark:text-slate-300">
          {subtitle}
        </p>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/70">
          <div className="h-full w-1/2 animate-[screenLoader-shimmer_1.1s_ease-in-out_infinite] bg-gradient-to-r from-silver-lake via-glacier to-silver-lake" />
        </div>
      </div>
    </div>
  );
}

export default ScreenLoader;

