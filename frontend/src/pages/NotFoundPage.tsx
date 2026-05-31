import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-fastwatch-panel p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-fastwatch-muted">404</p>
        <h1 className="mt-2 text-3xl font-bold">Страница не найдена</h1>
        <p className="mt-3 text-sm text-fastwatch-muted">
          Такого адреса нет на сайте. Проверьте ссылку или вернитесь на главную.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-fastwatch-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-fastwatch-accentDark"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
