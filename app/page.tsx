"use client";
import { useEffect, useRef, useState } from "react";
import {
  Globe2,
  ArrowUpRight,
  Users,
  Compass,
  MapPin,
  ArrowRight,
  Trophy,
  Clock,
  LogOut,
  Copy,
  X,
  Check,
  Navigation,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configured } from "@/lib/client";
import type { Game, Point, Player } from "@/lib/game";
import Maps from "./maps";
type ViewGame = Game & { players: (Player & { submitted?: boolean })[] };
export default function Home() {
  const accepted = useRef({ code: "", version: -1 });
  const [session, setSession] = useState<Session | null>(null),
    [auth, setAuth] = useState<"login" | "signup" | null>(null),
    [game, setGame] = useState<ViewGame | null>(null),
    [code, setCode] = useState(""),
    [join, setJoin] = useState(false),
    [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [point, setPoint] = useState<Point | null>(null),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setGame(null);
        setCode("");
      } else sessionStorage.setItem("gtw-user", s.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function request(
    action?: string,
    extra: Record<string, unknown> = {},
    room = code,
  ) {
    if (!supabase) throw new Error("Подключите Supabase: инструкция в README.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Войдите в аккаунт.");
    const res = await fetch(action ? "/api/game" : `/api/game?code=${room}`, {
      method: action ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: action
        ? JSON.stringify({ action, code: room, ...extra })
        : undefined,
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    return body as { code: string; game: ViewGame; version: number };
  }
  function accept(data: { code: string; game: ViewGame; version: number }) {
    if (
      data.code === accepted.current.code &&
      data.version < accepted.current.version
    )
      return;
    accepted.current = { code: data.code, version: data.version };
    setGame(data.game);
    setCode(data.code);
    localStorage.setItem("gtw-room", data.code);
  }
  async function act(
    action: string,
    extra: Record<string, unknown> = {},
    room = code,
  ) {
    setBusy(true);
    setError("");
    try {
      const data = await request(action, extra, room);
      accept(data);
      setJoin(false);
      setPoint(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    sessionStorage.setItem("gtw-user", session.user.id);
    const saved = localStorage.getItem("gtw-room");
    if (saved)
      request(undefined, {}, saved)
        .then(accept)
        .catch(() =>
          localStorage.removeItem("gtw-room"),
        ); /* session restoration */
  }, [session?.user.id]);
  useEffect(() => {
    if (!code || !session) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const d = await request();
        if (active) {
          accept(d);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code, session?.user.id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setPoint(null);
  }, [game?.pano, game?.phase]);
  function play(solo: boolean) {
    if (!session) {
      setAuth("signup");
      return;
    }
    act("create", { solo });
  }
  function leave() {
    setGame(null);
    setCode("");
    setPoint(null);
    setError("");
    localStorage.removeItem("gtw-room");
  }
  const me = game?.players.find((p) => p.id === session?.user.id),
    host = game?.host === session?.user.id;
  const remaining = Math.max(
    0,
    Math.ceil(((game?.deadline || now) - now) / 1000),
  );
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="GuessTheWorld">
          <span className="brand-icon">
            <Globe2 size={23} />
          </span>
          Guess<span>TheWorld</span>
          <i>β</i>
        </a>
        <nav>
          <span className="nav-label">Мир ближе, чем кажется</span>
          {session ? (
            <>
              <span className="profile">
                {String(
                  session.user.user_metadata.name ||
                    session.user.email?.split("@")[0],
                )}
              </span>
              <button
                className="icon-button"
                aria-label="Выйти"
                onClick={() => supabase?.auth.signOut()}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="login" onClick={() => setAuth("login")}>
              Войти <ArrowUpRight size={15} />
            </button>
          )}
        </nav>
      </header>
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast success" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
      )}
      {!game ? (
        <main className="landing">
          <div className="hero">
            <section className="hero-copy">
              <div className="eyebrow">
                <span /> ВАШ СЛЕДУЮЩИЙ ПУНКТ НАЗНАЧЕНИЯ — НЕИЗВЕСТНОСТЬ
              </div>
              <h1>
                Где-то
                <br />
                на <em>планете.</em>
              </h1>
              <p>
                Новая улица. Незнакомые знаки. Тысячи километров от дома.
                Сможете понять, где вы оказались?
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => play(true)}
                >
                  Отправиться в путешествие <ArrowUpRight size={20} />
                </button>
                <span>5 раундов. Весь мир.</span>
              </div>
              <div className="hero-stats">
                <div>
                  <strong>30</strong>
                  <span>городов мира</span>
                </div>
                <div>
                  <strong>360°</strong>
                  <span>свободы взгляда</span>
                </div>
                <div>
                  <strong>∞</strong>
                  <span>новых открытий</span>
                </div>
              </div>
            </section>
            <section className="hero-art" aria-label="Иллюстрация путешествий">
              <div className="art-grid" />
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="globe">
                <svg viewBox="0 0 400 400" aria-hidden="true">
                  <defs>
                    <clipPath id="earth">
                      <circle cx="200" cy="200" r="175" />
                    </clipPath>
                  </defs>
                  <g
                    clipPath="url(#earth)"
                    fill="none"
                    stroke="#bdd997"
                    strokeWidth="1"
                    opacity=".35"
                  >
                    <circle cx="200" cy="200" r="175" />
                    {[40, 85, 130].map((x) => (
                      <ellipse key={x} cx="200" cy="200" rx={x} ry="175" />
                    ))}
                    {[95, 145, 200, 255, 305].map((y) => (
                      <ellipse key={y} cx="200" cy={y} rx="175" ry="26" />
                    ))}
                  </g>
                  <g fill="#b9dd83" opacity=".9">
                    <path d="M85 104l39-22 38 9 14 22-13 19-27 1-8 30-24 4-12-28-21-8zM129 176l36 9 19 33-13 43-19 22-9-36-21-30zM215 112l24-16 21 10 8 24 34-5 34 22-9 21-41-4-21 18-18-12-15 13-20-17-13-25zM210 180l40-7 23 36-15 48-22 22-13-25-11-40zM287 277l31-12 31 14-5 25-39 4-22-13z" />
                  </g>
                </svg>
                <span className="globe-pin">
                  <MapPin size={28} />
                </span>
              </div>
              <div className="location-card">
                <span className="live-dot" /> СЛЕДУЮЩАЯ ОСТАНОВКА
                <strong>Это может быть где угодно.</strong>
                <div>
                  48° ??′ N &nbsp; 02° ??′ E <Navigation size={16} />
                </div>
              </div>
              <span className="art-coord">EXPLORE / GUESS / DISCOVER</span>
              <span className="art-label">ВЫ ЗДЕСЬ. НО ГДЕ «ЗДЕСЬ»?</span>
            </section>
          </div>
          <section className="mode-section">
            <div className="section-heading">
              <h2>Выберите своё приключение</h2>
              <span>Одному интересно. Вместе — ещё лучше.</span>
            </div>
            <div className="mode-grid">
              <button
                className="mode-card"
                disabled={busy}
                onClick={() => play(true)}
              >
                <div className="mode-top">
                  <span className="mode-icon">
                    <Compass />
                  </span>
                  <span className="tag">В СВОЁМ ТЕМПЕ</span>
                </div>
                <h3>
                  Наедине с миром <ArrowUpRight />
                </h3>
                <p>
                  Исследуйте улицы, замечайте детали и доверяйте своей интуиции.
                </p>
                <div className="mode-bottom">
                  <span>1 игрок · 5 раундов</span>
                  <ArrowRight size={19} />
                </div>
              </button>
              <button
                className="mode-card"
                disabled={busy}
                onClick={() => play(false)}
              >
                <div className="mode-top">
                  <span className="mode-icon">
                    <Users />
                  </span>
                  <span className="tag">С ДРУЗЬЯМИ</span>
                </div>
                <h3>
                  Мир на всех <ArrowUpRight />
                </h3>
                <p>Одна локация для всех. Чей ответ окажется ближе к цели?</p>
                <div className="mode-bottom">
                  <span>2–8 игроков · приватная комната</span>
                  <ArrowRight size={19} />
                </div>
              </button>
              <button
                className="mode-card join-card"
                onClick={() => (session ? setJoin(true) : setAuth("login"))}
              >
                <div className="mode-top">
                  <span className="mode-icon">
                    <MapPin />
                  </span>
                  <span className="tag">ВАС УЖЕ ЖДУТ</span>
                </div>
                <h3>
                  Есть код комнаты? <ArrowUpRight />
                </h3>
                <p>Присоединяйтесь к друзьям и начните путешествие вместе.</p>
                <div className="mode-bottom">
                  <span>Ввести код приглашения</span>
                  <ArrowRight size={19} />
                </div>
              </button>
            </div>
          </section>
          <section className="how">
            <span className="eyebrow">ПРОСТО НАЧАТЬ. СЛОЖНО ОСТАНОВИТЬСЯ.</span>
            <div>
              <p>
                <b>01</b> Осмотритесь вокруг
              </p>
              <p>
                <b>02</b> Отметьте место на карте
              </p>
              <p>
                <b>03</b> Узнайте, насколько вы близко
              </p>
            </div>
          </section>
        </main>
      ) : (
        <main className="game-shell">
          <div className="game-toolbar">
            <button className="text-button" onClick={leave}>
              ← Главная
            </button>
            <span>
              {game.solo ? "Одиночное путешествие" : `Комната ${code}`}
            </span>
            <span className="round-pill">Раунд {game.round || "—"} / 5</span>
            {game.phase === "playing" && (
              <span className="timer">
                <Clock size={16} />
                {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          {game.phase === "lobby" ? (
            <section className="lobby panel">
              <div className="big-icon">
                <Users size={34} />
              </div>
              <span className="eyebrow">
                {game.solo ? "ВАШЕ ПУТЕШЕСТВИЕ" : "МЕСТО ВСТРЕЧИ"}
              </span>
              <h1>{game.solo ? "Мир ждёт вас." : "Соберите свою команду."}</h1>
              <p>
                {game.solo
                  ? "Пять случайных мест. Две минуты на каждое. До 5000 очков за ответ."
                  : "Отправьте код друзьям. Все попадут в одну локацию и смогут исследовать её самостоятельно."}
              </p>
              {!game.solo && (
                <button
                  className="room-code"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      setNotice("Код скопирован");
                    } catch {
                      setNotice(`Код комнаты: ${code}`);
                    }
                  }}
                >
                  {code}
                  <Copy size={20} />
                </button>
              )}
              <div className="player-list">
                {game.players.map((p) => (
                  <div key={p.id}>
                    <span className="avatar">{p.name[0].toUpperCase()}</span>
                    <strong>{p.name}</strong>
                    <span>
                      {p.id === game.host ? "Создатель" : "Готов к игре"}
                    </span>
                  </div>
                ))}
              </div>
              {host ? (
                <button
                  className="primary"
                  disabled={busy || (!game.solo && game.players.length < 2)}
                  onClick={() => act("start")}
                >
                  {busy ? "Ищем место…" : "Начать путешествие"}
                  <ArrowRight size={19} />
                </button>
              ) : (
                <p>Ждём, когда создатель начнёт игру…</p>
              )}
            </section>
          ) : (
            <>
              <div className="play-layout">
                <div className="play-main">
                  <Maps game={game} locked={!!me?.guess} onGuess={setPoint} />
                  {game.phase === "playing" && (
                    <div className="guess-bar">
                      <span>
                        {me?.guess
                          ? "Ответ принят. Ждём остальных игроков…"
                          : point
                            ? `${point.lat.toFixed(3)}°, ${point.lng.toFixed(3)}°`
                            : "Осмотритесь и выберите точку на карте"}
                      </span>
                      <button
                        className="primary"
                        disabled={
                          !point || !!me?.guess || busy || remaining === 0
                        }
                        onClick={() => point && act("guess", point)}
                      >
                        {me?.guess ? <Check size={18} /> : <MapPin size={18} />}{" "}
                        {me?.guess ? "Ответ принят" : "Это здесь!"}
                      </button>
                    </div>
                  )}
                </div>
                <aside className="scoreboard">
                  <span className="eyebrow">
                    {game.phase === "playing" ? "ЭКСПЕДИЦИЯ" : "РЕЗУЛЬТАТЫ"}
                  </span>
                  <h2>
                    {game.phase === "finished" ? "Финиш!" : "Таблица игроков"}
                  </h2>
                  {[...game.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <div className="score-row" key={p.id}>
                        <span className="rank">{i + 1}</span>
                        <div>
                          <strong>
                            {p.name}
                            {p.id === session?.user.id ? " (вы)" : ""}
                          </strong>
                          <small>
                            {game.phase === "playing"
                              ? p.submitted
                                ? "✓ Ответ принят"
                                : "Исследует мир…"
                              : p.distance === undefined
                                ? "Нет ответа"
                                : `${p.distance.toFixed(1)} км · +${p.roundScore} очков`}
                          </small>
                        </div>
                        <b>{p.score.toLocaleString("ru")}</b>
                      </div>
                    ))}
                  {game.phase === "finished" && (
                    <div className="winner">
                      <Trophy />
                      <strong>
                        {game.players
                          .filter(
                            (p) =>
                              p.score ===
                              Math.max(...game.players.map((x) => x.score)),
                          )
                          .map((p) => p.name)
                          .join(" и ")}
                      </strong>
                      <span>
                        {game.players.filter(
                          (p) =>
                            p.score ===
                            Math.max(...game.players.map((x) => x.score)),
                        ).length > 1
                          ? "Ничья!"
                          : "Лучший результат матча"}
                      </span>
                    </div>
                  )}
                  {game.phase === "results" &&
                    (host ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => act("next")}
                      >
                        {busy ? "Ищем место…" : "Следующий раунд"}
                        <ArrowRight size={18} />
                      </button>
                    ) : (
                      <p>Ждём следующий раунд…</p>
                    ))}
                  {game.phase === "finished" && (
                    <>
                      <button
                        className="primary"
                        disabled={busy || me?.ready}
                        onClick={() => act("replay")}
                      >
                        {me?.ready ? "Вы готовы ✓" : "Переиграть"}
                      </button>
                      <p className="muted">
                        Готовы: {game.players.filter((p) => p.ready).length} /{" "}
                        {game.players.length}. Новый матч начнётся после
                        согласия всех игроков.
                      </p>
                    </>
                  )}
                </aside>
              </div>
            </>
          )}
        </main>
      )}
      <footer>
        <span className="footer-brand">
          <Globe2 size={16} /> GuessTheWorld
        </span>
        <span>Любопытство — лучший компас.</span>
        <span>Сделано для исследователей ↗</span>
      </footer>
      {auth && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Аккаунт"
          >
            <button
              className="modal-close"
              aria-label="Закрыть"
              onClick={() => setAuth(null)}
            >
              <X />
            </button>
            <div className="big-icon">
              <Globe2 size={32} />
            </div>
            <h2>
              {auth === "signup" ? "Начните открывать мир" : "С возвращением!"}
            </h2>
            <p>
              {auth === "signup"
                ? "Создайте аккаунт для игры с друзьями."
                : "Ваше следующее путешествие уже близко."}
            </p>
            {!configured && (
              <p className="setup-warning">
                Сначала подключите Supabase по инструкции в README.
              </p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supabase) return;
                setBusy(true);
                setError("");
                const f = new FormData(e.currentTarget);
                try {
                  const result =
                    auth === "signup"
                      ? await supabase.auth.signUp({
                          email: String(f.get("email")),
                          password: String(f.get("password")),
                          options: {
                            data: { name: String(f.get("name")) },
                            emailRedirectTo: window.location.origin,
                          },
                        })
                      : await supabase.auth.signInWithPassword({
                          email: String(f.get("email")),
                          password: String(f.get("password")),
                        });
                  if (result.error) throw result.error;
                  setAuth(null);
                  if (auth === "signup" && !result.data.session)
                    setNotice(
                      "Проверьте почту и подтвердите регистрацию. Затем войдите.",
                    );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {auth === "signup" && (
                <label>
                  Имя путешественника
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={24}
                    autoComplete="nickname"
                    placeholder="Как вас называть?"
                  />
                </label>
              )}
              <label>
                Почта
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Пароль
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete={
                    auth === "signup" ? "new-password" : "current-password"
                  }
                  placeholder="Минимум 8 символов"
                />
              </label>
              <button className="primary" disabled={busy || !configured}>
                {busy
                  ? "Подождите…"
                  : auth === "signup"
                    ? "Создать аккаунт"
                    : "Войти"}
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button auth-switch"
              onClick={() => setAuth(auth === "signup" ? "login" : "signup")}
            >
              {auth === "signup"
                ? "Уже есть аккаунт? Войти"
                : "Нет аккаунта? Зарегистрироваться"}
            </button>
          </section>
        </div>
      )}
      {join && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Присоединиться"
          >
            <button
              className="modal-close"
              aria-label="Закрыть"
              onClick={() => setJoin(false)}
            >
              <X />
            </button>
            <div className="big-icon">
              <Users size={32} />
            </div>
            <h2>Ваша команда ждёт</h2>
            <p>Введите код, который прислал создатель комнаты.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("join", {}, input);
              }}
            >
              <input
                className="code-input"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="A1B2C3"
                maxLength={6}
                minLength={6}
                required
                pattern="[A-Z0-9]{6}"
                aria-label="Код комнаты"
              />
              <button className="primary" disabled={busy}>
                Присоединиться
                <ArrowRight size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
