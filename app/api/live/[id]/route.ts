import { NextResponse } from "next/server";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";

type AnyRecord = Record<string, any>;

function statValue(stats: AnyRecord[], names: string[], location: string) {
  const wanted = names.map((n) => n.toLowerCase());
  const row = stats.find((item) => {
    if (item.location !== location) return false;
    const text = `${item.type?.name ?? ""} ${item.type?.developer_name ?? ""} ${item.type?.code ?? ""}`.toLowerCase();
    return wanted.some((name) => text.includes(name));
  });
  const value = row?.data?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("%", "")) || 0;
  return 0;
}

function participants(fixture: AnyRecord) {
  const list = fixture.participants ?? [];
  return {
    home: list.find((p: AnyRecord) => p.meta?.location === "home") ?? list[0],
    away: list.find((p: AnyRecord) => p.meta?.location === "away") ?? list[1],
  };
}

function score(fixture: AnyRecord, location: string) {
  const row = (fixture.scores ?? []).find((s: AnyRecord) => s.score?.participant === location && (s.description === "CURRENT" || typeof s.score?.goals === "number"));
  return Number(row?.score?.goals ?? 0);
}

function minute(fixture: AnyRecord) {
  const periods = fixture.periods ?? [];
  const current = periods.find((p: AnyRecord) => p.is_current) ?? periods[periods.length - 1];
  return Math.max(0, Math.min(120, Number(current?.minutes ?? current?.minute ?? 0)));
}

function buildAnalysis(fixture: AnyRecord) {
  const stats = fixture.statistics ?? [];
  const m = minute(fixture);
  const homeShots = statValue(stats, ["shots", "total shots"], "home");
  const awayShots = statValue(stats, ["shots", "total shots"], "away");
  const homeOn = statValue(stats, ["shots on target", "on target"], "home");
  const awayOn = statValue(stats, ["shots on target", "on target"], "away");
  const homeCorners = statValue(stats, ["corners"], "home");
  const awayCorners = statValue(stats, ["corners"], "away");
  const homeBig = statValue(stats, ["big chances"], "home");
  const awayBig = statValue(stats, ["big chances"], "away");
  const homePoss = statValue(stats, ["ball possession", "possession"], "home");
  const awayPoss = statValue(stats, ["ball possession", "possession"], "away");
  const totalShots = homeShots + awayShots;
  const totalOn = homeOn + awayOn;
  const totalCorners = homeCorners + awayCorners;
  const totalBig = homeBig + awayBig;
  const intensity = Math.min(1.9, 0.15 + totalShots * 0.035 + totalOn * 0.11 + totalCorners * 0.018 + totalBig * 0.16 + (Math.abs(homePoss - awayPoss) < 18 ? 0.08 : 0));
  const remaining = Math.max(0, Math.min(60, 90 - Math.min(90, m)));
  const nextGoal = Math.max(1, Math.min(99, Math.round((1 - Math.exp(-(intensity * remaining / 45))) * 100)));
  const home = participants(fixture).home?.name ?? "Ev sahibi";
  const away = participants(fixture).away?.name ?? "Deplasman";
  const events = (fixture.events ?? []).slice(-20).reverse().map((event: AnyRecord) => ({
    minute: event.minute ?? event.minute_extra ?? "—",
    type: event.type?.name ?? event.type?.developer_name ?? "Olay",
    player: event.player?.name ?? event.player_name ?? "",
    participant: event.participant?.name ?? event.team?.name ?? "",
    info: event.info ?? event.result ?? "",
  }));
  const signal = nextGoal >= 65 ? "Güçlü" : nextGoal >= 45 ? "Orta" : "Düşük";
  return {
    minute: Math.floor(m),
    score: { home: score(fixture, "home"), away: score(fixture, "away") },
    nextGoal,
    signal,
    stats: { homeShots, awayShots, homeOn, awayOn, homeCorners, awayCorners, homeBig, awayBig, homePoss: Math.round(homePoss), awayPoss: Math.round(awayPoss) },
    events,
    insight: `${Math.floor(m)}. dakikada canlı tempo ${signal.toLowerCase()} seviyede. Model şut, isabetli şut, korner, büyük şans ve topa sahip olma akışını kalan süreye göre değerlendiriyor. Bu bir istatistiksel sinyaldir, garanti değildir.`,
    home,
    away,
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return NextResponse.json({ error: "SPORTMONKS_API_TOKEN tanımlı değil." }, { status: 503 });
  const { id } = await context.params;
  const response = await fetch(`${SPORTMONKS_URL}/fixtures/${id}?include=participants;league;scores;events;statistics;periods;xgfixture`, { headers: { Authorization: token }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Canlı maç verisi alınamadı." }, { status: response.status });
  const json = await response.json() as { data?: AnyRecord };
  if (!json.data) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  const fixture = json.data;
  const analysis = buildAnalysis(fixture);
  return NextResponse.json({ source: "sportmonks", updatedAt: new Date().toISOString(), fixture: { id: fixture.id, league: fixture.league?.name ?? "Lig", country: fixture.league?.country?.name ?? "", startingAt: fixture.starting_at }, analysis });
}
