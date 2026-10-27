# Changelog

## 0.2.0 (27 October 2026)

A full redesign of the interface and the card engine, addressing each point from the 0.1.0 review.

### Review fixes

- **Overlapping audio.** The whole app now uses one shared audio player. Starting the song stops the voice note and the other way round. Switching cards or screens stops playback.
- **Inconsistent download formats.** One standard everywhere: the card is a JPG, the voice note and the song are MP3, and "Everything" is a ZIP with the card, audio, `message.txt` and `lyrics.txt`. Songs from models that only output WAV are converted to MP3 in the app. File names follow `WishCraft-<Name>-<Occasion>-card.jpg`, `-voice-note.mp3`, `-song.mp3` and `.zip`. Downloads go through Anna's host download.
- **Unnatural handwritten text.** New card renderer: handwriting and print typefaces per script (Latin, Devanagari, Bengali, Tamil, Telugu, Gujarati, Arabic, Urdu, Chinese, Japanese, Korean), set word by word with small changes in baseline, angle, size and ink. A printed headline, a deckled paper sheet, a right-aligned signature, and line breaking that keeps punctuation off the start of a line.
- **Progress lost when closing mid-generation.** Each step saves the card as soon as it finishes. Art and song jobs keep running on Anna while the app is closed; reopening WishCraft resumes the same jobs (same idempotency key, no second charge). The form, the open card and the current screen are restored too.
- **Song stops halfway through the lyrics.** Lyrics are now written for the model that sings them, with a fixed number of short lines. Variable-length models get a duration sized to the lyrics (35–120 s). Fixed 30-second models get four lines. Each language uses a model that supports its lyrics, otherwise the song is sung in English and the app says so first.

### Also new

- Interface rebuilt with React 19, Tailwind CSS 4 and shadcn/ui on Base UI. Desktop two-column layout with a live card preview, single-column mobile layout, light and dark themes, 44 px touch targets.
- Voice notes only use voices that speak the card's language. Languages without one say so instead of using a wrong-language voice.
- Edit sheet: change the headline, message, sign-off and lettering with a live preview; repaint the art; re-record a voice note after editing.
- Stop button for art and song (queued jobs are refunded by Anna), and Try again on any failed step.
- Track lengths shown before playing, and lyrics shown in a dialog.
- My cards shows cards still being made and lets you delete a card with confirmation.

## 0.1.0 (27 October 2026)

First version.
