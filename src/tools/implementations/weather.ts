import type { WeatherCurrentArgs } from "../schemas/weather.js";
import type { ToolResult } from "../registry.js";

interface WttrCondition {
  temp_F: string;
  temp_C: string;
  humidity: string;
  weatherDesc: { value: string }[];
  FeelsLikeF: string;
  FeelsLikeC: string;
  windspeedMiles: string;
}

interface WttrResponse {
  current_condition: WttrCondition[];
  nearest_area: { areaName: { value: string }[]; country: { value: string }[] }[];
}

export async function weatherCurrent(args: WeatherCurrentArgs): Promise<ToolResult> {
  const encoded = encodeURIComponent(args.location);
  const res = await fetch(`https://wttr.in/${encoded}?format=j1`);

  if (!res.ok) {
    return {
      ok: false,
      data: null,
      summary: `Weather API returned ${res.status} for "${args.location}"`,
    };
  }

  const json = (await res.json()) as WttrResponse;
  const current = json.current_condition?.[0];

  if (!current) {
    return { ok: false, data: null, summary: `No weather data for "${args.location}"` };
  }

  const area = json.nearest_area?.[0];
  const areaName = area?.areaName?.[0]?.value ?? args.location;
  const country = area?.country?.[0]?.value ?? "";

  const data = {
    location: country ? `${areaName}, ${country}` : areaName,
    tempF: current.temp_F,
    tempC: current.temp_C,
    feelsLikeF: current.FeelsLikeF,
    feelsLikeC: current.FeelsLikeC,
    humidity: `${current.humidity}%`,
    wind: `${current.windspeedMiles} mph`,
    condition: current.weatherDesc?.[0]?.value ?? "Unknown",
  };

  return {
    ok: true,
    data,
    summary: `${data.location}: ${data.condition}, ${data.tempF}°F (${data.tempC}°C), humidity ${data.humidity}`,
  };
}
