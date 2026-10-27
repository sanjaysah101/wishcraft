import { MicIcon, PaletteIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LETTERINGS, language, type LetteringId } from "@/lib/data";
import { studio, type CardView } from "@/lib/studio";

export function EditSheet({ view }: { view: CardView }) {
  const [open, setOpen] = useState(false);
  const r = view.record;
  const words = r.words;
  const dir = language(r.request.language).rtl ? "rtl" : "auto";
  const saving = r.stages.card.state === "working";
  if (!words) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>
        <PencilIcon data-icon="inline-start" />
        Edit
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-3xl font-normal">Edit the card</SheetTitle>
          <SheetDescription>Changes appear on the card as you type. Save to update My cards and downloads.</SheetDescription>
        </SheetHeader>
        <FieldGroup className="px-4">
          <Field>
            <FieldLabel htmlFor="edit-title">Headline</FieldLabel>
            <Input id="edit-title" dir={dir} maxLength={80} value={words.title} onChange={(e) => studio.editWords({ title: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-message">Message</FieldLabel>
            <Textarea
              id="edit-message"
              dir={dir}
              rows={7}
              maxLength={900}
              value={words.message}
              onChange={(e) => studio.editWords({ message: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-signoff">Sign-off</FieldLabel>
            <Input id="edit-signoff" dir={dir} maxLength={120} value={words.signoff} onChange={(e) => studio.editWords({ signoff: e.target.value })} />
          </Field>
          <FieldSet className="gap-2">
            <FieldLegend variant="label">Lettering</FieldLegend>
            <ToggleGroup
              aria-label="Lettering"
              variant="outline"
              spacing={2}
              value={[r.lettering]}
              onValueChange={(v) => v[0] && studio.setLettering(v[0] as LetteringId)}
              className="grid w-full grid-cols-2"
            >
              {LETTERINGS.map((l) => (
                <ToggleGroupItem key={l.id} value={l.id} className="w-full">
                  {l.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          {view.voiceStale ? (
            <Field>
              <Button variant="outline" disabled={r.stages.voice.state === "working"} onClick={() => studio.retry("voice")}>
                {r.stages.voice.state === "working" ? <Spinner data-icon="inline-start" /> : <MicIcon data-icon="inline-start" />}
                Record the voice note again
              </Button>
              <FieldDescription>The voice note still reads the old words.</FieldDescription>
            </Field>
          ) : null}
          {r.extras.art ? (
            <Field>
              <Button variant="outline" disabled={r.stages.art.state === "working"} onClick={() => studio.retry("art")}>
                {r.stages.art.state === "working" ? <Spinner data-icon="inline-start" /> : <PaletteIcon data-icon="inline-start" />}
                Paint new art
              </Button>
              <FieldDescription>Uses about {r.plans.image?.cu ?? 4} credits.</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
        <SheetFooter>
          <Button
            disabled={!view.dirty || saving}
            onClick={async () => {
              await studio.saveEdits();
              setOpen(false);
            }}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {view.dirty ? "Save changes" : "No changes to save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
