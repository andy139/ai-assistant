import type { WeatherCurrentArgs } from "../schemas/weather.js";
import type { ToolResult } from "../registry.js";

interface GeoResult {
  results?: { name: string; country: string; latitude: number; longitude: number }[];
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

const weatherCodes: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export async function weatherCurrent(args: WeatherCurrentArgs): Promise<ToolResult> {
  try {
    // 1. Geocode the location
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.location)}&count=1`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) });

    if (!geoRes.ok) {
      return { ok: false, data: null, summary: `Could not find location "${args.location}"` };
    }

    const geo = (await geoRes.json()) as GeoResult;
    const place = geo.results?.[0];

    if (!place) {
      return { ok: false, data: null, summary: `Location not found: "${args.location}"` };
    }

    // 2. Get weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=celsius&wind_speed_unit=mph`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(8000) });

    if (!weatherRes.ok) {
      return { ok: false, data: null, summary: "Weather API error" };
    }

    const weather = (await weatherRes.json()) as OpenMeteoResponse;
    const c = weather.current;
    const condition = weatherCodes[c.weather_code] ?? "Unknown";
    const tempF = cToF(c.temperature_2m);
    const feelsLikeF = cToF(c.apparent_temperature);

    const data = {
      location: `${place.name}, ${place.country}`,
      tempF: String(tempF),
      tempC: String(Math.round(c.temperature_2m)),
      feelsLikeF: String(feelsLikeF),
      humidity: `${c.relative_humidity_2m}%`,
      wind: `${Math.round(c.wind_speed_10m)} mph`,
      condition,
    };

    return {
      ok: true,
      data,
      summary: `${data.location}: ${condition}, ${tempF}°F (${data.tempC}°C), feels like ${feelsLikeF}°F, humidity ${data.humidity}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Weather lookup failed: ${msg}` };
  }
}
