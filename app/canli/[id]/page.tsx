"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Activity, CircleAlert, Clock3, Crosshair, Goal, Radio, Target, Timer } from "lucide-react";
import Link from "next/link";

type Analysis = {
  minute: number;
  score: { home: number; away: number };
  nextGoal: number;
  signal: string;
  stats: { homeShots:number; awayShots:number; homeOn:number; awayOn:number; homeCorners:number; awayCorners:number; homeBig:number; awayBig:number; homePoss:number; awayPoss:number };
  events: { minute:string|number; type:string; player:string; participant:string; info:string }[];
  insight: string;
  home: string;
  away: string;
};

export default function LiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fixture, setFixture] = useState<{league:string;country:string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/live/${id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Veri alınamadı");
        if (!cancelled) { setAnalysis(data.analysis); setFixture(data.fixture); setError(""); setLoading(false); }
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : "Canlı veri alınamadı"); setLoading(false); } }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [id]);

  if (loading) return <main className="detail-shell"><div className="detail-loading"><Radio size={22}/> Canlı analiz yükleniyor…</div></main>;
  if (error || !analysis) return <main className="detail-shell"><div className="detail-error"><CircleAlert size={22}/><div><b>Canlı analiz kullanılamıyor</b><p>{error}</p><Link href="/">← Ana sayfaya dön</Link></div></div></main>;

  return <main className="detail-shell">
    <header className="detail-top"><Link href="/" className="back"><ArrowLeft size={16}/> Ana sayfa</Link><span className="live-pill"><i/> CANLI • 15 SN YENİLENİYOR</span></header>
    <section className="detail-hero">
      <div className="detail-league"><span>{fixture?.country ? `${fixture.country} • ` : ""}{fixture?.league}</span><small><Timer size={13}/> {analysis.minute}'</small></div>
      <div className="detail-teams"><h1>{analysis.home}</h1><div className="detail-score"><b>{analysis.score.home} - {analysis.score.away}</b><span>CANLI</span></div><h1>{analysis.away}</h1></div>
      <p className="detail-insight">{analysis.insight}</p>
    </section>

    <section className="live-ai-panel"><div><span className="eyebrow live-eyebrow"><Radio size={13}/> MAÇ AI CANLI MOTORU</span><h2>Şimdi gol olma ihtimali</h2><p>Bu oran maçın mevcut akışından hesaplanır ve maç ilerledikçe değişir.</p></div><div className="live-prob"><strong>{analysis.nextGoal}%</strong><span>{analysis.signal} gol sinyali</span></div></section>

    <section className="detail-grid">
      <div className="detail-card"><div className="detail-card-title"><Activity size={16}/> CANLI İSTATİSTİKLER</div><Stat label="Şut" home={analysis.stats.homeShots} away={analysis.stats.awayShots} icon={<Crosshair size={14}/>} /><Stat label="İsabetli şut" home={analysis.stats.homeOn} away={analysis.stats.awayOn} icon={<Target size={14}/>} /><Stat label="Korner" home={analysis.stats.homeCorners} away={analysis.stats.awayCorners} icon={<Goal size={14}/>} /><Stat label="Büyük şans" home={analysis.stats.homeBig} away={analysis.stats.awayBig} /><Stat label="Topa sahip olma" home={analysis.stats.homePoss} away={analysis.stats.awayPoss} suffix="%" /></div>
      <div className="detail-card"><div className="detail-card-title"><Clock3 size={16}/> MAÇ AKIŞI</div><div className="timeline">{analysis.events.length ? analysis.events.map((event, i) => <div className="event" key={`${event.minute}-${i}`}><b>{event.minute}'</b><div><strong>{event.type}</strong><span>{event.player || event.participant || event.info || "Maç olayı"}</span></div></div>) : <div className="no-events">Henüz gösterilecek önemli olay yok.</div>}</div></div>
    </section>
    <div className="detail-warning"><CircleAlert size={16}/><span>Canlı gol sinyali istatistiksel model çıktısıdır; bahis veya sonuç garantisi değildir.</span></div>
  </main>;
}

function Stat({label,home,away,icon,suffix=""}:{label:string;home:number;away:number;icon?:React.ReactNode;suffix?:string}) { const total=Math.max(1,home+away); return <div className="stat-row"><span className="stat-label">{icon}{label}</span><b>{home}{suffix}</b><div className="stat-bar"><i style={{width:`${Math.round(home/total*100)}%`}}/></div><b>{away}{suffix}</b></div>; }
