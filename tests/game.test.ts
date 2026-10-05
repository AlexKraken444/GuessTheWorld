import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, score, finish, publicGame } from "../lib/game.ts";
import type { Game } from "../lib/game.ts";
test("great circle distances and scoring", () => {
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) - 20015) < 2,
  );
  assert.equal(score(0), 5000);
  assert.ok(score(10) > score(100));
});
function fixture(): Game {
  return {
    host: "a",
    solo: false,
    phase: "playing",
    round: 1,
    used: [],
    target: { lat: 48, lng: 2 },
    players: [
      { id: "a", name: "A", score: 0, guess: { lat: 48, lng: 2 } },
      { id: "b", name: "B", score: 0, guess: { lat: 0, lng: 0 } },
    ],
  };
}
test("closer player wins and scoring is idempotent", () => {
  const g = fixture();
  finish(g);
  assert.equal(g.players[0].score, 5000);
  assert.ok(g.players[0].score > g.players[1].score);
  finish(g);
  assert.equal(g.players[0].score, 5000);
  assert.equal(g.phase, "results");
});
test("unsubmitted answers score zero; fifth round ends match", () => {
  const g = fixture();
  g.round = 5;
  delete g.players[1].guess;
  finish(g);
  assert.equal(g.players[1].score, 0);
  assert.equal(g.phase, "finished");
});
test("active rounds hide target and other players guesses", () => {
  const g = fixture();
  const view = publicGame(g, "a");
  assert.equal(view.target, undefined);
  assert.equal("guess" in view.players[1], false);
  assert.equal(view.players[1].submitted, true);
  finish(g);
  assert.deepEqual(publicGame(g, "a").target, g.target);
});
