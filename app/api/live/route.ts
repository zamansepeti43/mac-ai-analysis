import { NextResponse } from "next/server";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
type R = Record<string, any>;

function num(v: any) { return typeof v === "number" ? v : Number(v) || 0; }

async function sportmonks(path: string) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${SPORTMONKS_URL}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sportmonks ${res.status}: ${json?.message ?? "istek başarısız"}`);
  return json;
}

async function apiFootball(path: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  const res = await fetch(`${API_FOOTBALL_URL}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${json?.message ?? "istek başarısız"}`);
  return json;
}

function statValue(stats: R[], names: string[], location?: string) {
  const wanted = names.map((n) => n.toLowerCase());
  const row = stats.find((item) => {
    if (location && item.location !== location) return false;
    const text = `${item.type?.name ?? item.type?.developer_name ?? item.type ?? ""}`.toLowerCase();
    return wanted.some((name) => text.includes(name));
  });
  return num(row?.data?.value ?? row?.value);
}

function signal(s: { shots: number; shotsOnTarget: number; corners: number; bigChances?: number }, minute: number) {
  const intensity = Math.min(2, 0.2 + s.shots * 0.04 + s.shotsOnTarget * 0.12 + s.corners * 0.02 + (s.bigChances ?? 0) * 0.08);
  const remaining = Math.max(0, Math.min(60, 90 - minute));
  const probability = Math.max(1, Math.min(99, Math.round((1 - Math.exp(-(intensity * remaining / 45))) * 100)));
  return { nextGoal: probability, signal: probability >= 65 ? "Güçlü gol sinyali" : probability >= 45 ? "Orta gol sinyali" : "Düşük gol sinyali" };
}

function sportmonksMap(f: R) {
  const participants = f.participants ?? [];
  const home = participants.find((p: R) => p.meta?.location === "home") ?? participants[0] ?? {};
  const away = participants.find((p: R) => p.meta?.location === "away") ?? participants[1] ?? {};
  const scores = f.scores ?? [];
  const currentScore = (location: string) => {
    const row = scores.find((s: R) => s.score?.participant === location && (s.description === "CURRENT" || typeof s.score?.goals === "number"));
    return num(row?.score?.goals);
  };
  const periods = f.periods ?? [];
  const currentPeriod = periods.find((p: R) => p.is_current) ?? periods[periods.length - 1] ?? {};
  const minute = Math.max(0, Math.min(120, num(currentPeriod.minutes ?? currentPeriod.minute ?? f.state?.elapsed ?? 0)));
  const stats = f.statistics ?? [];
  const shots = statValue(stats, ["shots", "total shots"], "home") + statValue(stats, ["shots", "total shots"], "away");
  const shotsOnTarget = statValue(stats, ["shots on target", "on target"], "home") + statValue(stats, ["shots on target", "on target"], "away");
  const corners = statValue(stats, ["corners"], "home") + statValue(stats, ["corners"], "away");
  const bigChances = statValue(stats, ["big chances"], "home") + statValue(stats, ["big chances"], "away");
  const hp = statValue(stats, ["ball possession", "possession"], "home");
  const ap = statValue(stats, ["ball possession", "possession"], "away");
  const goalSignal = signal({ shots, shotsOnTarget, corners, bigChances }, minute);
  return {
    id: f.id,
    league: f.league?.name ?? "Lig",
    country: f.league?.country?.name ?? "",
    home: home.name ?? "Ev sahibi",
    away: away.name ?? "Deplasman",
    homeLogo: home.image_path ?? home.logo ?? null,
    awayLogo: away.image_path ?? away.logo ?? null,
    minute,
    status: f.state?.name ?? (f.state_id ? "CANLI" : "LIVE"),
    statusLong: f.state?.name ?? "Canlı",
    homeScore: currentScore("home"),
    awayScore: currentScore("away"),
    startTime: f.starting_at ?? null,
    timestamp: f.starting_at_timestamp ?? null,
    shots,
    shotsOnTarget,
    corners,
    bigChances,
    possession: { home: Math.round(hp), away: Math.round(ap) },
    ...goalSignal,
  };
}

function apiFootballMap(f: R, stats: { shots: number; shotsOnTarget: number; corners: number; possession: { home: number; away: number } }) {
  const s = f.score ?? {}, teams = f.teams ?? {}, goals = s.goals ?? {}, status = f.fixture?.status ?? {};
  const base = {
    id: f.fixture?.id,
    league: f.league?.name ?? "Lig",
    country: f.league?.country ?? "",
    home: teams.home?.name ?? "Ev sahibi",
    away: teams.away?.name ?? "Deplasman",
    homeLogo: teams.home?.logo ?? null,
    awayLogo: teams.away?.logo ?? null,
    minute: num(status.elapsed),
    status: status.short ?? "LIVE",
    statusLong: status.long ?? "Canlı",
    homeScore: num(goals.home),
    awayScore: num(goals.away),
    startTime: f.fixture?.date ?? null,
    timestamp: f.fixture?.timestamp ?? null,
    ...stats,
  };
  return { ...base, ...signal(stats, base.minute) };
}

async function apiFootballStats(id: number) {
  try {
    const json = await apiFootball(`/fixtures/statistics?fixture=${id}`);
    const rows = json?.response ?? [];
    const h = rows[0]?.statistics ?? [], a = rows[1]?.statistics ?? [];
    const val = (arr: R[], names: string[]) => statValue(arr, names);
    return {
      shots: val(h, ["total shots"]) + val(a, ["total shots"]),
      shotsOnTarget: val(h, ["shots on goal"]) + val(a, ["shots on goal"]),
      corners: val(h, ["corner kicks"]) + val(a, ["corner kicks"]),
      possession: { home: val(h, ["ball possession"]), away: val(a, ["ball possession"]) },
    };
  } catch {
    return { shots: 0, shotsOnTarget: 0, corners: 0, possession: { home: 0, away: 0 } };
  }
}

export async function GET() {
  const diagnostics: string[] = [];
  try {
    const sm = await sportmonks("/livescores/inplay?include=participants;league;scores;periods;statistics;events;state");
    const fixtures = (sm?.data ?? []) as R[];
    if (fixtures.length) {
      const live = fixtures.map(sportmonksMap);
      return NextResponse.json({ source: "sportmonks", updatedAt: new Date().toISOString(), live, count: live.length });
    }
    diagnostics.push("Sportmonks canlı akışı boş döndü");
  } catch (e) {
    diagnostics.push(e instanceof Error ? e.message : "Sportmonks bağlantı hatası");
  }

  try {
    const af = await apiFootball("/fixtures?live=all");
    const fixtures = (af?.response ?? []) as R[];
    if (fixtures.length) {
      const live = await Promise.all(fixtures.map(async (f) => apiFootballMap(f, await apiFootballStats(f.fixture?.id))));
      return NextResponse.json({ source: "api-football", updatedAt: new Date().toISOString(), live, count: live.length });
    }
    diagnostics.push("API-Football canlı akışı boş döndü");
  } catch (e) {
    diagnostics.push(e instanceof Error ? e.message : "API-Football bağlantı hatası");
  }

  return NextResponse.json({ source: "none", updatedAt: new Date().toISOString(), live: [], count: 0, message: "Canlı maç akışından veri alınamadı.", diagnostics: process.env.NODE_ENV === "production" ? undefined : diagnostics });
}
