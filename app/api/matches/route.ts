import { NextResponse } from "next/server";
import { analyzeMatch } from "../../../lib/analysis";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const ESPN_LEAGUES = [
  ["eng.1", "İngiltere", "Premier League"],
  ["tur.1", "Türkiye", "Süper Lig"],
  ["esp.1", "İspanya", "La Liga"],
  ["ita.1", "İtalya", "Serie A"],
  ["ger.1", "Almanya", "Bundesliga"],
  ["fra.1", "Fransa", "Ligue 1"],
  ["ned.1", "Hollanda", "Eredivisie"],
  ["por.1", "Portekiz", "Primeira Liga"],
  ["sco.1", "İskoçya", "Premiership"],
  ["usa.1", "ABD", "MLS"],
  ["bel.1", "Belçika", "Pro League"],
  ["aut.1", "Avusturya", "Bundesliga"],
  ["sui.1", "İsviçre", "Super League"],
  ["gre.1", "Yunanistan", "Super League"],
  ["den.1", "Danimarka", "Superliga"],
  ["nor.1", "Norveç", "Eliteserien"],
  ["swe.1", "İsveç", "Allsvenskan"],
  ["bra.1", "Brezilya", "Serie A"],
  ["arg.1", "Arjantin", "Liga Profesional"],
  ["mex.1", "Meksika", "Liga MX"],
  ["jpn.1", "Japonya", "J1 League"],
  ["kor.1", "Güney Kore", "K League 1"],
  ["aus.1", "Avustralya", "A-League"],
  ["uefa.champions", "Avrupa", "UEFA Şampiyonlar Ligi"],
  ["uefa.europa", "Avrupa", "UEFA Avrupa Ligi"],
  ["uefa.europa.conf", "Avrupa", "UEFA Konferans Ligi"],
] as const;

type SportmonksParticipant = { id: number; name: string; meta?: { location?: "home" | "away" } };
type SportmonksExpected = { location?: "home" | "away"; data?: { value?: number } };
type SportmonksLeague = { id?: number; name?: string; country?: { name?: string } };
type SportmonksFixture = { id: number; name?: string; starting_at: string; participants?: SportmonksParticipant[]; league?: SportmonksLeague; xGFixture?: SportmonksExpected[]; xgfixture?: SportmonksExpected[] };
type SportmonksResponse<T> = { data?: T[]; message?: string; error?: string };
type ApiResponse<T> = { response?: T[]; errors?: Record<string, unknown> };
type ApiFootballFixture = { fixture: { id: number; date: string; status: { short: string } }; league: { name: string; country: string }; teams: { home: { id: number; name: string }; away: { id: number; name: string } } };
type HistoryFixture = { teams: { home: { id: number }; away: { id: number } }; goals: { home: number | null; away: number | null } };
type EspnEvent = { id: string; date: string; name?: string; competitions?: Array<{ competitors?: Array<{ id?: string; homeAway?: "home" | "away"; team?: { displayName?: string; name?: string } }>; status?: { type?: { state?: string; shortDetail?: string } } }> };
type EspnResponse = { events?: EspnEvent[] };

async function sportmonksRequest<T>(path: string, withXg: boolean): Promise<{ data: T[]; error?: string }> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return { data: [], error: "SPORTMONKS_API_TOKEN tanımlı değil" };
  const include = withXg ? "participants;league;xGFixture" : "participants;league";
  try {
    const response = await fetch(`${SPORTMONKS_URL}${path}&include=${include}`, { headers: { Authorization: token }, next: { revalidate: 60 } });
    const json = (await response.json().catch(() => ({}))) as SportmonksResponse<T>;
    if (!response.ok) return { data: [], error: `Sportmonks ${response.status}: ${json.message ?? json.error ?? "istek başarısız"}` };
    return { data: json.data ?? [], error: json.data?.length ? undefined : "Sportmonks boş fixture döndürdü" };
  } catch (error) { return { data: [], error: error instanceof Error ? error.message : "Sportmonks bağlantı hatası" }; }
}

async function sportmonks<T>(path: string) { const rich = await sportmonksRequest<T>(path, true); if (rich.data.length) return rich; const basic = await sportmonksRequest<T>(path, false); return basic.data.length ? basic : { data: [], error: basic.error ?? rich.error }; }

