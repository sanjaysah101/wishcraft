import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Compose } from "./components/Compose";
import { History } from "./components/History";
import { Studio } from "./components/Studio";
import { anna } from "./lib/anna";
import { guessLanguage, LANGUAGES, OCCASIONS, type ArtStyleId, type CardFontId, type ToneId } from "./lib/data";
import { listCards, loadPrefs, removeCard, savePrefs, type SavedCard } from "./lib/history";
import { useCardJob } from "./lib/job";
import { estimateCu, planImage, planSong, planVoice, type Catalogs, type Extras } from "./lib/pricing";
import type { CardRequest } from "./lib/prompts";
import { loadCatalogs, refreshCredits } from "./lib/services";

type View = "make" | "cards";

const DEFAULT_EXTRAS: Extras = { art: true, voice: true, song: true };

function initialRequest(locale?: string): CardRequest {
  return {
    occasion: "birthday",
    occasionDetail: "",
    recipient: "",
    relationship: "",
    details: "",
    sender: "",
    language: guessLanguage(locale),
    tone: "warm",
    artStyle: "watercolor",
  };
}

/** Prefill from Anna chat: open_app_view(entry_payload={occasion, recipient, ...}). */
function fromPayload(p: unknown): Partial<CardRequest> {
  if (!p || typeof p !== "object") return {};
  const o = p as Record<string, unknown>;
  const str = (k: string, max = 120) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : undefined);
  const out: Partial<CardRequest> = {};
  const occ = str("occasion")?.toLowerCase();
  if (occ) {
    const hit = OCCASIONS.find((x) => x.id === occ || x.label.toLowerCase() === occ);
    if (hit) out.occasion = hit.id;
    else {
      out.occasion = "festival";
      out.occasionDetail = occ;
    }
  }
  const map: [keyof CardRequest, string, number][] = [
    ["recipient", "recipient", 60],
    ["relationship", "relationship", 60],
    ["details", "details", 600],
    ["sender", "sender", 60],
  ];
  for (const [field, key, max] of map) {
    const v = str(key, max);
    if (v) (out as any)[field] = v;
  }
  const lang = str("language")?.toLowerCase();
  if (lang) {
    const hit = LANGUAGES.find((l) => l.code === lang || l.label.toLowerCase().includes(lang));
    if (hit) out.language = hit.code;
  }
  return out;
}

export function App() {
  const [view, setView] = useState<View>("make");
  const [req, setReq] = useState<CardRequest>(() => ({ ...initialRequest(anna().locale), ...fromPayload(anna().entryPayload) }));
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [font, setFont] = useState<CardFontId>("hand");
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const catRef = useRef<Catalogs | null>(null);
  const toastTimer = useRef<number>();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const updateCredits = useCallback(() => {
    refreshCredits().then((c) => c !== null && setCredits(c));
  }, []);

  const jobApi = useCardJob(() => catRef.current, updateCredits);
  const { job } = jobApi;

  useEffect(() => {
    loadCatalogs().then((c) => {
      catRef.current = c;
      setCatalogs(c);
      setCredits(c.remainingCU);
    });
    loadPrefs().then((p) => {
      setReq((r) => ({
        ...r,
        sender: r.sender || p.sender || "",
        language: anna().entryPayload && (anna().entryPayload as any).language ? r.language : p.language || r.language,
        tone: (p.tone as ToneId) || r.tone,
        artStyle: (p.artStyle as ArtStyleId) || r.artStyle,
      }));
      if (p.font) setFont(p.font);
      if (p.extras) setExtras(p.extras);
    });
    const off = anna().on("entry_payload", (payload) => {
      const patch = fromPayload(payload);
      if (Object.keys(patch).length) {
        setReq((r) => ({ ...r, ...patch }));
        setView("make");
        jobApi.reset();
      }
    });
    return off;
  }, []);

  const available: Extras = useMemo(() => {
    if (!catalogs) return { art: true, voice: true, song: true };
    return {
      art: !!planImage(catalogs.image),
      voice: !!planVoice(catalogs.tts, req.language),
      song: !!planSong(catalogs.music),
    };
  }, [catalogs, req.language]);

  const effective: Extras = { art: extras.art && available.art, voice: extras.voice && available.voice, song: extras.song && available.song };
  const estimate = catalogs ? estimateCu(catalogs, effective, req.language) : null;
  const busy = !!job && Object.values(job.stages).some((s) => s.state === "working");

  const create = () => {
    savePrefs({ sender: req.sender, language: req.language, tone: req.tone, artStyle: req.artStyle, font, extras });
    jobApi.create(req, effective, font);
  };

  const openCards = async () => {
    setView("cards");
    setCardsError(null);
    try {
      setCards(await listCards());
    } catch {
      setCardsError("My cards couldn't be opened. Check your connection and try again.");
    }
  };

  const remove = async (c: SavedCard) => {
    try {
      await removeCard(c);
      setCards((list) => list?.filter((x) => x.id !== c.id) ?? null);
      notify("Card deleted.");
    } catch {
      notify("The card couldn't be deleted. Try again.");
    }
  };

  const newCard = () => {
    jobApi.reset();
    setReq((r) => ({ ...initialRequest(), sender: r.sender, language: r.language, tone: r.tone, artStyle: r.artStyle }));
    setView("make");
  };

  return (
    <div class={`app${job ? " has-job" : ""}`}>
      <header class="top">
        <h1 class="brand">
          <span class="brand__seal" aria-hidden="true">
            W
          </span>
          WishCraft
        </h1>
        <nav class="tabs" aria-label="Sections">
          <button type="button" class={`tab${view === "make" ? " is-on" : ""}`} aria-current={view === "make"} onClick={() => setView("make")}>
            Make a card
          </button>
          <button type="button" class={`tab${view === "cards" ? " is-on" : ""}`} aria-current={view === "cards"} onClick={openCards}>
            My cards
          </button>
        </nav>
      </header>

      {view === "make" ? (
        <main class="workspace">
          <div class="workspace__compose">
            <Compose
              req={req}
              extras={extras}
              font={font}
              estimate={estimate}
              credits={credits}
              available={available}
              busy={busy}
              onChange={(patch) => setReq((r) => ({ ...r, ...patch }))}
              onExtras={(patch) => setExtras((x) => ({ ...x, ...patch }))}
              onFont={setFont}
              onCreate={create}
            />
          </div>
          <div class="workspace__card">
            {job ? (
              <Studio
                job={job}
                onRetry={jobApi.retry}
                onAdd={jobApi.addExtra}
                onEdit={jobApi.editWords}
                onFont={jobApi.setFont}
                onSave={jobApi.save}
                onStop={jobApi.stop}
                onNew={newCard}
                notify={notify}
              />
            ) : (
              <div class="placeholder">
                <div class="envelope" aria-hidden="true">
                  <span class="envelope__flap" />
                  <span class="envelope__seal">W</span>
                </div>
                <p class="placeholder__lead">Your card appears here.</p>
                <p class="hint">Tell WishCraft who it's for and what they're like, then press Create card.</p>
              </div>
            )}
          </div>
        </main>
      ) : (
        <main class="workspace single">
          <History
            cards={cards}
            error={cardsError}
            onOpen={(c) => {
              setView("make");
              jobApi.open(c);
            }}
            onDelete={remove}
            onNew={newCard}
            onReload={openCards}
          />
        </main>
      )}

      <div class={`toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
