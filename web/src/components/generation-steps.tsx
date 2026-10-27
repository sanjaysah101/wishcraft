import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { StageId, Stages } from "@/lib/records";
import { cn } from "@/lib/utils";

const COPY: Record<StageId, { label: string; working: string; done: string }> = {
  words: { label: "Message", working: "Writing the message", done: "Message written" },
  art: { label: "Art", working: "Painting the card art", done: "Art painted" },
  voice: { label: "Voice note", working: "Recording the voice note", done: "Voice note recorded" },
  song: { label: "Song", working: "Composing the song", done: "Song composed" },
  card: { label: "Card", working: "Putting the card together", done: "Saved to My cards" },
};

const ORDER: StageId[] = ["words", "art", "voice", "song", "card"];

export function GenerationSteps({ stages, onRetry, onStop }: { stages: Stages; onRetry: (s: StageId) => void; onStop?: () => void }) {
  const visible = ORDER.filter((s) => stages[s].state !== "skipped");
  const finished = visible.filter((s) => stages[s].state === "done").length;
  const working = visible.some((s) => stages[s].state === "working");
  const mediaWorking = stages.art.state === "working" || stages.song.state === "working";

  return (
    <div className="flex w-full flex-col gap-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <Progress value={(finished / visible.length) * 100} className="flex-1" aria-label="Card progress" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {finished}/{visible.length}
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {visible.map((id) => {
          const s = stages[id];
          return (
            <li key={id} className={cn("flex min-h-8 items-center gap-2.5 text-sm", s.state === "waiting" && "text-muted-foreground")}>
              {s.state === "working" ? (
                <Spinner className="text-primary" />
              ) : s.state === "done" ? (
                <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
              ) : s.state === "failed" ? (
                <CircleAlertIcon aria-hidden="true" className="size-4 text-destructive" />
              ) : (
                <CircleDashedIcon aria-hidden="true" className="size-4" />
              )}
              <span className={cn("flex-1", s.state === "failed" && "text-destructive")}>
                {s.state === "done"
                  ? COPY[id].done
                  : s.state === "working"
                    ? `${COPY[id].working}…`
                    : s.state === "failed"
                      ? `${COPY[id].label}: ${s.error ?? "this step didn't finish."}`
                      : COPY[id].working}
              </span>
              {s.state === "failed" && (
                <Button variant="outline" size="sm" onClick={() => onRetry(id)}>
                  <RotateCcwIcon data-icon="inline-start" />
                  Try again
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {working && mediaWorking && onStop ? (
        <p className="text-xs text-muted-foreground">
          You can close WishCraft. The art and song keep going and will be here when you come back.{" "}
          <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={onStop}>
            Stop
          </Button>
        </p>
      ) : null}
    </div>
  );
}
