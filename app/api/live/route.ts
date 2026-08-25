import { NextResponse } from "next/server";

const API_URL = "https://v3.football.api-sports.io";
type R = Record<string, any>;

async function api(path: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY tanımlı değil");
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${json?.message ?? "istek başarısız"}`);
  return json;
}

function num(v: any) { return typeof v === "number" ? v : Number(v) || 0; }

function mapFixture(f: R) {
  const s = f.score ?? {};
  const teams = f.teams ?? {};
  const goals = s.goals ?? {};
  const status = f.fixture?.status ?? {};
  return {
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
  };
}

async function getStats(id: number) {
  try {
    const json = await api(`/fixtures/statistics?fixture=${id}`);
    const rows = json.response ?? [];
    const find = (team: R, names: string[]) => {
      const item = (team.statistics ?? []).find((x: R) => names.includes(String(x.type).toLowerCase()));
      return num(item?.value);
    };
    const home = rows[0] ?? {}, away = rows[1] ?? {};
    const h = home.statistics ?? [], a = away.statistics ?? [];
    const val = (arr: R[], names: string[]) => num((arr.find(x => names.includes(String(x.type).toLowerCase())))?.value);
    const shots = val(h,["total shots"]) + val(a,["total shots"]);
    const on = val(h,["shots on goal"]) + val(a,["shots on goal"]);
    const corners = val(h,["corner kicks"]) + val(a,["corner kicks"]);
    const hp = val(h,["ball possession"]), ap = val(a,["ball possession"]);
    return { shots, shotsOnTarget: on, corners, possession: { home: hp, away: ap } };
  } catch { return { shots: 0, shotsOnTarget: 0, corners: 0, possession: { home: 0, away: 0 } }; }
}

function signal(s: R, minute: number) {
  const intensity = Math.min(2, 0.2 + s.shots * 0.04 + s.shotsOnTarget * 0.12 + s.corners * 0.02);
  const remaining = Math.max(0, Math.min(60, 90 - minute));
  const probability = Math.max(1, Math.min(99, Math.round((1 - Math.exp(-(intensity * remaining / 45))) * 100)));
  return { nextGoal: probability, signal: probability >= 65 ? "Güçlü gol sinyali" : probability >= 45 ? "Orta gol sinyali" : "Düşük gol sinyali" };
}

export async function GET() {
  try {
    const json = await api("/fixtures?live=all");
    const fixtures = (json.response ?? []) as R[];
    const live = await Promise.all(fixtures.map(async f => {
      const base = mapFixture(f);
      const stats = await getStats(base.id);
      return { ...base, ...stats, ...signal(stats, base.minute) };
    }));
    return NextResponse.json({ source: "api-football", updatedAt: new Date().toISOString(), live, count: live.length });
  } catch (e) {
    return NextResponse.json({ source: "api-football", updatedAt: new Date().toISOString(), live: [], count: 0, message: e instanceof Error ? e.message : "API-Football bağlantı hatası" }, { status: 200 });
  }
}
