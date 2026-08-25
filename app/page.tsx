"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, CircleHelp, Gauge, Goal, Search, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";

type Match = { id?: number; league: string; country?: string; date?: string; time: string; home: string; away: string; homeForm: string; awayForm: string; goal: number; over15: number; over25: number; btts: number; confidence: "Yüksek" | "Orta" | "Düşük"; expectedGoals?: number; explanation?: string };

const navItems = ["Genel Bakış", "Gol Sinyalleri", "Bugünün Maçları", "Ligler"];

function formatDate(value?: string) {
  if (!value) return "Tarih bekleniyor";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(date);
}

function MatchCard({ match, selected, onSelect }: { match: Match; selected: boolean; onSelect: () => void }) {
  return <button className={`match-card ${selected ? "selected" : ""}`} onClick={onSelect}>
    <div className="card-top"><span>{match.country ? `${match.country} • ` : ""}{match.league}</span><span className="match-datetime"><CalendarDays size={13}/>{formatDate(match.date)}</span><span className="match-datetime"><Clock3 size={13}/>{match.time}</span></div>
    <div className="teams"><div><b>{match.home}</b><small>Form {match.homeForm}</small></div><span>VS</span><div><b>{match.away}</b><small>Form {match.awayForm}</small></div></div>
    <div className="prob"><div><span>Gol</span><strong>{match.goal}%</strong></div><div><span>1.5 Üst</span><strong>{match.over15}%</strong></div><div><span>2.5 Üst</span><strong>{match.over25}%</strong></div><div><span>KG</span><strong>{match.btts}%</strong></div></div>
    <div className="bar"><i style={{ width: `${match.goal}%` }} /></div>
  </button>;
}

export default function Home() {
  const [active, setActive] = useState("Genel Bakış");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("Canlı veri bekleniyor");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/matches?limit=10")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const liveMatches = Array.isArray(data.matches) ? data.matches.map((match: Partial<Match>) => ({ ...match, homeForm: match.homeForm ?? "—", awayForm: match.awayForm ?? "—" })) as Match[] : [];
        setMatches(liveMatches);
        setSelected(liveMatches[0] ?? null);
        setSource(liveMatches.length ? (data.source === "sportmonks" ? "Sportmonks canlı veri" : "API-Football canlı veri") : "Bugün için maç verisi bulunamadı");
      })
      .catch(() => setSource("Canlı veri bağlantısı kurulamadı"))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => matches.filter((m) => `${m.home} ${m.away} ${m.league} ${m.country ?? ""}`.toLowerCase().includes(query.toLowerCase())), [matches, query]);
  const top10 = useMemo(() => [...filtered].sort((a, b) => b.goal - a.goal).slice(0, 10), [filtered]);
  const leagueGroups = useMemo(() => {
    const groups = new Map<string, Match[]>();
    [...filtered].sort((a, b) => a.time.localeCompare(b.time)).forEach((match) => {
      const key = match.league || "Lig bilgisi bekleniyor";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(match);
    });
    return [...groups.entries()];
  }, [filtered]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><strong>Maç AI</strong><span>Football Intelligence</span></div></div>
      <div className="nav-label">MENÜ</div>
      <nav>{navItems.map((item, i) => { const Icon = [Gauge, Goal, CalendarDays, Trophy][i]; return <button key={item} className={active === item ? "nav active" : "nav"} onClick={() => setActive(item)}><span><Icon size={18} /></span>{item}</button>; })}</nav>
      <div className="sidebar-card"><Sparkles size={18}/><div><b>Maç AI Motoru</b><p>Gerçek fixture, tarih, saat, lig ve gol verileriyle analiz hazırlanıyor.</p></div></div>
      <div className="sidebar-footer"><ShieldCheck size={15}/> İstatistiksel analiz • Garanti değildir</div>
    </aside>

    <section className="content">
      <header className="topbar"><div><div className="eyebrow">MAÇ AI • BUGÜN</div><h1>{active}</h1></div><div className="search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Maç veya takım ara..." /></div></header>
      <section className="hero"><div><div className="hero-kicker"><Zap size={16}/> BUGÜNÜN GOL SİNYALLERİ</div><h2>Önce en güçlü 10 maç,<br/>sonra liglere göre liste.</h2><p>Maçlar gerçek tarih ve başlama saatleriyle gösterilir. Maç AI, maçları gol olasılığına göre sıralar ve her ligi ayrı bölümde sunar.</p></div><div className="hero-stat"><span>En yüksek gol olasılığı</span><strong>{top10[0]?.goal ?? 0}%</strong><small>{loading ? "Veriler yükleniyor…" : source}</small></div></section>

      <section className="match-section">
        <div className="section-head"><div><span className="eyebrow">MAÇ AI SIRALAMASI</span><h3>🔥 Top 10 Maç</h3></div><span className="eyebrow">{top10.length} MAÇ</span></div>
        <div className="cards">{top10.map((match) => <MatchCard key={`top-${match.id ?? `${match.home}-${match.away}`}`} match={match} selected={selected?.id === match.id} onSelect={() => setSelected(match)} />)}</div>
      </section>

      <section className="league-list">
        <div className="section-head"><div><span className="eyebrow">GERÇEK FİKSTÜR</span><h3>Liglere Göre Maçlar</h3></div><span className="eyebrow">{filtered.length} MAÇ</span></div>
        {leagueGroups.length === 0 && !loading ? <div className="empty-state">Bugün için gösterilecek gerçek maç bulunamadı.</div> : leagueGroups.map(([league, leagueMatches]) => <section className="league-group" key={league}>
          <div className="league-heading"><div><span className="league-country">{leagueMatches[0]?.country || ""}</span><h4>{league}</h4></div><span>{leagueMatches.length} maç</span></div>
          <div className="cards">{leagueMatches.map((match) => <MatchCard key={`league-${match.id ?? `${match.home}-${match.away}`}`} match={match} selected={selected?.id === match.id} onSelect={() => setSelected(match)} />)}</div>
        </section>)}
      </section>

      {selected && <section className="analysis">
        <div className="analysis-head"><div><span className="eyebrow">DETAYLI ANALİZ</span><h3>{selected.home} <em>vs</em> {selected.away}</h3><div className="analysis-datetime"><CalendarDays size={15}/> {formatDate(selected.date)} <span>•</span> <Clock3 size={15}/> {selected.time} <span>•</span> {selected.league}</div><p>{source}</p></div><div className="score"><span>GOL SKORU</span><b>{selected.goal}</b><small>/ 100</small></div></div>
        <div className="metrics"><Metric label="En az 1 gol" value={selected.goal} /><Metric label="1.5 Üst" value={selected.over15} /><Metric label="2.5 Üst" value={selected.over25} /><Metric label="KG Var" value={selected.btts} /></div>
        <div className="reason"><CircleHelp size={18}/><div><b>Maç AI neden bu maçı öne çıkarıyor?</b><p>{selected.explanation ?? "Model; gol üretimi, gol yeme ve geçmiş xG verilerini birleştirerek bu maç için olasılık skorları oluşturuyor."} {selected.expectedGoals ? `Beklenen toplam gol: ${selected.expectedGoals}.` : ""}</p></div></div>
      </section>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><div className="metric-ring" style={{ "--p": `${value * 3.6}deg` } as React.CSSProperties}><b>{value}%</b></div><span>{label}</span></div>; }
