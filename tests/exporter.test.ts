import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip, EXPORT_FORMATS, exportFileName } from "../web/src/lib/exporter";
import { request } from "./fixtures";

const words = { title: "Happy birthday, Priya", message: "Your tomatoes are legendary.", signoff: "Love, Sanjay", artPrompt: "", songStyle: "", lyrics: "" };

describe("export formats", () => {
  it("uses one format per kind of file", () => {
    expect(EXPORT_FORMATS.card).toMatchObject({ ext: "jpg", mime: "image/jpeg" });
    expect(EXPORT_FORMATS.voice).toMatchObject({ ext: "mp3", mime: "audio/mpeg" });
    expect(EXPORT_FORMATS.song).toMatchObject({ ext: "mp3", mime: "audio/mpeg" });
    expect(EXPORT_FORMATS.all).toMatchObject({ ext: "zip", mime: "application/zip" });
  });

  it("names every file the same way", () => {
    expect(exportFileName(request, "card")).toBe("WishCraft-Priya-Birthday-card.jpg");
    expect(exportFileName(request, "voice")).toBe("WishCraft-Priya-Birthday-voice-note.mp3");
    expect(exportFileName(request, "song")).toBe("WishCraft-Priya-Birthday-song.mp3");
    expect(exportFileName(request, "all")).toBe("WishCraft-Priya-Birthday.zip");
  });

  it("keeps names safe for any recipient", () => {
    expect(exportFileName({ recipient: "José / Ana", occasion: "thank-you" }, "card")).toBe("WishCraft-Jose-Ana-Thank-you-card.jpg");
    expect(exportFileName({ recipient: "प्रिया", occasion: "birthday" }, "card")).toBe("WishCraft-Card-Birthday-card.jpg");
  });
});

describe("buildZip", () => {
  it("bundles the card, audio and text", async () => {
    const zip = await buildZip({
      request,
      words,
      card: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      voice: new Blob([new Uint8Array([4])], { type: "audio/mpeg" }),
      song: new Blob([new Uint8Array([5])], { type: "audio/mpeg" }),
      lyrics: "[verse]\nla la",
    });
    expect(zip.type).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      "WishCraft-Priya-Birthday-card.jpg",
      "WishCraft-Priya-Birthday-song.mp3",
      "WishCraft-Priya-Birthday-voice-note.mp3",
      "lyrics.txt",
      "message.txt",
    ]);
    expect(strFromU8(files["message.txt"])).toBe("Happy birthday, Priya\n\nYour tomatoes are legendary.\n\nLove, Sanjay\n");
    expect(Array.from(files["WishCraft-Priya-Birthday-card.jpg"])).toEqual([1, 2, 3]);
  });

  it("leaves out parts the card doesn't have", async () => {
    const zip = await buildZip({ request, words, card: new Blob([new Uint8Array([1])]) });
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["WishCraft-Priya-Birthday-card.jpg", "message.txt"]);
  });
});
