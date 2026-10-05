import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { admin, location } from "@/lib/server";
import { Game, finish, publicGame } from "@/lib/game";
export const runtime = "nodejs";
export const maxDuration = 60;
async function user(req: NextRequest) {
  const db = admin();
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Войдите в аккаунт.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Сессия истекла. Войдите снова.");
  return { db, u: data.user };
}
function codeOf(req: NextRequest, b?: Record<string, unknown>) {
  const code = String(
    b?.code ?? req.nextUrl.searchParams.get("code") ?? "",
  ).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code))
    throw new Error("Код комнаты состоит из 6 символов.");
  return code;
}
export async function GET(req: NextRequest) {
  try {
    const { db, u } = await user(req);
    const code = codeOf(req);
    for (let i = 0; i < 8; i++) {
      const { data, error } = await db
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();
      if (error) throw databaseError(error);
      if (!data) throw new Error("Комната не найдена.");
      const g = data.state as Game;
      if (!g.players.some((p) => p.id === u.id))
        throw new Error("Вы не участник комнаты.");
      if (g.phase === "playing" && Date.now() > g.deadline!) {
        finish(g);
        const { data: updated, error: saveError } = await db
          .from("rooms")
          .update({ state: g, version: data.version + 1 })
          .eq("code", code)
          .eq("version", data.version)
          .select("code");
        if (saveError) throw saveError;
        if (!updated?.length) continue;
        data.version += 1;
      }
      return NextResponse.json(
        { code, game: publicGame(g, u.id), version: data.version },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw new Error("Комната обновляется. Повторите запрос.");
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { db, u } = await user(req);
    const b = await req.json();
    const name = String(
      u.user_metadata.name || u.email?.split("@")[0] || "Путешественник",
    ).slice(0, 24);
    if (b.action === "create") {
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      const g: Game = {
        host: u.id,
        solo: !!b.solo,
        phase: "lobby",
        round: 0,
        players: [{ id: u.id, name, score: 0 }],
        used: [],
      };
      const { error } = await db.from("rooms").insert({ code, state: g });
      if (error) throw databaseError(error);
      return NextResponse.json({ code, game: publicGame(g, u.id), version: 0 });
    }
    const code = codeOf(req, b);
    let nextLocation: Awaited<ReturnType<typeof location>> | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await db
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();
      if (error) throw databaseError(error);
      if (!data) throw new Error("Комната не найдена.");
      const g = data.state as Game;
      const p = g.players.find((p) => p.id === u.id);
      if (b.action === "join") {
        if (!p) {
          if (g.phase !== "lobby" || g.solo)
            throw new Error("Матч уже начался или комната закрыта.");
          if (g.players.length >= 8)
            throw new Error("В комнате уже 8 игроков.");
          g.players.push({ id: u.id, name, score: 0 });
        }
      } else {
        if (!p) throw new Error("Вы не участник комнаты.");
        if (g.phase === "playing" && Date.now() > g.deadline!) finish(g);
        if (b.action === "start" || b.action === "next") {
          if (g.host !== u.id || !["lobby", "results"].includes(g.phase))
            throw new Error("Начать раунд может только создатель комнаты.");
          if (!g.solo && g.players.length < 2)
            throw new Error("Дождитесь хотя бы второго игрока.");
          nextLocation ??= await location(g.used);
          Object.assign(g, nextLocation, {
            phase: "playing",
            round: g.round + 1,
            deadline: Date.now() + 120000,
          });
          g.used.push(nextLocation.pano);
          for (const player of g.players) {
            delete player.guess;
            delete player.distance;
            delete player.roundScore;
            player.ready = false;
          }
        } else if (b.action === "guess") {
          if (g.phase === "playing") {
            if (p.guess) throw new Error("Ответ уже принят.");
            const lat = Number(b.lat),
              lng = Number(b.lng);
            if (
              typeof b.lat !== "number" ||
              typeof b.lng !== "number" ||
              !Number.isFinite(lat) ||
              !Number.isFinite(lng) ||
              Math.abs(lat) > 90 ||
              Math.abs(lng) > 180
            )
              throw new Error("Выберите корректную точку на карте.");
            p.guess = { lat, lng };
            if (g.players.every((x) => x.guess)) finish(g);
          }
        } else if (b.action === "replay") {
          if (g.phase !== "finished") throw new Error("Матч ещё не завершён.");
          p.ready = true;
          if (g.players.every((x) => x.ready)) {
            g.phase = "lobby";
            g.round = 0;
            g.used = [];
            delete g.target;
            delete g.pano;
            delete g.deadline;
            for (const player of g.players) {
              player.score = 0;
              player.ready = false;
              delete player.guess;
              delete player.distance;
              delete player.roundScore;
            }
          }
        } else throw new Error("Неизвестное действие.");
      }
      const { data: saved, error: saveError } = await db
        .from("rooms")
        .update({ state: g, version: data.version + 1 })
        .eq("code", code)
        .eq("version", data.version)
        .select("code");
      if (saveError) throw saveError;
      if (saved?.length)
        return NextResponse.json({
          code,
          game: publicGame(g, u.id),
          version: data.version + 1,
        });
    }
    throw new Error("Комната обновляется. Попробуйте ещё раз.");
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  console.error(e instanceof Error ? e.message : "Game error");
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Ошибка сервера" },
    { status: 400 },
  );
}
function databaseError(error: { code?: string; message: string }) {
  console.error("Supabase database:", error.code, error.message);
  if (error.code === "PGRST205" || error.code === "42P01")
    return new Error(
      "В Supabase не создана таблица комнат. Выполните supabase/schema.sql в SQL Editor.",
    );
  if (error.code === "42501")
    return new Error(
      "Серверу недоступна таблица комнат. Проверьте SUPABASE_SERVICE_ROLE_KEY в Vercel.",
    );
  if (error.code === "PGRST116") return new Error("Комната не найдена.");
  return new Error(
    "Не удалось сохранить или загрузить комнату. Проверьте настройки Supabase и логи сервера.",
  );
}
