import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { audioController, formatTime, useAudio } from "@/lib/audio";

export interface AudioTrackProps {
  id: string;
  url: string;
  title: string;
  description?: ReactNode;
  icon: ComponentType<any>;
  onDownload: () => void;
  children?: ReactNode;
}

/** Reads a clip's length from its metadata. The probe element is never played. */
function useClipLength(url: string): number {
  const [length, setLength] = useState(0);
  useEffect(() => {
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.muted = true;
    const done = () => Number.isFinite(probe.duration) && setLength(probe.duration);
    probe.addEventListener("loadedmetadata", done);
    probe.src = url;
    return () => {
      probe.removeEventListener("loadedmetadata", done);
      probe.removeAttribute("src");
      probe.load();
    };
  }, [url]);
  return length;
}

/** A track row. All rows share one player, so only one ever sounds at a time. */
export function AudioTrack({ id, url, title, description, icon: Icon, onDownload, children }: AudioTrackProps) {
  const a = useAudio();
  const length = useClipLength(url);
  const current = a.trackId === id;
  const playing = current && a.playing;
  const loading = current && a.loading && !a.playing;
  const duration = current && a.duration ? a.duration : length;
  const time = current ? a.time : 0;

  return (
    <Item variant="outline" className="flex-wrap">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="icon" aria-label={`Download ${title.toLowerCase()} (MP3)`} onClick={onDownload}>
          <DownloadIcon />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? `Pause ${title.toLowerCase()}` : `Play ${title.toLowerCase()}`}
          aria-pressed={playing}
          onClick={() => audioController.toggle(id, url)}
        >
          {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      </ItemActions>
      <div className="flex w-full items-center gap-3">
        <span className="w-10 text-xs tabular-nums text-muted-foreground">{formatTime(time)}</span>
        <Slider
          aria-label={`${title} position`}
          className="flex-1"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={time}
          disabled={!current || !duration}
          onValueChange={(v) => audioController.seek(id, Array.isArray(v) ? v[0] : (v as number))}
        />
        <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">
          {duration ? formatTime(duration) : "–:––"}
        </span>
      </div>
      {current && a.error ? <p className="w-full text-sm text-destructive">{a.error}</p> : null}
      {children}
    </Item>
  );
}
