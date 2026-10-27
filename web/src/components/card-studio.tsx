import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileArchiveIcon,
  ImageIcon,
  MessageSquarePlusIcon,
  Music2Icon,
  PlusIcon,
  ScrollTextIcon,
  Share2Icon,
  Volume2Icon,
} from "lucide-react";
import { useState } from "react";
import { AudioTrack } from "@/components/audio-track";
import { CardCanvas } from "@/components/card-canvas";
import { EditSheet } from "@/components/edit-sheet";
import { GenerationSteps } from "@/components/generation-steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { anna, errorCode } from "@/lib/anna";
import { blobToDataUrl } from "@/lib/card";
import { language, occasionById } from "@/lib/data";
import { EXPORT_FORMATS, exportFileName, type ExportKind } from "@/lib/exporter";
import type { Catalogs } from "@/lib/pricing";
import { displayLyrics, plainText } from "@/lib/prompts";
import type { StageId } from "@/lib/records";
import { contentOf, studio, type CardView } from "@/lib/studio";

function notify(title: string, type: "success" | "error" | "info" = "success", description?: string) {
  toast.add({ title, description, type });
}

export function CardStudio({ view, catalogs, onNew, split = false }: { view: CardView; catalogs: Catalogs | null; onNew: () => void; split?: boolean }) {
  const r = view.record;
  const words = r.words;
  const st = r.stages;
  const id = r.id;
  const [sharing, setSharing] = useState(false);
  const allDone = Object.values(st).every((s) => s.state === "done" || s.state === "skipped" || s.state === "failed");
  const lang = language(r.request.language);
  const showSteps = !allDone || Object.values(st).some((s) => s.state === "failed");

  const download = async (kind: ExportKind) => {
    try {
      await studio.download(kind);
      notify(`${EXPORT_FORMATS[kind].label} downloaded`, "success", exportFileName(r.request, kind));
    } catch {
      notify("The download didn't start", "error", "Try again in a moment.");
    }
  };

  const copy = async () => {
    if (!words) return;
    try {
      await navigator.clipboard.writeText(plainText(words));
      notify("Message copied");
    } catch {
      notify("Copying isn't allowed here", "error", "Open Edit, select the message and copy it.");
    }
  };

  const share = async () => {
    if (!words) return;
    setSharing(true);
    try {
      const blob = await studio.cardBlob();
      if (!blob) return;
      try {
        const res = await anna().mobile.share({
          title: words.title,
          text: plainText(words),
          data_url: await blobToDataUrl(blob),
          filename: exportFileName(r.request, "card"),
        });
        if (res?.shared !== false) notify("Card shared");
        return;
      } catch (e) {
        const code = errorCode(e);
        if (code !== "unsupported_container" && code !== "permission_denied") throw e;
      }
      const file = new File([blob], exportFileName(r.request, "card"), { type: "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: words.title, text: plainText(words) });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      await studio.download("card");
      await navigator.clipboard.writeText(plainText(words)).catch(() => {});
      notify("Card downloaded and message copied", "success", "Send the picture with the message in any chat app.");
    } catch {
      notify("Sharing didn't work here", "error", "Use Download instead.");
    } finally {
      setSharing(false);
    }
  };

  const addToChat = async () => {
    try {
      await anna().chat.append_artifact({
        artifact: {
          kind: "wishcraft_card",
          app_slug: "wishcraft",
          summary: `${words?.title ?? "Card"}: ${words?.message ?? ""}`.slice(0, 1000),
          payload_ref: r.files.card,
        },
      });
      notify("Added to your Anna chat");
    } catch {
      notify("The card couldn't be added to chat", "error");
    }
  };

  const retry = (s: StageId) => studio.retry(s);
  const canAdd = (k: "art" | "voice" | "song") => !r.extras[k] && st.words.state === "done" && catalogs;

  return (
    <section
      aria-label="Your card"
      className={split ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6 xl:gap-8" : "flex flex-col gap-5"}
    >
      <div className="desk-surface flex flex-col items-center gap-6 rounded-2xl px-4 py-8 sm:px-8">
        <div className="relative w-full max-w-[440px]">
          {words ? (
            <div className="rounded-lg shadow-[0_30px_60px_-24px_rgb(40_20_50/0.55),0_6px_16px_-6px_rgb(40_20_50/0.25)]">
              <CardCanvas
                content={contentOf(r)}
                art={view.art}
                label={`${words.title}. ${words.message} ${words.signoff}`}
              />
            </div>
          ) : (
            <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 rounded-lg bg-card text-muted-foreground shadow-md">
              {st.words.state === "failed" ? (
                <p className="px-8 text-center text-sm">The message couldn't be written. Try again below.</p>
              ) : (
                <>
                  <Spinner className="size-6 text-primary" />
                  <p className="text-sm">Writing a message for {r.request.recipient || "them"}…</p>
                </>
              )}
            </div>
          )}
          {view.dirty ? (
            <Badge variant="secondary" className="absolute top-3 start-3">
              Unsaved changes
            </Badge>
          ) : null}
        </div>
        {!split && showSteps ? (
          <div className="w-full max-w-[440px]">
            <GenerationSteps stages={st} onRetry={retry} onStop={() => studio.stop()} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {split ? (
          <div className="flex flex-col gap-1">
            <h2 dir="auto" className="font-heading text-3xl leading-tight text-balance">
              {words?.title || `A card for ${r.request.recipient || "someone special"}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {occasionById(r.request.occasion).label} card for {r.request.recipient || "someone special"}, in {lang.english}
            </p>
          </div>
        ) : null}
        {split && showSteps ? (
          <div className="rounded-xl border bg-card p-4">
            <GenerationSteps stages={st} onRetry={retry} onStop={() => studio.stop()} />
          </div>
        ) : null}
      {words ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button disabled={st.card.state !== "done" && !view.card} />}>
                {view.exporting ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
                Download
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Download as</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => download("card")}>
                    <ImageIcon />
                    {EXPORT_FORMATS.card.label}
                  </DropdownMenuItem>
                  {view.voice ? (
                    <DropdownMenuItem onClick={() => download("voice")}>
                      <Volume2Icon />
                      {EXPORT_FORMATS.voice.label}
                    </DropdownMenuItem>
                  ) : null}
                  {view.song ? (
                    <DropdownMenuItem onClick={() => download("song")}>
                      <Music2Icon />
                      {EXPORT_FORMATS.song.label}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={view.exporting} onClick={() => download("all")}>
                    <FileArchiveIcon />
                    {EXPORT_FORMATS.all.label}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={share} disabled={sharing}>
              {sharing ? <Spinner data-icon="inline-start" /> : <Share2Icon data-icon="inline-start" />}
              Share
            </Button>
            <Button variant="outline" onClick={copy}>
              <CopyIcon data-icon="inline-start" />
              Copy text
            </Button>
            <EditSheet view={view} />
            {r.files.card ? (
              <Button variant="ghost" onClick={addToChat}>
                <MessageSquarePlusIcon data-icon="inline-start" />
                Add to chat
              </Button>
            ) : null}
          </div>

          {view.voice ? (
            <AudioTrack
              id={`${id}:voice`}
              url={view.voice.url}
              title="Voice note"
              description={view.voiceStale ? "Reads the old words. Record it again from Edit." : `Your message, read in ${lang.english}`}
              icon={Volume2Icon}
              onDownload={() => download("voice")}
            />
          ) : null}
          {view.song ? (
            <AudioTrack
              id={`${id}:song`}
              url={view.song.url}
              title="Song"
              description={
                r.plans.song && r.plans.song.language !== r.request.language
                  ? `Sung in ${language(r.plans.song.language).english}`
                  : `Sung in ${lang.english}`
              }
              icon={Music2Icon}
              onDownload={() => download("song")}
            >
              {r.words?.lyrics || r.lyrics ? (
                <Dialog>
                  <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                    <ScrollTextIcon data-icon="inline-start" />
                    Lyrics
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-heading text-3xl font-normal">Lyrics</DialogTitle>
                      <DialogDescription>The words of the song for {r.request.recipient || "them"}.</DialogDescription>
                    </DialogHeader>
                    <pre dir="auto" className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                      {displayLyrics(r.words?.lyrics || r.lyrics || "")}
                    </pre>
                  </DialogContent>
                </Dialog>
              ) : null}
            </AudioTrack>
          ) : null}

          {allDone && (canAdd("art") || canAdd("voice") || canAdd("song")) ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Add</span>
              {canAdd("art") ? (
                <Button variant="outline" size="sm" onClick={() => studio.addExtra("art", catalogs!)}>
                  <PlusIcon data-icon="inline-start" />
                  Card art
                </Button>
              ) : null}
              {canAdd("voice") ? (
                <Button variant="outline" size="sm" onClick={() => studio.addExtra("voice", catalogs!)}>
                  <PlusIcon data-icon="inline-start" />
                  Voice note
                </Button>
              ) : null}
              {canAdd("song") ? (
                <Button variant="outline" size="sm" onClick={() => studio.addExtra("song", catalogs!)}>
                  <PlusIcon data-icon="inline-start" />
                  Song
                </Button>
              ) : null}
            </div>
          ) : null}

          {allDone ? (
            <Button variant="link" className="self-start px-0" onClick={onNew}>
              Make another card
            </Button>
          ) : null}
        </div>
      ) : null}
      </div>
    </section>
  );
}
