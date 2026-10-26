import { ART_STYLES, CARD_FONTS, LANGUAGES, OCCASIONS, TONES, type CardFontId } from "../lib/data";
import type { Extras } from "../lib/pricing";
import type { CardRequest } from "../lib/prompts";

export interface ComposeProps {
  req: CardRequest;
  extras: Extras;
  font: CardFontId;
  estimate: number | null;
  credits: number | null;
  available: Extras;
  busy: boolean;
  onChange: (patch: Partial<CardRequest>) => void;
  onExtras: (patch: Partial<Extras>) => void;
  onFont: (font: CardFontId) => void;
  onCreate: () => void;
}

const EXTRA_COPY: Record<keyof Extras, { label: string; hint: string }> = {
  art: { label: "Card art", hint: "An original painting for the front" },
  voice: { label: "Voice note", hint: "Your message read aloud" },
  song: { label: "Little song", hint: "30 seconds, with their name in it" },
};

export function Compose(p: ComposeProps) {
  const { req } = p;
  const needsDetail = req.occasion === "festival";
  const canCreate = !p.busy && req.recipient.trim().length > 0;
  const short = p.credits !== null && p.estimate !== null && p.credits < p.estimate;

  return (
    <form
      class="compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (canCreate) p.onCreate();
      }}
    >
      <fieldset class="field">
        <legend>What's the occasion?</legend>
        <div class="stamps" role="radiogroup">
          {OCCASIONS.map((o) => (
            <label key={o.id} class={`stamp${req.occasion === o.id ? " is-on" : ""}`}>
              <input
                type="radio"
                name="occasion"
                value={o.id}
                checked={req.occasion === o.id}
                onChange={() => p.onChange({ occasion: o.id })}
              />
              <span class="stamp__emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        {needsDetail && (
          <input
            class="input"
            aria-label="Which festival or holiday?"
            placeholder="Which one? Diwali, Christmas, Eid, Lunar New Year…"
            value={req.occasionDetail}
            maxLength={80}
            onInput={(e) => p.onChange({ occasionDetail: e.currentTarget.value })}
          />
        )}
      </fieldset>

      <div class="row">
        <label class="field">
          <span class="label">Who is it for?</span>
          <input
            class="input"
            required
            placeholder="Their name, e.g. Priya"
            value={req.recipient}
            maxLength={60}
            onInput={(e) => p.onChange({ recipient: e.currentTarget.value })}
          />
        </label>
        <label class="field">
          <span class="label">They are my…</span>
          <input
            class="input"
            placeholder="sister, best friend, teacher"
            value={req.relationship}
            maxLength={60}
            onInput={(e) => p.onChange({ relationship: e.currentTarget.value })}
          />
        </label>
      </div>

      <label class="field">
        <span class="label">What makes them special?</span>
        <textarea
          class="input"
          rows={3}
          placeholder="Loves gardening and terrible puns. Just started her first job. We met in school."
          value={req.details}
          maxLength={600}
          onInput={(e) => p.onChange({ details: e.currentTarget.value })}
        />
        <span class="hint">One or two real details make the card feel personal.</span>
      </label>

      <div class="row">
        <label class="field">
          <span class="label">Language</span>
          <select class="input" value={req.language} onChange={(e) => p.onChange({ language: e.currentTarget.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="label">Signed by</span>
          <input
            class="input"
            placeholder="Your name"
            value={req.sender}
            maxLength={60}
            onInput={(e) => p.onChange({ sender: e.currentTarget.value })}
          />
        </label>
      </div>

      <fieldset class="field">
        <legend>Tone</legend>
        <div class="pills" role="radiogroup">
          {TONES.map((t) => (
            <label key={t.id} class={`pill${req.tone === t.id ? " is-on" : ""}`}>
              <input type="radio" name="tone" checked={req.tone === t.id} onChange={() => p.onChange({ tone: t.id })} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div class="row">
        <label class="field">
          <span class="label">Art style</span>
          <select
            class="input"
            value={req.artStyle}
            disabled={!p.extras.art}
            onChange={(e) => p.onChange({ artStyle: e.currentTarget.value as CardRequest["artStyle"] })}
          >
            {ART_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="label">Lettering</span>
          <select class="input" value={p.font} onChange={(e) => p.onFont(e.currentTarget.value as CardFontId)}>
            {CARD_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset class="field">
        <legend>Include</legend>
        <div class="extras">
          {(Object.keys(EXTRA_COPY) as (keyof Extras)[]).map((k) => (
            <label key={k} class={`extra${p.available[k] ? "" : " is-off"}`}>
              <input
                type="checkbox"
                checked={p.extras[k] && p.available[k]}
                disabled={!p.available[k]}
                onChange={(e) => p.onExtras({ [k]: e.currentTarget.checked })}
              />
              <span>
                <strong>{EXTRA_COPY[k].label}</strong>
                <span class="hint">{p.available[k] ? EXTRA_COPY[k].hint : "Not available on your account"}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div class="create">
        <button class="seal" type="submit" disabled={!canCreate}>
          <span class="seal__wax" aria-hidden="true">
            W
          </span>
          <span>{p.busy ? "Creating your card…" : "Create card"}</span>
        </button>
        <p class={`cost${short ? " is-short" : ""}`} aria-live="polite">
          {p.estimate !== null ? `Uses about ${p.estimate} Anna credits.` : "Checking prices…"}
          {p.credits !== null && ` You have ${Math.floor(p.credits)}.`}
          {short && " Turn off an extra to make it cheaper."}
        </p>
        {!req.recipient.trim() && <p class="hint">Add their name to create the card.</p>}
      </div>
    </form>
  );
}
