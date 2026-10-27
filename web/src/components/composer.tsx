import { Music2Icon, PaletteIcon, SparklesIcon, Volume2Icon } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ART_STYLES, LANGUAGES, LETTERINGS, OCCASIONS, TONES, type ArtStyleId, type LetteringId, type ToneId } from "@/lib/data";
import type { Estimate, Extras } from "@/lib/pricing";
import type { CardRequest } from "@/lib/prompts";

export interface ExtraInfo {
  available: boolean;
  /** Why it's unavailable, or a note such as "sung in English". */
  note?: string;
}

export interface ComposerProps {
  request: CardRequest;
  extras: Extras;
  lettering: LetteringId;
  info: Record<keyof Extras, ExtraInfo>;
  estimate: Estimate | null;
  credits: number | null;
  busy: boolean;
  onRequest: (patch: Partial<CardRequest>) => void;
  onExtras: (patch: Partial<Extras>) => void;
  onLettering: (l: LetteringId) => void;
  onCreate: () => void;
}

const languageItems = LANGUAGES.map((l) => ({
  value: l.code,
  label: l.label === l.english ? l.label : `${l.label} (${l.english})`,
}));
const styleItems = ART_STYLES.map((s) => ({ value: s.id as string, label: s.label }));

const EXTRAS: { id: keyof Extras; label: string; description: string; icon: ComponentType<any> }[] = [
  { id: "art", label: "Card art", description: "An original painting for the front", icon: PaletteIcon },
  { id: "voice", label: "Voice note", description: "Your message, read aloud", icon: Volume2Icon },
  { id: "song", label: "A little song", description: "Lyrics about them, sung", icon: Music2Icon },
];

