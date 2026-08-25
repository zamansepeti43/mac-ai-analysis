import { NextResponse } from "next/server";
import { analyzeMatch } from "@/lib/analysis";

const API_URL = "https://v3.football.api-sports.io";

type ApiResponse<T> = { response?: T[]; errors?: Record<string, string> };

type Fixture = {
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

async function apiFootball<T>(path: string): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];

  const response = await fetch(`${API_URL}${path}`, {
    headers: { "x-apisports-key": key },
    next: { revalidate: 900 },
  });

  if (!response.ok) return [];
  const json = (await response.json()) as ApiResponse<T>;
  return json.response ?? [];
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedDate = searchParams.get("date");
  const date = requestedDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const limit = Math.min(Number(searchParams.get("limit") ?? 8), 12);

  const fixtures = await apiFootball<Fixture>(`/fixtures?date=${date}&timezone=Europe%2FIstanbul`);

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json({
      source: "demo",
      message: "API_FOOTBALL_KEY tanımlı değil. Arayüz demo verisiyle çalışıyor.",
      matches: [],
    });
  }

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
