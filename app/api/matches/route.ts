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
function toTurkeyDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date); }
function todayTurkey() { return toTurkeyDate(new Date()); }
function addDays(dateString: string, days: number) { const [y, m, d] = dateString.split("-").map(Number); const date = new Date(Date.UTC(y, m - 1, d + days)); return toTurkeyDate(date); }

function mapSportmonksFixture(fixture: SportmonksFixture) {
  const { home, away } = participants(fixture); const xg = xgValues(fixture); const xgModel = preMatchFromXg(xg.home, xg.away);
  return { id: fixture.id, league: fixture.league?.name ?? "Lig bilgisi bekleniyor", country: fixture.league?.country?.name ?? "", date: fixture.starting_at.slice(0, 10), time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.starting_at)), home: home?.name ?? "Ev sahibi", away: away?.name ?? "Deplasman", xgHome: xg.home ?? null, xgAway: xg.away ?? null, ...(xgModel ?? { goal: 50, over15: 50, over25: 50, btts: 50, expectedGoals: 1.5, confidence: "Düşük" }) };
}

async function getSportmonksMatches(from: string, to: string, limit: number) {
  const fixtures = from === to
    ? await sportmonks<SportmonksFixture>(`/fixtures/date/${from}?include=participants;league;xGFixture&per_page=50`)
    : await sportmonks<SportmonksFixture>(`/fixtures/between/${from}/${to}?include=participants;league;xGFixture&per_page=100`);
  const now = Date.now();
  return fixtures
    .filter((fixture) => new Date(fixture.starting_at).getTime() >= now - 30 * 60 * 1000)
    .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime())
    .slice(0, limit)
    .map(mapSportmonksFixture);
}

async function getApiFootballMatches(from: string, to: string, limit: number) {
  const dates: string[] = [];
  let current = from;
  while (current <= to) { dates.push(current); current = addDays(current, 1); }
  const results = await Promise.all(dates.map((date) => apiFootball<ApiFootballFixture>(`/fixtures?date=${date}&timezone=Europe%2FIstanbul`)));
  const fixtures = results.flat().filter((item) => ["NS", "TBD"].includes(item.fixture.status.short)).slice(0, limit);
  return Promise.all(fixtures.map(async (fixture) => {
    const [homeHistory, awayHistory] = await Promise.all([apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.home.id}&last=5`), apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.away.id}&last=5`)]);
    const analysis = analyzeMatch({ home: historyStats(homeHistory, fixture.teams.home.id), away: historyStats(awayHistory, fixture.teams.away.id) });
    return { id: fixture.fixture.id, league: fixture.league.name, country: fixture.league.country, date: fixture.fixture.date.slice(0, 10), time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.fixture.date)), home: fixture.teams.home.name, away: fixture.teams.away.name, ...analysis };
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const today = todayTurkey();
  const requestedDate = searchParams.get("date");
  const range = searchParams.get("range") ?? "today";
  const from = requestedDate ?? today;
  const to = range === "week" ? addDays(from, 6) : from;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100);

  if (process.env.SPORTMONKS_API_TOKEN) {
    const matches = await getSportmonksMatches(from, to, limit);
    return NextResponse.json({ source: "sportmonks", range, from, to, matches, note: "Bugün yalnızca bugünün fixture'larını; hafta görünümü ise seçilen günden sonraki 7 günü gösterir." });
  }
  if (!process.env.API_FOOTBALL_KEY) return NextResponse.json({ source: "none", range, from, to, matches: [], message: "Veri sağlayıcı anahtarı tanımlı değil." });
  const matches = await getApiFootballMatches(from, to, limit);
  return NextResponse.json({ source: "api-football", range, from, to, matches });
}
