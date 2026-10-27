import { useEffect, useRef } from "react";
import { prepareFonts, renderCard, type CardContent } from "@/lib/card";
import { cn } from "@/lib/utils";

interface CardCanvasProps {
  content: CardContent;
  art: ImageBitmap | null;
  label: string;
  className?: string;
}

/** Draws the card exactly as it will be exported (same renderer, same fonts). */
export function CardCanvas({ content, art, label, className }: CardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(content);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const fonts = await prepareFonts(content);
      if (!cancelled && ref.current) renderCard(ref.current, art, content, fonts);
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, art]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={cn("block aspect-[2/3] h-auto w-full rounded-md bg-paper", className)}
    />
  );
}
