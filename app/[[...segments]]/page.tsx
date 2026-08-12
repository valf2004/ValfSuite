import { notFound } from "next/navigation";
import { SitePage } from "../SitePage";

const languages = ["it", "en", "fr", "es", "de"] as const;
const pages = ["home", "la-suite", "servizi", "galleria", "dintorni", "prenota", "contatti", "condizioni"] as const;

export default async function CatchAllPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  let lang = "it";
  let page = "home";
  if (segments.length && languages.includes(segments[0] as (typeof languages)[number])) {
    lang = segments[0];
    page = segments[1] ?? "home";
  } else if (segments.length) page = segments[0];
  if (!pages.includes(page as (typeof pages)[number]) || segments.length > (lang === "it" ? 1 : 2)) notFound();
  return <SitePage lang={lang} page={page} />;
}
