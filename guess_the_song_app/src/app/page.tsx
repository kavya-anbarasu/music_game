import Link from 'next/link';
import { Card } from './components/ui/Card';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-white/50">Daily game</div>
        <h1 className="text-4xl font-semibold tracking-tight">Guess the Song</h1>
        <div className="mt-2 text-sm text-white/70">Pick a language to start today’s set.</div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold">English</div>
            <div className="text-xs opacity-70">Hints: album, artist, key</div>
          </div>
          <Link
            href="/play/english"
            className="inline-flex items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30"
          >
            Play English
          </Link>
        </Card>

        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Tamil</div>
            <div className="text-xs opacity-70">Hints: movie, music director, singers</div>
          </div>
          <Link
            href="/play/tamil"
            className="inline-flex items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30"
          >
            Play Tamil
          </Link>
        </Card>
      </div>
    </main>
  );
}
