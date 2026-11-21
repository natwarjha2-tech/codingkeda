import { notFound, redirect } from "next/navigation";
import { LANGUAGES, getLanguage } from "@/app/lib/tutorials";

export function generateStaticParams() {
  return LANGUAGES.map((l) => ({ lang: l.id }));
}

/** /learn/python → first lesson. */
export default async function LanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = getLanguage(lang);
  if (!l) notFound();
  redirect(`/learn/${l.id}/${l.topics[0].slug}`);
}
