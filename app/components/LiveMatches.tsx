"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, Crosshair, Radio, Target } from "lucide-react";
import Link from "next/link";

type LiveMatch = {
  id: number; league: string; country?: string; home: string; away: string; minute: number; status: string;
  homeScore: number; awayScore: number; nextGoal: number; shots: number; shotsOnTarget: number; corners: number;
  bigChances: number; possession: { home: number; away: number }; signal: string; explanation: string;
};

export default function LiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) { setMatches(Array.isArray(data.live) ? data.live : []); setUpdated(new Date()); }
      } catch { if (!cancelled) setMatches([]); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return <section className="live-section">
    <div className="section-head live-head"><div><span className="eyebrow live-eyebrow"><Radio size={13}/> CANLI MAÇLAR</span><h3>🔴 Şu Anda Oynanan Maçlar</h3></div><div className="live-meta"><span>{matches.length} CANLI</span>{updated && <small>15 sn'de yenilenir</small>}</div></div>
    {loading && <div className="live-empty">Canlı maçlar kontrol ediliyor…</div>}
    {!loading && matches.length === 0 && <div className="live-empty"><Radio size={18}/> Şu anda veri sağlayıcıda canlı maç görünmüyor.</div>}
    <div className="live-grid">{matches.map((match) => <Link href={`/canli/${match.id}`} className="live-card live-card-link" key={match.id}>
      <div className="live-card-top"><span>{match.country ? `${match.country} • ` : ""}{match.league}</span><b><span className="live-dot"/> {match.status}</b></div>
      <div className="live-teams"><div><strong>{match.home}</strong></div><div className="live-score"><b>{match.homeScore} - {match.awayScore}</b><small><Clock3 size={11}/> {match.minute}'</small></div><div><strong>{match.away}</strong></div></div>
      <div className="live-goal"><div><span>Maçın kalanında gol olasılığı</span><strong>{match.nextGoal}%</strong></div><div className="live-signal">{match.signal}</div></div>
      <div className="live-stats"><div><Crosshair size={13}/><span>Şut</span><b>{match.shots}</b></div><div><Target size={13}/><span>İsabetli</span><b>{match.shotsOnTarget}</b></div><div><Activity size={13}/><span>Korner</span><b>{match.corners}</b></div><div><span>Topa sahip</span><b>{match.possession.home}% - {match.possession.away}%</b></div></div>
      <p>{match.explanation}</p><div className="live-open">Canlı analizi aç →</div>
    </Link>)}</div>
  </section>;
}
