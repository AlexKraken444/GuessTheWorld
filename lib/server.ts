import { createClient } from "@supabase/supabase-js";
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Настройте Supabase в переменных окружения.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const seeds = [
  [48.8566, 2.3522],
  [51.5074, -0.1278],
  [40.7128, -74.006],
  [35.6762, 139.6503],
  [-33.8688, 151.2093],
  [41.9028, 12.4964],
  [59.3293, 18.0686],
  [37.5665, 126.978],
  [52.3676, 4.9041],
  [38.7223, -9.1393],
  [50.0755, 14.4378],
  [-34.6037, -58.3816],
  [-23.5505, -46.6333],
  [1.3521, 103.8198],
  [25.033, 121.5654],
  [43.6532, -79.3832],
  [60.1699, 24.9384],
  [55.6761, 12.5683],
  [47.3769, 8.5417],
  [41.3851, 2.1734],
  [-36.8485, 174.7633],
  [-33.9249, 18.4241],
  [64.1466, -21.9426],
  [19.4326, -99.1332],
  [13.7563, 100.5018],
  [45.4642, 9.19],
  [34.0522, -118.2437],
  [37.7749, -122.4194],
  [53.3498, -6.2603],
  [52.52, 13.405],
];
export async function location(used: string[]) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) throw new Error("Добавьте GOOGLE_MAPS_SERVER_KEY для Street View.");
  for (let i = 0; i < 8; i++) {
    const s = seeds[Math.floor(Math.random() * seeds.length)];
    const lat = s[0] + (Math.random() - 0.5) * 0.08,
      lng = s[1] + (Math.random() - 0.5) * 0.08;
    const url = new URL(
      "https://maps.googleapis.com/maps/api/streetview/metadata",
    );
    url.search = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: "1500",
      source: "outdoor",
      key,
    }).toString();
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    if (data.status === "OK" && !used.includes(data.pano_id))
      return {
        target: data.location as { lat: number; lng: number },
        pano: data.pano_id as string,
      };
    if (["REQUEST_DENIED", "OVER_QUERY_LIMIT"].includes(data.status))
      throw new Error(
        "Google Maps: проверьте API-ключ, включённые API и квоту.",
      );
  }
  throw new Error("Не удалось найти панораму. Попробуйте ещё раз.");
}
