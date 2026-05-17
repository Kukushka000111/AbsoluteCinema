export default function App() {
  return (
    <div className="min-h-screen bg-fastwatch-bg text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">
          FastWatch <span className="text-fastwatch-accent">| AbsoluteCinema</span>
        </h1>
        <p className="mt-1 text-sm text-fastwatch-muted">
          Синхронный просмотр видео — каркас frontend готов
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-lg text-fastwatch-muted">
          Этап 1: заглушка. Далее — лобби, комната (Split View), ReactPlayer.
        </p>
        <div className="mt-8 flex justify-center gap-4 text-sm">
          <a
            href="http://localhost:8000/health"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-fastwatch-panel px-4 py-2 hover:bg-white/10"
          >
            API health
          </a>
          <a
            href="http://localhost:8001/health"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-fastwatch-panel px-4 py-2 hover:bg-white/10"
          >
            WS health
          </a>
        </div>
      </main>
    </div>
  );
}
