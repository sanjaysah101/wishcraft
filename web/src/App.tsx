import { ArrowLeftIcon, CoinsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand";
import { CardStudio } from "@/components/card-studio";
import { Composer, type ExtraInfo } from "@/components/composer";
import { LivePreview } from "@/components/live-preview";
import { MyCards } from "@/components/my-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { anna, problemText } from "@/lib/anna";
import { audioController } from "@/lib/audio";
import { ART_STYLES, guessLanguage, language, LANGUAGES, LETTERINGS, OCCASIONS, TONES, type LetteringId } from "@/lib/data";
import { estimate, planImage, planSong, planVoice, type Catalogs, type Extras } from "@/lib/pricing";
import type { CardRequest } from "@/lib/prompts";
import {
  getRecord,
  listRecords,
  loadPrefs,
  loadSession,
  removeRecord,
  savePrefs,
  saveSession,
  type CardRecord,
  type Prefs,
} from "@/lib/records";
import { loadCatalogs, refreshCredits } from "@/lib/services";
import { studio, useStudio } from "@/lib/studio";

type View = "create" | "cards";

const DEFAULT_EXTRAS: Extras = { art: true, voice: true, song: false };

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

/** Prefill from Anna chat: open_app_view(payload={occasion, recipient, ...}). */
function fromPayload(p: unknown): Partial<CardRequest> {
  if (!p || typeof p !== "object") return {};
  const o = p as Record<string, unknown>;
  const str = (k: string, max = 120) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : undefined);
  const out: Partial<CardRequest> = {};
  const occ = str("occasion", 80);
  if (occ) {
    const key = occ.toLowerCase();
    const hit = OCCASIONS.find((x) => x.id === key || x.label.toLowerCase() === key);
    if (hit) out.occasion = hit.id;
    else {
      out.occasion = "festival";
      out.occasionDetail = occ;
    }
  }
  const fields: [keyof CardRequest, number][] = [
    ["recipient", 60],
    ["relationship", 60],
    ["details", 600],
    ["sender", 60],
  ];
  for (const [field, max] of fields) {
    const v = str(field, max);
    if (v) (out as Record<string, string>)[field] = v;
  }
  const lang = str("language")?.toLowerCase();
  if (lang) {
    const hit = LANGUAGES.find(
      (l) => l.code === lang || lang.startsWith(l.code + "-") || l.english.toLowerCase() === lang || l.label.toLowerCase() === lang,
    );
    if (hit) out.language = hit.code;
  }
  return out;
}

function fromPrefs(r: CardRequest, p: Prefs, keepLanguage: boolean): CardRequest {
  return {
    ...r,
    sender: r.sender || p.sender || "",
    language: keepLanguage ? r.language : p.language && LANGUAGES.some((l) => l.code === p.language) ? p.language : r.language,
    tone: TONES.some((t) => t.id === p.tone) ? (p.tone as CardRequest["tone"]) : r.tone,
    artStyle: ART_STYLES.some((s) => s.id === p.artStyle) ? (p.artStyle as CardRequest["artStyle"]) : r.artStyle,
  };
}

function useWide() {
  const q = "(min-width: 860px)";
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(q).matches,
  );
}

