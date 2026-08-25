import { NextResponse } from "next/server";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";

type AnyRecord = Record<string, any>;

type LiveFixture = {
  id: number;
  name?: string;
  starting_at?: string;
  state_id?: number;
  league?: { id?: number; name?: string; country?: { name?: string } };
  participants?: AnyRecord[];
  scores?: AnyRecord[];
  events?: AnyRecord[];
  statistics?: AnyRecord[];
  periods?: AnyRecord[];
  xgfixture?: AnyRecord[];
  xGFixture?: AnyRecord[];
};

function valueFromStats(stats: AnyRecord[], names: string[], location: string) {
  const normalized = names.map((name) => name.toLowerCase());
  const item = stats.find((row) => {
    if (row.location !== location) return false;
    const text = `${row.type?.name ?? ""} ${row.type?.developer_name ?? ""} ${row.type?.code ?? ""}`.toLowerCase();
    return normalized.some((name) => text.includes(name));
  });
  const value = item?.data?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("%", ""));
  return 0;
}

function participants(fixture: LiveFixture) {
  const list = fixture.participants ?? [];
  return {
    home: list.find((p) => p.meta?.location === "home") ?? list[0],
    away: list.find((p) => p.meta?.location === "away") ?? list[1],
  };
}

function scoreFor(fixture: LiveFixture, location: "home" | "away") {
  const scores = fixture.scores ?? [];
  const candidates = scores.filter((row) => row.score?.participant === location || row.description === "CURRENT");
  const row = candidates.find((item) => item.score?.participant === location && typeof item.score?.goals === "number") ?? candidates.find((item) => item.description === "CURRENT" && item.score?.participant === location);
  return typeof row?.score?.goals === "number" ? row.score.goals : 0;
}

function minuteFrom(fixture: LiveFixture) {
  const periods = fixture.periods ?? [];
  const current = periods.find((p) => p.is_current) ?? periods[periods.length - 1];
  const minute = Number(current?.minutes ?? current?.minute ?? current?.started ?? 0);
  return Number.isFinite(minute) ? Math.max(0, Math.min(120, minute)) : 0;
}

function liveProbability(fixture: LiveFixture) {
  const stats = fixture.statistics ?? [];
  const minute = minuteFrom(fixture);
  const homeShots = valueFromStats(stats, ["shots", "total shots"], "home");
  const awayShots = valueFromStats(stats, ["shots", "total shots"], "away");
  const homeOn = valueFromStats(stats, ["shots on target", "on target"], "home");
  const awayOn = valueFromStats(stats, ["shots on target", "on target"], "away");
  const homePoss = valueFromStats(stats, ["ball possession", "possession"], "home");
  const awayPoss = valueFromStats(stats, ["ball possession", "possession"], "away");
  const homeCorners = valueFromStats(stats, ["corners"], "home");
  const awayCorners = valueFromStats(stats, ["corners"], "away");
  const homeBig = valueFromStats(stats, ["big chances"], "home");
  const awayBig = valueFromStats(stats, ["big chances"], "away");
  const totalShots = homeShots + awayShots;
  const totalOn = homeOn + awayOn;
  const totalCorners = homeCorners + awayCorners;
  const totalBig = homeBig + awayBig;
  const intensity = Math.min(1.9, 0.15 + totalShots * 0.035 + totalOn * 0.11 + totalCorners * 0.018 + totalBig * 0.16 + (Math.abs(homePoss - awayPoss) < 18 ? 0.08 : 0));
  const remaining = Math.max(0, Math.min(60, 90 - Math.min(90, minute)));
  const lambda = intensity * (remaining / 45);
  const nextGoal = Math.round((1 - Math.exp(-lambda)) * 100);
  const currentHome = scoreFor(fixture, "home");
  const currentAway = scoreFor(fixture, "away");
  const status = minute > 0 && minute < 90 ? `${Math.floor(minute)}'` : "CANLI";
  return {
    minute: Math.floor(minute),
    status,
    homeScore: currentHome,
    awayScore: currentAway,
    nextGoal: Math.max(1, Math.min(99, nextGoal)),
    shots: totalShots,
    shotsOnTarget: totalOn,
    corners: totalCorners,
    bigChances: totalBig,
    possession: { home: Math.round(homePoss), away: Math.round(awayPoss) },
    signal: nextGoal >= 65 ? "Güçlü gol sinyali" : nextGoal >= 45 ? "Orta gol sinyali" : "Düşük gol sinyali",
    explanation: `Canlı model ${Math.floor(minute)}. dakika verisini; şut, isabetli şut, korner, büyük şans ve topa sahip olma ile birlikte değerlendiriyor.`,
  };
}

async function getLiveFixtures() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return [] as LiveFixture[];
  const url = `${SPORTMONKS_URL}/livescores/inplay?include=participants;league;scores;events;statistics;periods;xgfixture&per_page=100`;
  const response = await fetch(url, { headers: { Authorization: token }, cache: "no-store" });
  if (!response.ok) return [] as LiveFixture[];
  const json = await response.json() as { data?: LiveFixture[] };
  return json.data ?? [];
}

export async function GET() {
  if (!process.env.SPORTMONKS_API_TOKEN) {
    return NextResponse.json({ source: "none", live: [], message: "SPORTMONKS_API_TOKEN tanımlı değil." });
  }
  const fixtures = await getLiveFixtures();
  const live = fixtures.map((fixture) => {
    const { home, away } = participants(fixture);
    const analysis = liveProbability(fixture);
    return {
      id: fixture.id,
      league: fixture.league?.name ?? "Lig bilgisi bekleniyor",
      country: fixture.league?.country?.name ?? "",
      date: fixture.starting_at?.slice(0, 10),
      time: fixture.starting_at ? new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.starting_at)) : "—",
      home: home?.name ?? "Ev sahibi",
      away: away?.name ?? "Deplasman",
      ...analysis,
    };
  });
  return NextResponse.json({ source: "sportmonks", updatedAt: new Date().toISOString(), live });
}
