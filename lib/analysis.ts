export type TeamHistory = {
  goalsFor: number;
  goalsAgainst: number;
  games: number;
};

export type AnalysisInput = {
  home: TeamHistory;
  away: TeamHistory;
};

export type AnalysisResult = {
  goal: number;
  over15: number;
  over25: number;
  btts: number;
  confidence: "Yüksek" | "Orta" | "Düşük";
  expectedGoals: number;
  explanation: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function poissonAtLeast(lambda: number, goals: number) {
  let probability = 0;
  for (let k = 0; k < goals; k += 1) {
    probability += Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  }
  return 1 - probability;
}

function factorial(n: number) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

export function analyzeMatch(input: AnalysisInput): AnalysisResult {
  const homeGF = input.home.games ? input.home.goalsFor / input.home.games : 1;
  const homeGA = input.home.games ? input.home.goalsAgainst / input.home.games : 1;
  const awayGF = input.away.games ? input.away.goalsFor / input.away.games : 1;
  const awayGA = input.away.games ? input.away.goalsAgainst / input.away.games : 1;

  // Lightweight first-generation model. It deliberately favors recent scoring
  // and conceding rates and leaves room for xG, injuries and lineups later.
  const homeLambda = Math.max(0.15, 0.55 * homeGF + 0.45 * awayGA);
  const awayLambda = Math.max(0.15, 0.55 * awayGF + 0.45 * homeGA);
  const expectedGoals = homeLambda + awayLambda;

  const noGoal = Math.exp(-expectedGoals);
  const goal = clamp(Math.round((1 - noGoal) * 100));
  const over15 = clamp(Math.round(poissonAtLeast(expectedGoals, 2) * 100));
  const over25 = clamp(Math.round(poissonAtLeast(expectedGoals, 3) * 100));

  const homeScores = 1 - Math.exp(-homeLambda);
  const awayScores = 1 - Math.exp(-awayLambda);
  const btts = clamp(Math.round(homeScores * awayScores * 100));

  const dataQuality = Math.min(input.home.games, input.away.games);
  const confidence = dataQuality >= 5 && expectedGoals >= 2.2 ? "Yüksek" : dataQuality >= 3 ? "Orta" : "Düşük";

  return {
    goal,
    over15,
    over25,
    btts,
    confidence,
    expectedGoals: Number(expectedGoals.toFixed(2)),
    explanation: `Son dönem gol üretimi ve gol yeme ortalamaları birlikte hesaplandı. Model toplam ${expectedGoals.toFixed(2)} beklenen gol üzerinden olasılık üretiyor.`,
  };
}
