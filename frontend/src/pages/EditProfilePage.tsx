import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiFetch, type ProfileMe, type ProfileUpdate, type ProfileVisibility } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { VISIBILITY_LABELS } from "../lib/profileFormat";
import { profilePath } from "../lib/links";

const SUGGESTED_TAGS = ["кино", "аниме", "музыка", "стримы", "сериалы", "мультфильмы"];
const VISIBILITY_OPTIONS: ProfileVisibility[] = ["public", "hidden"];

export default function EditProfilePage() {
  const { user, loading, refreshMe } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileMe | null>(null);
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [telegram, setTelegram] = useState("");
  const [vk, setVk] = useState("");
  const [email, setEmail] = useState("");
  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) {return;}
    apiFetch<ProfileMe>("/profile/me")
      .then((data) => {
        setProfile(data);
        setBio(data.bio ?? "");
        setTags(data.tags.join(", "));
        setTelegram(data.links.telegram ?? "");
        setVk(data.links.vk ?? "");
        setEmail(data.email ?? "");
        setVisibility(data.profile_visibility === "hidden" ? "hidden" : "public");
      })
      .catch((err: Error) => toast(err.message, "error"))
      .finally(() => setFetching(false));
  }, [toast, user]);

  if (loading || fetching) {
    return <p className="text-fastwatch-muted">Загрузка...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: "/profile/me/edit" }} />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: ProfileUpdate = {
        bio: bio.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        link_telegram: telegram.trim() || null,
        link_vk: vk.trim() || null,
        email: email.trim() || null,
        profile_visibility: visibility,
      };
      const updated = await apiFetch<ProfileMe>("/profile/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await refreshMe();
      toast("Профиль сохранён", "success");
      navigate(profilePath(updated.username));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка сохранения", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to={profilePath(user.username)} className="text-sm text-fastwatch-accent hover:underline">
          ← К профилю
        </Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Редактирование профиля</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Основное</h2>
          <label className="mb-2 block text-sm font-medium">О себе</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Смотрю аниме по вечерам..."
            className="mb-1 w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm"
          />
          <p className="mb-4 text-right text-xs text-fastwatch-muted">{bio.length}/500</p>
          <label className="mb-2 block text-sm font-medium">Любимые теги (через запятую)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={profile?.tags.join(", ") || "кино, аниме, музыка"}
            className="mb-2 w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const current = tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  if (!current.includes(tag)) {
                    setTags([...current, tag].join(", "));
                  }
                }}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-fastwatch-muted hover:border-fastwatch-accent/50 hover:text-white"
              >
                + {tag}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Ссылки</h2>
          <div className="space-y-3">
            <Field
              label="Telegram"
              value={telegram}
              onChange={setTelegram}
              placeholder="@username или https://t.me/username"
            />
            <Field label="VK" value={vk} onChange={setVk} placeholder="@username или https://vk.com/username" />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Настройки и приватность</h2>
          <Field
            label="Email (виден только вам)"
            value={email}
            onChange={setEmail}
            placeholder={profile?.email ?? "you@example.com"}
            type="email"
          />
          <label className="mb-2 mt-4 block text-sm font-medium">Кто видит профиль</label>
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  visibility === key
                    ? "border-fastwatch-accent bg-fastwatch-accent/10"
                    : "border-white/10 bg-fastwatch-bg"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === key}
                  onChange={() => setVisibility(key)}
                  className="mt-1 accent-fastwatch-accent"
                />
                <span>
                  <span className="block text-sm font-medium">{VISIBILITY_LABELS[key]}</span>
                  <span className="text-xs text-fastwatch-muted">
                    {key === "public" && "Описание, теги и активность видны всем"}
                    {key === "hidden" && "Другим виден только ник"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-fastwatch-accent py-3 font-bold text-white transition hover:bg-fastwatch-accentDark disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить профиль"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm"
      />
    </div>
  );
}
