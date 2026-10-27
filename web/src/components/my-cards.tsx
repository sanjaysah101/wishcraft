import { MailOpenIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { occasionById } from "@/lib/data";
import { isFinished, needsResume, type CardRecord } from "@/lib/records";
import { fileUrl } from "@/lib/services";

function Thumb({ card }: { card: CardRecord }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const path = card.files.card ?? card.files.art;
    if (path) fileUrl(path).then((u) => live && setSrc(u)).catch(() => live && setFailed(true));
    else setFailed(true);
    return () => {
      live = false;
    };
  }, [card.files.card, card.files.art]);
  const o = occasionById(card.request.occasion);
  if (src) return <img src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />;
  if (failed) {
    return (
      <div
        className="flex aspect-[2/3] w-full items-center justify-center rounded-md text-5xl"
        style={{ background: `linear-gradient(135deg, ${o.wash[0]}, ${o.wash[1]})` }}
        aria-hidden="true"
      >
        {o.emoji}
      </div>
    );
  }
  return <Skeleton className="aspect-[2/3] w-full rounded-md" />;
}

const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export interface MyCardsProps {
  cards: CardRecord[] | null;
  error: string | null;
  onOpen: (c: CardRecord) => void;
  onDelete: (c: CardRecord) => void;
  onNew: () => void;
  onReload: () => void;
}

export function MyCards({ cards, error, onOpen, onDelete, onNew, onReload }: MyCardsProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>My cards couldn't be opened</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onReload}>
            <RotateCcwIcon data-icon="inline-start" />
            Try again
          </Button>
        </AlertAction>
      </Alert>
    );
  }
  if (!cards) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5" aria-label="Opening My cards">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (!cards.length) {
    return (
      <Empty className="desk-surface rounded-2xl">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailOpenIcon />
          </EmptyMedia>
          <EmptyTitle className="font-heading text-3xl font-normal">No cards yet</EmptyTitle>
          <EmptyDescription>Cards you make are kept here, on every device you use Anna on.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onNew}>Make your first card</Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">
      {cards.map((c) => {
        const working = needsResume(c);
        const failed = isFinished(c) && Object.values(c.stages).some((s) => s.state === "failed");
        const title = c.words?.title || occasionById(c.request.occasion).label;
        return (
          <li key={c.id} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="group relative flex flex-col gap-2 rounded-lg text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="block overflow-hidden rounded-md shadow-[0_16px_32px_-16px_rgb(40_20_50/0.5)] transition-transform group-hover:-translate-y-0.5">
                <Thumb card={c} />
              </span>
              {working ? (
                <Badge className="absolute top-2 start-2">Still making</Badge>
              ) : failed ? (
                <Badge variant="destructive" className="absolute top-2 start-2">
                  Needs attention
                </Badge>
              ) : null}
              <span dir="auto" className="line-clamp-2 font-medium leading-snug">
                {title}
              </span>
              <span className="text-sm text-muted-foreground">
                For {c.request.recipient || "someone special"}, {fmt.format(new Date(c.createdAt))}
              </span>
            </button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="self-start text-muted-foreground" />}>
                <Trash2Icon data-icon="inline-start" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this card?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The card for {c.request.recipient || "this person"}, its art, voice note and song are removed from your Anna storage. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => onDelete(c)}>
                    Delete card
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        );
      })}
    </ul>
  );
}
