export type Point = { lat: number; lng: number };
export type Player = {
  id: string;
  name: string;
  score: number;
  guess?: Point;
  distance?: number;
  roundScore?: number;
  ready?: boolean;
};
export type Game = {
  host: string;
  solo: boolean;
  phase: "lobby" | "playing" | "results" | "finished";
  round: number;
  players: Player[];
  target?: Point;
  pano?: string;
  deadline?: number;
  used: string[];
};
export function distance(a: Point, b: Point) {
  const r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function score(km: number) {
  return Math.round(5000 * Math.exp(-km / 2000));
}
export function finish(g: Game) {
  if (g.phase !== "playing" || !g.target) return;
  for (const p of g.players) {
    p.distance = p.guess ? distance(p.guess, g.target) : undefined;
    p.roundScore = p.distance === undefined ? 0 : score(p.distance);
    p.score += p.roundScore;
  }
  g.phase = g.round === 5 ? "finished" : "results";
}
export function publicGame(g: Game, id: string) {
  const { target, ...rest } = g;
  return {
    ...rest,
    target:
      g.phase === "results" || g.phase === "finished" ? target : undefined,
    players: g.players.map((p) =>
      g.phase === "playing" && p.id !== id
        ? { id: p.id, name: p.name, score: p.score, submitted: !!p.guess }
        : { ...p, submitted: !!p.guess },
    ),
  };
}