async function apiFootball<T>(path: string): Promise<{ data: T[]; error?: string }> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { data: [], error: "API_FOOTBALL_KEY tanımlı değil" };
  try { const response = await fetch(`${API_FOOTBALL_URL}${path}`, { headers: { "x-apisports-key": key }, next: { revalidate: 60 } }); const json = (await response.json().catch(() => ({}))) as ApiResponse<T>; if (!response.ok) return { data: [], error: `API-Football ${response.status}` }; return { data: json.response ?? [], error: (json.response?.length ?? 0) ? undefined : "API-Football boş sonuç döndürdü" }; } catch (error) { return { data: [], error: error instanceof Error ? error.message : "API-Football bağlantı hatası" }; }
}

async function espnScoreboard(league: string, date: string): Promise<{ data: EspnEvent[]; error?: string }> {
  try {
    // ESPN dates parametresi YYYYMMDD bekler.
    const espnDate = date.replaceAll("-", "");
    const response = await fetch(`${ESPN_URL}/${league}/scoreboard?dates=${espnDate}`, { next: { revalidate: 30 } });
    if (!response.ok) return { data: [], error: `ESPN ${response.status}` };
    const json = (await response.json().catch(() => ({}))) as EspnResponse;
    return { data: json.events ?? [] };
  } catch (error) { return { data: [], error: error instanceof Error ? error.message : "ESPN bağlantı hatası" }; }
}

function participants(fixture: SportmonksFixture) { const list = fixture.participants ?? []; return { home: list.find((item) => item.meta?.location === "home") ?? list[0], away: list.find((item) => item.meta?.location === "away") ?? list[1] }; }
function xgValues(fixture: SportmonksFixture) { const expected = fixture.xGFixture ?? fixture.xgfixture ?? []; return { home: expected.find((item) => item.location === "home")?.data?.value, away: expected.find((item) => item.location === "away")?.data?.value }; }
function historyStats(fixtures: HistoryFixture[], teamId: number) { let goalsFor = 0, goalsAgainst = 0, games = 0; for (const match of fixtures) { const isHome = match.teams.home.id === teamId; const gf = isHome ? match.goals.home : match.goals.away; const ga = isHome ? match.goals.away : match.goals.home; if (gf === null || ga === null) continue; goalsFor += gf; goalsAgainst += ga; games += 1; } return { goalsFor, goalsAgainst, games }; }
function poissonAtLeastOne(lambda: number) { return 1 - Math.exp(-Math.max(lambda, 0)); }
function preMatchFromXg(homeXg: number | null | undefined, awayXg: number | null | undefined) { if (homeXg == null || awayXg == null) return null; const total = homeXg + awayXg; const over15 = 1 - Math.exp(-total) * (1 + total); const over25 = 1 - Math.exp(-total) * (1 + total + total ** 2 / 2); return { goal: Math.round(poissonAtLeastOne(total) * 100), over15: Math.round(over15 * 100), over25: Math.round(over25 * 100), btts: Math.round(poissonAtLeastOne(homeXg) * poissonAtLeastOne(awayXg) * 100), expectedGoals: Number(total.toFixed(2)), confidence: total >= 2.7 ? "Yüksek" : total >= 2.0 ? "Orta" : "Düşük" }; }
function toTurkeyDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date); }
function todayTurkey() { return toTurkeyDate(new Date()); }
function addDays(dateString: string, days: number) { const [y, m, d] = dateString.split("-").map(Number); return toTurkeyDate(new Date(Date.UTC(y, m - 1, d + days))); }
function turkeyTime(iso: string) { return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso)); }

function mapSportmonksFixture(fixture: SportmonksFixture) { const { home, away } = participants(fixture); const xg = xgValues(fixture); const xgModel = preMatchFromXg(xg.home, xg.away); return { id: fixture.id, league: fixture.league?.name ?? "Lig bilgisi bekleniyor", country: fixture.league?.country?.name ?? "", date: fixture.starting_at.slice(0, 10), time: turkeyTime(fixture.starting_at), home: home?.name ?? "Ev sahibi", away: away?.name ?? "Deplasman", xgHome: xg.home ?? null, xgAway: xg.away ?? null, ...(xgModel ?? { goal: 50, over15: 50, over25: 50, btts: 50, expectedGoals: undefined, confidence: "Düşük" }) }; }

