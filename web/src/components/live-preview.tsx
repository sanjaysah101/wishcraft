import { CardCanvas } from "@/components/card-canvas";
import type { CardContent } from "@/lib/card";
import { language, occasionById, type LetteringId } from "@/lib/data";
import type { CardRequest } from "@/lib/prompts";

/** "With love" in each card language, used to preview the chosen lettering. */
const WITH_LOVE: Record<string, string> = {
  en: "With love",
  hi: "प्यार सहित",
  es: "Con cariño",
  fr: "Avec amour",
  pt: "Com carinho",
  de: "In Liebe",
  it: "Con affetto",
  zh: "爱你的",
  ja: "愛をこめて",
  ko: "사랑을 담아",
  ar: "مع حبي",
  ru: "С любовью",
  bn: "ভালোবাসা সহ",
  ta: "அன்புடன்",
  te: "ప్రేమతో",
  mr: "प्रेमपूर्वक",
  gu: "પ્રેમ સાથે",
  ur: "محبت کے ساتھ",
  ne: "मायासहित",
  id: "Dengan cinta",
  vi: "Thân mến",
  tr: "Sevgiyle",
  nl: "Met liefde",
  pl: "Z miłością",
  sw: "Kwa upendo",
};

export function LivePreview({ request, lettering }: { request: CardRequest; lettering: LetteringId }) {
  const o = occasionById(request.occasion);
  const name = request.recipient.trim();
  const english = request.language === "en";
  const title = english ? (name ? `${o.greeting}, ${name}` : o.greeting) : name || o.label;
  const sign = `${WITH_LOVE[request.language] ?? WITH_LOVE.en}${request.sender.trim() ? `, ${request.sender.trim()}` : ""}`;
  const content: CardContent = {
    title,
    message: "",
    signoff: sign,
    language: request.language,
    lettering,
    occasion: request.occasion,
    seed: 7,
    placeholder: true,
  };
  return (
    <div className="desk-surface flex flex-col items-center gap-5 rounded-2xl px-4 py-8 sm:px-8">
      <div className="w-full max-w-[400px] rotate-[-0.6deg] rounded-lg shadow-[0_30px_60px_-24px_rgb(40_20_50/0.5),0_6px_16px_-6px_rgb(40_20_50/0.22)]">
        <CardCanvas content={content} art={null} label={`Preview of a ${o.label.toLowerCase()} card`} />
      </div>
      <p className="max-w-[40ch] text-center text-sm text-muted-foreground">
        A preview of your {o.label.toLowerCase()} card in {language(request.language).english}. The message and art appear
        when you create it.
      </p>
    </div>
  );
}