export function Composer(p: ComposerProps) {
  const { request: r } = p;
  const nameMissing = !r.recipient.trim();
  const short = p.credits !== null && p.estimate !== null && p.credits < p.estimate.total;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1.5 border-b py-6">
        <CardTitle className="font-heading text-4xl font-normal leading-none">Make someone's day</CardTitle>
        <CardDescription className="text-[0.95rem]">
          Say who it's for. WishCraft writes the message, paints the art and can even sing it.
        </CardDescription>
      </CardHeader>

      <CardContent className="py-6">
        <form
          id="composer"
          className="@container"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameMissing && !p.busy) p.onCreate();
          }}
        >
          <FieldGroup className="gap-7">
            <FieldSet>
              <FieldLegend>Occasion</FieldLegend>
              <ToggleGroup
                aria-label="Occasion"
                variant="outline"
                spacing={2}
                value={[r.occasion]}
                onValueChange={(v) => v[0] && p.onRequest({ occasion: v[0] })}
                className="flex w-full flex-wrap"
              >
                {OCCASIONS.map((o) => (
                  <ToggleGroupItem
                    key={o.id}
                    value={o.id}
                    className="h-11 gap-2 rounded-full px-3.5 text-[0.9rem]"
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {o.emoji}
                    </span>
                    <span>{o.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {r.occasion === "festival" && (
                <Field>
                  <FieldLabel htmlFor="occasion-detail">Which festival or holiday?</FieldLabel>
                  <Input
                    id="occasion-detail"
                    placeholder="Diwali, Christmas, Eid, Lunar New Year…"
                    maxLength={80}
                    value={r.occasionDetail}
                    onChange={(e) => p.onRequest({ occasionDetail: e.target.value })}
                  />
                </Field>
              )}
            </FieldSet>

            <div className="grid gap-5 @lg:grid-cols-2">
              <Field data-invalid={nameMissing && r.details.length > 0 ? true : undefined}>
                <FieldLabel htmlFor="recipient">Who is it for?</FieldLabel>
                <Input
                  id="recipient"
                  required
                  autoComplete="off"
                  placeholder="Their name, e.g. Priya"
                  maxLength={60}
                  value={r.recipient}
                  aria-invalid={nameMissing && r.details.length > 0 ? true : undefined}
                  onChange={(e) => p.onRequest({ recipient: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="relationship">They are your…</FieldLabel>
                <Input
                  id="relationship"
                  autoComplete="off"
                  placeholder="Sister, best friend, teacher"
                  maxLength={60}
                  value={r.relationship}
                  onChange={(e) => p.onRequest({ relationship: e.target.value })}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="details">What makes them special?</FieldLabel>
              <Textarea
                id="details"
                rows={3}
                maxLength={600}
                placeholder="Grows tomatoes on her balcony, just started her first job as a nurse, laughs at terrible puns."
                value={r.details}
                onChange={(e) => p.onRequest({ details: e.target.value })}
              />
              <FieldDescription>One or two real details make the card feel personal.</FieldDescription>
            </Field>

            <div className="grid gap-5 @lg:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="language">Language</FieldLabel>
                <Select items={languageItems} value={r.language} onValueChange={(v) => v && p.onRequest({ language: String(v) })}>
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {languageItems.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="sender">Signed by</FieldLabel>
                <Input
                  id="sender"
                  autoComplete="name"
                  placeholder="Your name"
                  maxLength={60}
                  value={r.sender}
                  onChange={(e) => p.onRequest({ sender: e.target.value })}
                />
              </Field>
            </div>

            <FieldSet>
              <FieldLegend>Tone</FieldLegend>
              <ToggleGroup
                aria-label="Tone"
                variant="outline"
                spacing={2}
                value={[r.tone]}
                onValueChange={(v) => v[0] && p.onRequest({ tone: v[0] as ToneId })}
                className="flex w-full flex-wrap"
              >
                {TONES.map((t) => (
                  <ToggleGroupItem key={t.id} value={t.id} className="grow">
                    {t.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <div className="grid gap-5 @lg:grid-cols-2">
              <Field data-disabled={!p.extras.art || undefined}>
                <FieldLabel htmlFor="art-style">Art style</FieldLabel>
                <Select
                  items={styleItems}
                  value={r.artStyle}
                  disabled={!p.extras.art}
                  onValueChange={(v) => v && p.onRequest({ artStyle: v as ArtStyleId })}
                >
                  <SelectTrigger id="art-style" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {styleItems.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Lettering</FieldLegend>
                <ToggleGroup
                  aria-label="Lettering"
                  variant="outline"
                  spacing={2}
                  value={[p.lettering]}
                  onValueChange={(v) => v[0] && p.onLettering(v[0] as LetteringId)}
                  className="grid w-full grid-cols-2"
                >
                  {LETTERINGS.map((l) => (
                    <ToggleGroupItem key={l.id} value={l.id} className="w-full">
                      {l.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
            </div>

            <FieldSet>
              <FieldLegend>Include</FieldLegend>
              <FieldGroup className="gap-3">
                {EXTRAS.map(({ id, label, description, icon: Icon }) => {
                  const info = p.info[id];
                  const cost = p.estimate?.parts[id];
                  return (
                    <FieldLabel key={id} htmlFor={`extra-${id}`}>
                      <Field orientation="horizontal" data-disabled={!info.available || undefined}>
                        <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                        <FieldContent>
                          <span className="font-medium">{label}</span>
                          <FieldDescription>
                            {info.available ? (info.note ? `${description}. ${info.note}` : description) : info.note}
                          </FieldDescription>
                        </FieldContent>
                        {info.available && p.extras[id] && cost ? (
                          <span className="text-sm tabular-nums text-muted-foreground">{cost} cr</span>
                        ) : null}
                        <Switch
                          id={`extra-${id}`}
                          checked={p.extras[id] && info.available}
                          disabled={!info.available}
                          onCheckedChange={(checked) => p.onExtras({ [id]: checked })}
                        />
                      </Field>
                    </FieldLabel>
                  );
                })}
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 border-t py-5">
        <Button type="submit" form="composer" size="lg" disabled={nameMissing || p.busy} className="w-full">
          {p.busy ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {p.busy ? "Creating your card…" : "Create card"}
        </Button>
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {nameMissing
            ? "Add their name to create the card."
            : p.estimate
              ? `Uses about ${p.estimate.total} Anna credits${p.credits !== null ? ` of your ${Math.floor(p.credits)}` : ""}.`
              : "Checking prices…"}
          {short && !nameMissing && " Turn off an extra to make it cheaper."}
        </p>
      </CardFooter>
    </Card>
  );
}
