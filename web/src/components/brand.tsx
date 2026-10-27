import { cn } from "@/lib/utils";

/** Wax seal monogram — the brand mark. */
export function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <defs>
        <radialGradient id="wc-wax" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#E0487A" />
          <stop offset="0.55" stopColor="#9B1F4C" />
          <stop offset="1" stopColor="#6E1535" />
        </radialGradient>
      </defs>
      <path
        d="M24 2.5c4.2 0 6.4 2.8 9.6 3.8 3.4 1.1 7.2-.1 9.3 2.9 2 2.9.6 6.4 1.6 9.6 1 3.2 3.7 5.3 3 8.9-.7 3.5-4.2 4.6-5.9 7.4-1.8 2.9-1.5 6.6-4.6 8.3-3 1.7-6.2-.2-9.6.2-3.3.4-5.9 2.9-9.3 2.2-3.4-.7-4.4-4.2-7.1-6.1-2.6-1.9-6.3-1.8-7.9-4.9-1.5-3 .7-6 .6-9.4-.1-3.3-2.4-6-1.4-9.3 1-3.3 4.6-4.2 6.8-6.6 2.3-2.4 2.6-6.1 5.7-7.4C17.8.8 20.3 2.5 24 2.5z"
        fill="url(#wc-wax)"
      />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke="#FFD3E0" strokeOpacity="0.55" strokeWidth="1.4" />
      <path d="M16.5 19.5l3.2 10 4.3-7.6 4.3 7.6 3.2-10" fill="none" stroke="#FFF4F8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Seal />
      <span className="font-heading text-[1.75rem] leading-none tracking-tight text-foreground">WishCraft</span>
    </span>
  );
}
