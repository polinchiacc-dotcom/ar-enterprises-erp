import React, { createContext, useContext, useState } from "react";

const I18nContext = createContext<{ t: (k: string) => string; lang: "ta" | "en"; setLang: (l: "ta" | "en") => void }>({
  t: (k: string) => k,
  lang: "ta",
  setLang: () => {},
});

const translations: Record<string, Record<string, string>> = {
  "reports.title": { en: "Reports & Analytics", ta: "அறிக்கைகள் & பகுப்பாய்வு" },
  "reports.sub": { en: "Run, view and export operational and financial reports", ta: "செயல்பாட்டு மற்றும் நிதி அறிக்கைகளை இயக்கு, பார் மற்றும் ஏற்றுமதி செய்" },
  "exports.exportRequested": { en: "Export requested successfully", ta: "ஏற்றுமதி கோரப்பட்டது" },
  "exports.expired": { en: "Export link expired or not found", ta: "ஏற்றுமதி இணைப்பு காலாவதியானது" },
  "exports.sub": { en: "All reports can be exported to CSV or viewed directly.", ta: "அனைத்து அறிக்கைகளையும் CSV வடிவில் பதிவிறக்கலாம் அல்லது நேரடியாகப் பார்க்கலாம்." },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<"ta" | "en">("ta");
  const t = (k: string) => translations[k]?.[lang] || k;
  return <I18nContext.Provider value={{ t, lang, setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