async function getSportmonksMatches(from: string, to: string, limit: number) { const path = from === to ? `/fixtures/date/${from}?per_page=100` : `/fixtures/between/${from}/${to}?per_page=100`; const result = await sportmonks<SportmonksFixture>(path); const now = Date.now(); const matches = result.data.filter((fixture) => new Date(fixture.starting_at).getTime() >= now - 30 * 60 * 1000).sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime()).slice(0, limit).map(mapSportmonksFixture); return { matches, error: result.error }; }

async function getApiFootballMatches(from: string, to: string, limit: number) { const dates: string[] = []; let current = from; while (current <= to) { dates.push(current); current = addDays(current, 1); } const results = await Promise.all(dates.map((date) => apiFootball<ApiFootballFixture>(`/fixtures?date=${date}&timezone=Europe%2FIstanbul`))); const rawFixtures = results.flatMap((result) => result.data); const fixtures = rawFixtures.filter((item) => ["NS", "TBD"].includes(item.fixture.status.short)).slice(0, limit); const matches = await Promise.all(fixtures.map(async (fixture) => { const [homeHistory, awayHistory] = await Promise.all([apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.home.id}&last=5`), apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.away.id}&last=5`)]); const analysis = analyzeMatch({ home: historyStats(homeHistory.data, fixture.teams.home.id), away: historyStats(awayHistory.data, fixture.teams.away.id) }); return { id: fixture.fixture.id, league: fixture.league.name, country: fixture.league.country, date: fixture.fixture.date.slice(0, 10), time: turkeyTime(fixture.fixture.date), home: fixture.teams.home.name, away: fixture.teams.away.name, ...analysis }; })); return { matches, error: results.find((result) => result.error)?.error }; }

async function getEspnMatches(from: string, to: string, limit: number) {
  const dates: string[] = []; let current = from; while (current <= to) { dates.push(current); current = addDays(current, 1); }
  const responses = await Promise.all(dates.flatMap((date) => ESPN_LEAGUES.map(async ([code, country, league]) => ({ date, country, league, result: await espnScoreboard(code, date) }))));
  const matches = responses.flatMap(({ date, country, league, result }) => result.data.map((event) => {
    const competition = event.competitions?.[0]; const competitors = competition?.competitors ?? []; const home = competitors.find((item) => item.homeAway === "home")?.team?.displayName ?? competitors[0]?.team?.displayName; const away = competitors.find((item) => item.homeAway === "away")?.team?.displayName ?? competitors[1]?.team?.displayName; const state = competition?.status?.type?.state; return { id: `espn-${event.id}`, league, country, date, time: turkeyTime(event.date), home: home ?? "Ev sahibi", away: away ?? "Deplasman", source: "espn", status: state ?? "pre", goal: 50, over15: 50, over25: 50, btts: 50, confidence: "Düşük" as const };
  })).filter((match) => match.home && match.away).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return { matches: matches.slice(0, limit), error: responses.find((item) => item.result.error)?.result.error };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url); const today = todayTurkey(); const requestedDate = searchParams.get("date"); const range = searchParams.get("range") ?? "today"; const from = requestedDate ?? today; const to = range === "week" ? addDays(from, 6) : from; const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100); const providerErrors: string[] = [];
  if (process.env.SPORTMONKS_API_TOKEN) { const result = await getSportmonksMatches(from, to, limit); if (result.matches.length) return NextResponse.json({ source: "sportmonks", range, from, to, matches: result.matches }); if (result.error) providerErrors.push(result.error); } else providerErrors.push("SPORTMONKS_API_TOKEN tanımlı değil");
  if (process.env.API_FOOTBALL_KEY) { const result = await getApiFootballMatches(from, to, limit); if (result.matches.length) return NextResponse.json({ source: "api-football", range, from, to, matches: result.matches, fallback: true }); if (result.error) providerErrors.push(result.error); } else providerErrors.push("API_FOOTBALL_KEY tanımlı değil");
  const espnResult = await getEspnMatches(from, to, limit); if (espnResult.matches.length) return NextResponse.json({ source: "espn", range, from, to, matches: espnResult.matches, fallback: true }); if (espnResult.error) providerErrors.push(espnResult.error);
  return NextResponse.json({ source: "none", range, from, to, matches: [], message: "Veri sağlayıcılardan maç alınamadı.", diagnostics: process.env.NODE_ENV === "production" ? undefined : providerErrors });
}
