import GuessTheSongGame from '@/app/components/GuessTheSongGame';
import type { Language } from '@/lib/gts/types';

export default async function PlayPage({
  params,
}: {
  params: { lang: string } | Promise<{ lang: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const lang = String(resolved?.lang ?? '').toLowerCase();
  const selected = lang === 'tamil' ? 'tamil' : lang === 'english' ? 'english' : null;
  if (!selected) {
    return <main className="mx-auto max-w-xl px-6 py-10">Unknown language.</main>;
  }
  return <GuessTheSongGame lang={selected as Language} />;
}
