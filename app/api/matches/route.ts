import { NextResponse } from "next/server";
import { analyzeMatch } from "../../../lib/analysis";

const SPORTMONKS_URL = "https://api.sportmonks.com/v3/football";
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";

type SportmonksParticipant = {
  id: number;
  name: string;
  meta?: { location?: "home" | "away" };
};

type SportmonksExpected = {
  location?: "home" | "away";
  data?: { value?: number };
};

type SportmonksFixture = {
  id: number;
  name?: string;
  starting_at: string;
  state_id?: number;
  participants?: SportmonksParticipant[];
  xGFixture?: SportmonksExpected[];
  xgfixture?: SportmonksExpected[];
};

type SportmonksResponse<T> = { data?: T[] };
type ApiResponse<T> = { response?: T[] };

type ApiFootballFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { name: string; country: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

type HistoryFixture = {
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
};

function emptyAnalysis() {
  return {
    goalProbability: 50,
    over15: 50,
    over25: 50,
    bothTeamsScore: 50,
    expectedGoals: 1.5,
    confidence: "Düşük",
  };
}

async function sportmonks<T>(path: string): Promise<T[]> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return [];

  const response = await fetch(`${SPORTMONKS_URL}${path}`, {
    headers: { Authorization: token },
    next: { revalidate: 900 },
  });

  if (!response.ok) return [];
  const json = (await response.json()) as SportmonksResponse<T>;
  return json.data ?? [];
}

async function apiFootball<T>(path: string): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];

  const response = await fetch(`${API_FOOTBALL_URL}${path}`, {
    headers: { "x-apisports-key": key },
    next: { revalidate: 900 },
  });

  if (!response.ok) return [];
  const json = (await response.json()) as ApiResponse<T>;
  return json.response ?? [];
}

function participants(fixture: SportmonksFixture) {
  const list = fixture.participants ?? [];
  const home = list.find((item) => item.meta?.location === "home") ?? list[0];
  const away = list.find((item) => item.meta?.location === "away") ?? list[1];
  return { home, away };
}

function xgValues(fixture: SportmonksFixture) {
  const expected = fixture.xGFixture ?? fixture.xgfixture ?? [];
  const home = expected.find((item) => item.location === "home")?.data?.value;
  const away = expected.find((item) => item.location === "away")?.data?.value;
  return { home, away };
}

function historyStats(fixtures: HistoryFixture[], teamId: number) {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let games = 0;

  for (const match of fixtures) {
    const isHome = match.teams.home.id === teamId;
    const gf = isHome ? match.goals.home : match.goals.away;
    const ga = isHome ? match.goals.away : match.goals.home;
    if (gf === null || ga === null) continue;
    goalsFor += gf;
    goalsAgainst += ga;
    games += 1;
  }

  return { goalsFor, goalsAgainst, games };
}

async function getSportmonksMatches(date: string, limit: number) {
  const fixtures = await sportmonks<SportmonksFixture>(
    `/fixtures/date/${date}?include=participants;xGFixture&per_page=50`
  );

  return fixtures
    .filter((fixture) => fixture.starting_at >= `${date}T00:00:00`)
    .slice(0, limit)
    .map((fixture) => {
      const { home, away } = participants(fixture);
      const xg = xgValues(fixture);
      return {
        id: fixture.id,
        league: "Sportmonks",
        country: "",
        time: new Intl.DateTimeFormat("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        }).format(new Date(fixture.starting_at)),
        home: home?.name ?? "Ev sahibi",
        away: away?.name ?? "Deplasman",
        xgHome: xg.home ?? null,
        xgAway: xg.away ?? null,
        ...emptyAnalysis(),
      };
    });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedDate = searchParams.get("date");
  const date = requestedDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 8), 1), 8);

  if (process.env.SPORTMONKS_API_TOKEN) {
    const matches = await getSportmonksMatches(date, limit);
    return NextResponse.json({
      source: "sportmonks",
      date,
      matches,
      note: "xGFixture maç sonrası xG verisidir; pre-match olasılıkları ayrı model hesaplayacaktır.",
    });
  }

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json({
      source: "demo",
      message: "SPORTMONKS_API_TOKEN tanımlı değil. Arayüz demo verisiyle çalışıyor.",
      matches: [],
    });
  }

  const fixtures = await apiFootball<ApiFootballFixture>(`/fixtures?date=${date}&timezone=Europe%2FIstanbul`);
  const upcoming = fixtures
    .filter((item) => ["NS", "TBD"].includes(item.fixture.status.short))
    .slice(0, limit);

  const matches = await Promise.all(
    upcoming.map(async (fixture) => {
      const [homeHistory, awayHistory] = await Promise.all([
        apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.home.id}&last=5`),
        apiFootball<HistoryFixture>(`/fixtures?team=${fixture.teams.away.id}&last=5`),
      ]);

      const analysis = analyzeMatch({
        home: historyStats(homeHistory, fixture.teams.home.id),
        away: historyStats(awayHistory, fixture.teams.away.id),
      });

      return {
        id: fixture.fixture.id,
        league: fixture.league.name,
        country: fixture.league.country,
        time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(fixture.fixture.date)),
        home: fixture.teams.home.name,
        away: fixture.teams.away.name,
        ...analysis,
      };
    })
  );

  return NextResponse.json({ source: "api-football", date, matches });
}
