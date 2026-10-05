/// <reference types="google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import type { Game, Point } from "@/lib/game";
let loader: Promise<void> | undefined;
function load() {
  if (!loader)
    loader = new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loader = undefined;
        reject(new Error("Не удалось загрузить Google Maps."));
      };
      document.head.appendChild(s);
    });
  return loader;
}
export default function Maps({
  game,
  onGuess,
  locked,
}: {
  game: Game;
  onGuess: (p: Point) => void;
  locked: boolean;
}) {
  const street = useRef<HTMLDivElement>(null),
    mapEl = useRef<HTMLDivElement>(null),
    pano = useRef<google.maps.StreetViewPanorama | null>(null);
  const [error, setError] = useState("");
  const onGuessRef = useRef(onGuess);
  onGuessRef.current = onGuess;
  useEffect(() => {
    let active = true;
    let map: google.maps.Map | undefined;
    let markers: google.maps.Marker[] = [];
    let line: google.maps.Polyline | undefined;
    let listener: google.maps.MapsEventListener | undefined;
    setError("");
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setError(
        "Для игры нужен Google Maps API-ключ. Инструкция по подключению находится в README.",
      );
      return;
    }
    load()
      .then(() => {
        if (!active || !mapEl.current) return;
        map = new google.maps.Map(mapEl.current, {
          center: { lat: 25, lng: 10 },
          zoom: 2,
          minZoom: 2,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        const reveal = game.phase !== "playing";
        if (!reveal && street.current) {
          pano.current = new google.maps.StreetViewPanorama(street.current, {
            pano: game.pano,
            pov: { heading: 0, pitch: 0 },
            zoom: 0,
            addressControl: false,
            showRoadLabels: false,
            fullscreenControl: false,
            linksControl: true,
            enableCloseButton: false,
          });
          listener = map.addListener(
            "click",
            (e: google.maps.MapMouseEvent) => {
              if (locked || !e.latLng) return;
              markers.forEach((m) => m.setMap(null));
              const point = e.latLng.toJSON();
              markers = [
                new google.maps.Marker({
                  position: point,
                  map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 9,
                    fillColor: "#c7f56b",
                    fillOpacity: 1,
                    strokeColor: "#14201a",
                    strokeWeight: 3,
                  },
                }),
              ];
              onGuessRef.current(point);
            },
          );
        } else if (game.target) {
          const bounds = new google.maps.LatLngBounds();
          markers.push(
            new google.maps.Marker({ position: game.target, map, label: "✓" }),
          );
          bounds.extend(game.target);
          [...game.players]
            .sort((a, b) => b.score - a.score)
            .forEach((p, i) => {
              if (p.guess) {
                markers.push(
                  new google.maps.Marker({
                    position: p.guess,
                    map,
                    label: String(i + 1),
                  }),
                );
                bounds.extend(p.guess);
              }
            });
          const own = game.players.find((p) => p.id === supabaseId());
          if (own?.guess)
            line = new google.maps.Polyline({
              path: [own.guess, game.target],
              map,
              strokeColor: "#739d37",
              strokeWeight: 3,
            });
          map.fitBounds(bounds, 50);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      listener?.remove();
      markers.forEach((m) => m.setMap(null));
      line?.setMap(null);
      pano.current?.setVisible(false);
      pano.current = null;
    };
  }, [game.pano, game.phase, locked]);
  return (
    <div className={game.phase === "playing" ? "map-stage" : "result-map"}>
      {game.phase === "playing" && (
        <>
          <div ref={street} className="street" />
          <div className="explore-note">
            ↔ Исследуйте улицу • ищите подсказки
          </div>
          <button
            className="return-button"
            onClick={() => pano.current?.setPano(game.pano!)}
          >
            ↩ К началу
          </button>
        </>
      )}
      <div className="guess-map">
        <div className="map-caption">
          {game.phase === "playing"
            ? "Где вы находитесь? Нажмите на карту."
            : "✓ Правильное место · цифры — ответы игроков"}
        </div>
        <div ref={mapEl} className="map-canvas" />
      </div>
      {error && <div className="map-error">{error}</div>}
    </div>
  );
}
function supabaseId() {
  return sessionStorage.getItem("gtw-user");
}
