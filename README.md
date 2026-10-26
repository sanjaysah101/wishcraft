# WishCraft

Make a personal card for anyone, in any language. You get heartfelt words, original art, a voice note and a little song.

WishCraft is an [Anna](https://anna.partners) app. Choose the occasion, say who the card is for and one or two things you love about them, and WishCraft:

1. **Writes the message** in the language and tone you choose (25 languages, including Hindi, Spanish, Arabic, Chinese, Tamil and Swahili).
2. **Paints original card art** in the style you choose: watercolour, paper-cut, storybook, folk art, vintage postcard or dreamy photo.
3. **Records a voice note** that reads your message aloud (optional).
4. **Composes a 30-second song** with their name in the lyrics (optional).

You can edit the words and repaint the art, then download the card or share it. Every card is saved to **My cards** in your own Anna storage.

You can also ask for a card from Anna chat, for example _"#WishCraft make a birthday card for my sister Priya, she loves gardening"_. Anna opens WishCraft with the details already filled in.

## Cost

Everything runs on Anna's built-in services and is paid for with the user's Anna credits. WishCraft shows an estimate before anything is created. As of October 2026, a full card costs about 10–15 credits:

| Step | Service | Typical cost |
|---|---|---|
| Message | `llm.complete` | < 1 credit |
| Card art | `image.generateAsync`, GPT Image 2, 1024×1536, low quality | 4 credits |
| Voice note | `audio.speak`, cheapest voice that speaks the card's language | 1–6 credits |
| Song | `music.generate`, ACE-Step, 30 s | 5 credits |

## How it is built

- **Bundle-only Anna App** (manifest `schema: 3`, no Executa). Everything goes through the Anna Host API, so there are no API keys, servers or extra installs.
- **Preact + TypeScript + Vite**. The build goes into `bundle/`, which is uploaded as the app's UI bundle.
- The card is put together on a `<canvas>`: the AI art, then a paper panel with the lettering. The lettering uses bundled fonts (Caprasimo, Caveat, Cormorant Garamond, Atkinson Hyperlegible), with system fallbacks for scripts such as Devanagari, Arabic and CJK.
- Cards and media are stored with `anna.storage.*` (records) and `anna.files.*` (images and audio).
- Works on desktop and in the Anna mobile app (`form_factors: ["desktop", "mobile"]`), with safe-area padding, touch targets of at least 44 px, and light and dark themes that follow Anna.

```
web/src/
  App.tsx              screens, state, prefill from Anna chat (entry_payload)
  components/          Compose (form), Studio (card + actions), History (My cards)
  lib/anna.ts          SDK connection, error handling
  lib/prompts.ts       LLM prompt + JSON parsing
  lib/pricing.ts       picks models from llm.catalog and estimates credits
  lib/card.ts          canvas card renderer, multilingual text wrapping
  lib/job.ts           the create flow (words → art/voice/song → save), retries
  lib/services.ts      image / audio / music / files calls
  lib/history.ts       My cards and saved preferences
tests/                 vitest unit tests
```

## Develop

Requirements: Node 22+, [uv](https://docs.astral.sh/uv/), `npm i -g @anna-ai/cli`, then `anna-app login --host https://anna.partners`.

```bash
npm install
npm run watch      # rebuilds bundle/ on change
npm run dev        # anna-app dev harness with real Anna storage (http://localhost:5180)
npm test           # unit tests
npm run validate   # anna-app validate --strict
```

## Privacy

See [PRIVACY.md](./PRIVACY.md).

## License

[MIT](./LICENSE)
