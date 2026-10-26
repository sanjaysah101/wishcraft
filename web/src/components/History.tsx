import { useEffect, useState } from "preact/hooks";
import { occasionById } from "../lib/data";
import type { SavedCard } from "../lib/history";
import { fileUrl } from "../lib/services";

export interface HistoryProps {
  cards: SavedCard[] | null;
  error: string | null;
  onOpen: (c: SavedCard) => void;
  onDelete: (c: SavedCard) => void;
  onNew: () => void;
  onReload: () => void;
}

function Thumb({ card }: { card: SavedCard }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (card.files.card) fileUrl(card.files.card).then((u) => live && setSrc(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [card.files.card]);
  const wash = occasionById(card.request.occasion).wash;
  return src ? (
    <img class="thumb" src={src} alt="" loading="lazy" crossOrigin="anonymous" />
  ) : (
    <span class="thumb is-empty" style={{ background: `linear-gradient(135deg, ${wash[0]}, ${wash[1]})` }} aria-hidden="true" />
  );
}

const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function History({ cards, error, onOpen, onDelete, onNew, onReload }: HistoryProps) {
  // The app iframe has no allow-modals, so confirm() is unavailable; confirm inline instead.
  const [confirming, setConfirming] = useState<string | null>(null);
  if (error) {
    return (
      <section class="history empty">
        <p>{error}</p>
        <button type="button" class="btn" onClick={onReload}>
          Try again
        </button>
      </section>
    );
  }
  if (!cards) return <section class="history empty"><p>Opening My cards…</p></section>;
  if (!cards.length) {
    return (
      <section class="history empty">
        <h2 class="display">No cards yet</h2>
        <p>Cards you create are kept here, on every device you use Anna on.</p>
        <button type="button" class="btn primary" onClick={onNew}>
          Create your first card
        </button>
      </section>
    );
  }
  return (
    <section class="history">
      <ul class="gallery">
        {cards.map((c) => (
          <li key={c.id} class="gallery__item">
            <button type="button" class="gallery__open" onClick={() => onOpen(c)}>
              <Thumb card={c} />
              <span class="gallery__title" dir="auto">
                {c.title || occasionById(c.request.occasion).label}
              </span>
              <span class="gallery__meta">
                For {c.request.recipient || "someone special"}, {fmt.format(new Date(c.createdAt))}
              </span>
            </button>
            {confirming === c.id ? (
              <span class="confirm" role="group" aria-label="Confirm delete">
                <button type="button" class="link danger" onClick={() => onDelete(c)}>
                  Delete for good
                </button>
                <button type="button" class="link" onClick={() => setConfirming(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" class="link danger" onClick={() => setConfirming(c.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