export function App() {
  const wide = useWide();
  const card = useStudio();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("create");
  const [request, setRequest] = useState<CardRequest>(() => initialRequest(anna().locale));
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [lettering, setLettering] = useState<LetteringId>("hand");
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [cards, setCards] = useState<CardRecord[] | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const catalogsRef = useRef<Catalogs | null>(null);

  const updateCredits = useCallback(() => {
    refreshCredits().then((c) => c !== null && setCredits(c));
  }, []);

  // ── Boot: catalogue, prefs, and whatever the user was doing last time ──
  useEffect(() => {
    studio.onCredits = updateCredits;
    loadCatalogs().then((c) => {
      catalogsRef.current = c;
      setCatalogs(c);
      setCredits(c.remainingCU);
    });

    const payload = fromPayload(anna().entryPayload);
    const fromChat = Object.keys(payload).length > 0;
    Promise.all([loadPrefs(), loadSession()]).then(async ([prefs, session]) => {
      if (prefs.lettering && LETTERINGS.some((l) => l.id === prefs.lettering)) setLettering(prefs.lettering);
      if (prefs.extras) setExtras({ ...DEFAULT_EXTRAS, ...prefs.extras });
      if (fromChat) {
        setRequest((r) => fromPrefs({ ...r, ...payload }, prefs, !!payload.language));
      } else if (session?.draft) {
        setRequest({ ...initialRequest(anna().locale), ...session.draft.request });
        setExtras({ ...DEFAULT_EXTRAS, ...session.draft.extras });
        if (session.draft.lettering) setLettering(session.draft.lettering);
      } else {
        setRequest((r) => fromPrefs(r, prefs, false));
      }
      if (!fromChat && session) {
        setView(session.view === "cards" ? "cards" : "create");
        if (session.openCardId) {
          const rec = await getRecord(session.openCardId);
          if (rec) void studio.open(rec);
        }
      }
      setReady(true);
    });

    const off = anna().on?.("entry_payload", (p) => {
      const patch = fromPayload(p);
      if (!Object.keys(patch).length) return;
      studio.detach();
      setRequest((r) => ({ ...initialRequest(anna().locale), sender: r.sender, language: r.language, tone: r.tone, artStyle: r.artStyle, ...patch }));
      setView("create");
    });
    return () => {
      off?.();
    };
  }, [updateCredits]);

  // ── Keep the session so closing the window never loses work ──
  useEffect(() => {
    if (!ready) return;
    saveSession({ view, openCardId: card?.record.id ?? null, draft: { request, extras, lettering } });
  }, [ready, view, card?.record.id, request, extras, lettering]);

  useEffect(() => {
    // Until the saved session is loaded, writing one would replace it with an empty form.
    if (!ready) return;
    const flush = () => {
      saveSession({ view, openCardId: studio.get()?.record.id ?? null, draft: { request, extras, lettering } }, true);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [ready, view, request, extras, lettering]);

  const loadCards = useCallback(async () => {
    setCardsError(null);
    try {
      setCards(await listRecords());
    } catch (e) {
      setCards(null);
      setCardsError(problemText(e));
    }
  }, []);

  useEffect(() => {
    if (view === "cards") void loadCards();
  }, [view, loadCards, card?.record.stages.card.state]);

  // ── What this account and language can do ──
  const info = useMemo<Record<keyof Extras, ExtraInfo>>(() => {
    const name = language(request.language).english;
    if (!catalogs) return { art: { available: true }, voice: { available: true }, song: { available: true } };
    const song = planSong(catalogs.music, request.language);
    return {
      art: planImage(catalogs.image)
        ? { available: true }
        : { available: false, note: "Card art isn't offered on your Anna account right now." },
      voice: planVoice(catalogs.tts, request.language)
        ? { available: true }
        : { available: false, note: `No ${name} voice is available yet. Your card is still written in ${name}.` },
      song: !song
        ? { available: false, note: "Songs aren't offered on your Anna account right now." }
        : song.language !== request.language
          ? { available: true, note: `Sung in English: ${name} singing isn't available yet.` }
          : { available: true },
    };
  }, [catalogs, request.language]);

  const effective: Extras = {
    art: extras.art && info.art.available,
    voice: extras.voice && info.voice.available,
    song: extras.song && info.song.available,
  };
  const cost = catalogs ? estimate(catalogs, effective, request.language) : null;
  const working = !!card && Object.values(card.record.stages).some((s) => s.state === "working");

  const create = async () => {
    const cat = catalogsRef.current;
    if (!cat) {
      toast.add({ title: "Still connecting to Anna", description: "Try again in a moment.", type: "info" });
      return;
    }
    savePrefs({ sender: request.sender, language: request.language, tone: request.tone, artStyle: request.artStyle, lettering, extras });
    setStarting(true);
    audioController.stop();
    try {
      const run = studio.create({ ...request }, effective, lettering, cat);
      setStarting(false);
      await run;
    } finally {
      setStarting(false);
    }
  };

  const newCard = () => {
    studio.detach();
    setRequest((r) => ({ ...r, recipient: "", relationship: "", details: "", occasionDetail: "" }));
    setView("create");
    window.scrollTo({ top: 0 });
  };

  const openCard = (r: CardRecord) => {
    setView("create");
    void studio.open(r);
    window.scrollTo({ top: 0 });
  };

  const deleteCard = async (r: CardRecord) => {
    if (studio.get()?.record.id === r.id) studio.detach();
    setCards((cs) => cs?.filter((c) => c.id !== r.id) ?? cs);
    try {
      await removeRecord(r);
      toast.add({ title: "Card deleted", type: "success" });
    } catch (e) {
      toast.add({ title: "The card couldn't be deleted", description: problemText(e), type: "error" });
      void loadCards();
    }
  };

  const switchView = (v: View) => {
    audioController.stop();
    setView(v);
  };

  const composer = (
    <Composer
      request={request}
      extras={extras}
      lettering={lettering}
      info={info}
      estimate={cost}
      credits={credits}
      busy={starting || (working && !card?.record.words)}
      onRequest={(p) => setRequest((r) => ({ ...r, ...p }))}
      onExtras={(p) => setExtras((x) => ({ ...x, ...p }))}
      onLettering={setLettering}
      onCreate={create}
    />
  );

  return (
    <div className="safe-area">
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => switchView(v as View)}>
            <TabsList aria-label="Sections">
              <TabsTrigger value="create" className="px-4">
                Create
              </TabsTrigger>
              <TabsTrigger value="cards" className="px-4">
                My cards
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {credits !== null ? (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" className="h-8 gap-1.5 px-3 text-sm tabular-nums" />}>
                <CoinsIcon data-icon="inline-start" />
                {Math.floor(credits).toLocaleString()}
              </TooltipTrigger>
              <TooltipContent>Anna credits left on your account</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {view === "cards" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-4xl leading-tight">My cards</h1>
              <p className="text-muted-foreground">Open a card to play, edit, download or share it.</p>
            </div>
            <MyCards cards={cards} error={cardsError} onOpen={openCard} onDelete={deleteCard} onNew={newCard} onReload={loadCards} />
          </div>
        ) : card ? (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" className="self-start" onClick={newCard}>
              <ArrowLeftIcon data-icon="inline-start" />
              New card
            </Button>
            <CardStudio view={card} catalogs={catalogs} onNew={newCard} split={wide} />
          </div>
        ) : wide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] xl:gap-8">
            {composer}
            <div className="sticky top-4">
              <LivePreview request={request} lettering={lettering} />
            </div>
          </div>
        ) : (
          composer
        )}
      </main>
    </div>
    </div>
  );
}
