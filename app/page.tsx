"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, CircleHelp, Gauge, Goal, Search, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";

type Match = { id?: number; league: string; country?: string; date?: string; time: string; home: string; away: string; homeForm: string; awayForm: string; goal: number; over15: number; over25: number; btts: number; confidence: "Yüksek" | "Orta" | "Düşük"; expectedGoals?: number; explanation?: string };

const demoMatches: Match[] = [
  { league: "Premier League", date: "2026-08-25", time: "20:00", home: "Liverpool", away: "Brighton", homeForm: "WWDWW", awayForm: "WDLWL", goal: 91, over15: 86, over25: 73, btts: 69, confidence: "Yüksek", expectedGoals: 2.7 },
  { league: "La Liga", date: "2026-08-25", time: "22:00", home: "Barcelona", away: "Villarreal", homeForm: "WWWWW", awayForm: "DWWDL", goal: 88, over15: 84, over25: 71, btts: 66, confidence: "Yüksek", expectedGoals: 2.5 },
  { league: "Serie A", date: "2026-08-25", time: "21:45", home: "Inter", away: "Atalanta", homeForm: "WWDWW", awayForm: "WDWWW", goal: 86, over15: 81, over25: 68, btts: 72, confidence: "Yüksek", expectedGoals: 2.4 },
  { league: "Süper Lig", date: "2026-08-25", time: "20:00", home: "Galatasaray", away: "Trabzonspor", homeForm: "WWWWD", awayForm: "WDLWD", goal: 84, over15: 78, over25: 65, btts: 63, confidence: "Orta", expectedGoals: 2.2 },
];

const navItems = ["Genel Bakış", "Gol Sinyalleri", "Bugünün Maçları", "Ligler"];

function formatDate(value?: string) {
  if (!value) return "Tarih bekleniyor";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(date);
}

export default function Home() {
  const [active, setActive] = useState("Genel Bakış");
  const [matches, setMatches] = useState<Match[]>(demoMatches);
  const [selected, setSelected] = useState<Match>(demoMatches[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("Demo veri");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/matches?limit=8")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.matches) && data.matches.length > 0) {
          const liveMatches = data.matches.map((match: Partial<Match>) => ({ ...match, homeForm: match.homeForm ?? "—", awayForm: match.awayForm ?? "—" })) as Match[];
          setMatches(liveMatches); setSelected(liveMatches[0]);
          setSource(data.source === "sportmonks" ? "Sportmonks canlı veri" : "API-Football verisi");
        } else setSource("Demo veri • API anahtarı bekleniyor");
      })
      .catch(() => setSource("Demo veri • bağlantı bekleniyor"))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => matches.filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(query.toLowerCase())), [matches, query]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>Maç AI</strong><span>Football Intelligence</span></div></div>
        <div className="nav-label">MENÜ</div>
        <nav>{navItems.map((item, i) => { const Icon = [Gauge, Goal, CalendarDays, Trophy][i]; return <button key={item} className={active === item ? "nav active" : "nav"} onClick={() => setActive(item)}><span><Icon size={18} /></span>{item}</button>; })}</nav>
        <div className="sidebar-card"><Sparkles size={18}/><div><b>Maç AI Motoru</b><p>Geçmiş gol ve xG verileriyle olasılık skoru hesaplanıyor.</p></div></div>
        <div className="sidebar-footer"><ShieldCheck size={15}/> İstatistiksel analiz • Garanti değildir</div>
      </aside>
      <section className="content">
        <header className="topbar"><div><div className="eyebrow">MAÇ AI • BUGÜN</div><h1>{active}</h1></div><div className="search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Maç veya takım ara..." /></div></header>
        <section className="hero"><div><div className="hero-kicker"><Zap size={16}/> BUGÜNÜN GOL SİNYALLERİ</div><h2>Gol ihtimali en yüksek<br/>maçları keşfet.</h2><p>Maç AI; maç tarihi, başlama saati, form ve gol/xG verilerini istatistiksel modelle birleştirerek olasılık skorları üretir.</p></div><div className="hero-stat"><span>En yüksek gol olasılığı</span><strong>{filtered[0]?.goal ?? 0}%</strong><small>{loading ? "Veriler yükleniyor…" : source}</small></div></section>
        <div className="section-head"><div><span className="eyebrow">MAÇ LİSTESİ</span><h3>Öne Çıkan Maçlar</h3></div><span className="eyebrow">{loading ? "YÜKLENİYOR" : `${filtered.length} MAÇ`}</span></div>
        <div className="cards">
          {filtered.map((m) => <button className={`match-card ${selected.home === m.home && selected.away === m.away ? "selected" : ""}`} key={`${m.home}-${m.away}-${m.id ?? m.time}`} onClick={() => setSelected(m)}>
            <div className="card-top"><span>{m.league}{m.country ? ` • ${m.country}` : ""}</span><span className="match-datetime"><CalendarDays size={13}/>{formatDate(m.date)}</span><span className="match-datetime"><Clock3 size={13}/>{m.time}</span></div>
            <div className="teams"><div><b>{m.home}</b><small>Form {m.homeForm}</small></div><span>VS</span><div><b>{m.away}</b><small>Form {m.awayForm}</small></div></div>
            <div className="prob"><div><span>Gol</span><strong>{m.goal}%</strong></div><div><span>1.5 Üst</span><strong>{m.over15}%</strong></div><div><span>2.5 Üst</span><strong>{m.over25}%</strong></div><div><span>KG</span><strong>{m.btts}%</strong></div></div>
            <div className="bar"><i style={{ width: `${m.goal}%` }} /></div>
          </button>)}
        </div>
        <section className="analysis">
          <div className="analysis-head"><div><span className="eyebrow">DETAYLI ANALİZ</span><h3>{selected.home} <em>vs</em> {selected.away}</h3><div className="analysis-datetime"><CalendarDays size={15}/> {formatDate(selected.date)} <span>•</span> <Clock3 size={15}/> {selected.time} <span>•</span> {selected.league}</div><p>{source}</p></div><div className="score"><span>GOL SKORU</span><b>{selected.goal}</b><small>/ 100</small></div></div>
          <div className="metrics"><Metric label="En az 1 gol" value={selected.goal} /><Metric label="1.5 Üst" value={selected.over15} /><Metric label="2.5 Üst" value={selected.over25} /><Metric label="KG Var" value={selected.btts} /></div>
          <div className="reason"><CircleHelp size={18}/><div><b>Maç AI neden bu maçı öne çıkarıyor?</b><p>{selected.explanation ?? "Model; gol üretimi, gol yeme ve geçmiş xG verilerini birleştirerek bu maç için olasılık skorları oluşturuyor."} {selected.expectedGoals ? `Beklenen toplam gol: ${selected.expectedGoals}.` : ""}</p></div></div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><div className="metric-ring" style={{ "--p": `${value * 3.6}deg` } as React.CSSProperties}><b>{value}%</b></div><span>{label}</span></div>; }
