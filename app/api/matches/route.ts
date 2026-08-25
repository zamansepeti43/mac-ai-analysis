import { NextResponse } from "next/server";
import { analyzeMatch } from "../../../lib/analysis";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";

type SportmonksParticipant = { id: number; name: string; meta?: { location?: "home" | "away" } };
type SportmonksExpected = { location?: "home" | "away"; data?: { value?: number } };
type SportmonksLeague = { id?: number; name?: string; country?: { name?: string } };
type SportmonksFixture = { id: number; name?: string; starting_at: string; participants?: SportmonksParticipant[]; league?: SportmonksLeague; xGFixture?: SportmonksExpected[]; xgfixture?: SportmonksExpected[] };
type SportmonksResponse<T> = { data?: T[] };
type ApiResponse<T> = { response?: T[] };
type ApiFootballFixture = { fixture: { id: number; date: string; status: { short: string } }; league: { name: string; country: string }; teams: { home: { id: number; name: string }; away: { id: number; name: string } } };
type HistoryFixture = { teams: { home: { id: number }; away: { id: number } }; goals: { home: number | null; away: number | null } };

async function sportmonks<T>(path: string): Promise<T[]> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return [];
  const response = await fetch(`${SPORTMONKS_URL}${path}`, { headers: { Authorization: token }, next: { revalidate: 900 } });
  if (!response.ok) return [];
  const json = (await response.json()) as SportmonksResponse<T>;
  return json.data ?? [];
}
async function apiFootball<T>(path: string): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];
  const response = await fetch(`${API_FOOTBALL_URL}${path}`, { headers: { "x-apisports-key": key }, next: { revalidate: 900 } });
  if (!response.ok) return [];
  const json = (await response.json()) as ApiResponse<T>;
  return json.response ?? [];
}
function participants(fixture: SportmonksFixture) { const list = fixture.participants ?? []; return { home: list.find((item) => item.meta?.location === "home") ?? list[0], away: list.find((item) => item.meta?.location === "away") ?? list[1] }; }
function xgValues(fixture: SportmonksFixture) { const expected = fixture.xGFixture ?? fixture.xgfixture ?? []; return { home: expected.find((item) => item.location === "home")?.data?.value, away: expected.find((item) => item.location === "away")?.data?.value }; }
function historyStats(fixtures: HistoryFixture[], teamId: number) { let goalsFor = 0, goalsAgainst = 0, games = 0; for (const match of fixtures) { const isHome = match.teams.home.id === teamId; const gf = isHome ? match.goals.home : match.goals.away; const ga = isHome ? match.goals.away : match.goals.home; if (gf === null || ga === null) continue; goalsFor += gf; goalsAgainst += ga; games += 1; } return { goalsFor, goalsAgainst, games }; }
function poissonAtLeastOne(lambda: number) { return 1 - Math.exp(-Math.max(lambda, 0)); }
function preMatchFromXg(homeXg: number | null | undefined, awayXg: number | null | undefined) { if (homeXg == null || awayXg == null) return null; const total = homeXg + awayXg; const over15 = 1 - Math.exp(-total) * (1 + total); const over25 = 1 - Math.exp(-total) * (1 + total + total ** 2 / 2); return { goal: Math.round(poissonAtLeastOne(total) * 100), over15: Math.round(over15 * 100), over25: Math.round(over25 * 100), btts: Math.round(poissonAtLeastOne(homeXg) * poissonAtLeastOne(awayXg) * 100), expectedGoals: Number(total.toFixed(2)), confidence: total >= 2.7 ? "Yüksek" : total >= 2.0 ? "Orta" : "Düşük" }; }

async function getSportmonksMatches(date: string, limit: number) {
  const fixtures = await sportmonks<SportmonksFixture>(`/fixtures/date/${date}?include=participants;league;xGFixture&per_page=50`);
  const now = Date.now();
  return fixtures
    .filter((fixture) => new Date(fixture.starting_at).getTime() >= now - 30 * 60 * 1000)
    .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime())
    .slice(0, limit)
    .map((fixture) => {
      const { home, away } = participants(fixture); const xg = xgValues(fixture); const xgModel = preMatchFromXg(xg.home, xg.away);
      return { id: fixture.id, league: fixture.league?.name ?? "Lig bilgisi bekleniyor", country: fixture.league?.country?.name ?? "", date: fixture.starting_at.slice(0, 10), time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.starting_at)), home: home?.name ?? "Ev sahibi", away: away?.name ?? "Deplasman", xgHome: xg.home ?? null, xgAway: xg.away ?? null, ...(xgModel ?? { goal: 50, over15: 50, over25: 50, btts: 50, expectedGoals: 1.5, confidence: "Düşük" }) };
    });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedDate = searchParams.get("date");
  const date = requestedDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 10);
  if (process.env.SPORTMONKS_API_TOKEN) { const matches = await getSportmonksMatches(date, limit); return NextResponse.json({ source: "sportmonks", date, matches, note: "Gerçek fixture tarihi ve saati kullanılır; xGFixture gerçekleşmiş xG verisidir." }); }
  if (!process.env.API_FOOTBALL_KEY) return NextResponse.json({ source: "demo", message: "SPORTMONKS_API_TOKEN tanımlı değil.", matches: [] });
  const fixtures = await apiFootball<ApiFootballFixture>(`/fixtures?date=${date}&timezone=Europe%2FIstanbul`); const upcoming = fixtures.filter((item) => ["NS", "TBD"].includes(item.fixture.status.short)).slice(0, limit);
  const matches = await Promise.all(upcoming.map(async (fixture) => { const [homeHistory, awayHistory] = await Promise.all([apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.home.id}&last=5`), apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.away.id}&last=5`)]); const analysis = analyzeMatch({ home: historyStats(homeHistory, fixture.teams.home.id), away: historyStats(awayHistory, fixture.teams.away.id) }); return { id: fixture.fixture.id, league: fixture.league.name, country: fixture.league.country, date: fixture.fixture.date.slice(0, 10), time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.fixture.date)), home: fixture.teams.home.name, away: fixture.teams.away.name, ...analysis }; }));
  return NextResponse.json({ source: "api-football", date, matches });
}
