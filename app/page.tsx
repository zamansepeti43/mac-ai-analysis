"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, Goal, Home as HomeIcon, Radio, Search, ShieldCheck, Star, Trophy, Zap } from "lucide-react";
import LiveMatches from "./components/LiveMatches";

type Match = { id?: number | string; league: string; country?: string; date?: string; time: string; home: string; away: string; homeForm: string; awayForm: string; goal: number; over15: number; over25: number; btts: number; confidence: "Yüksek" | "Orta" | "Düşük"; expectedGoals?: number; explanation?: string };

const navItems = [
  ["Genel Bakış", HomeIcon],
  ["Canlı", Radio],
  ["Bugünün Maçları", CalendarDays],
  ["Haftanın Maçları", Trophy],
  ["Gol Sinyalleri", Goal],
] as const;

function formatDate(value?: string, short = false) {
  if (!value) return "Tarih bekleniyor";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", short ? { day: "2-digit", month: "short" } : { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function MatchCard({ match, selected, onSelect }: { match: Match; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`match-card ${selected ? "selected" : ""}`} onClick={onSelect}>
    <div className="card-top">
      <span className="league-chip"><span className="country-dot" />{match.country ? `${match.country} • ` : ""}{match.league}</span>
      <span className="match-time"><CalendarDays size={13}/>{formatDate(match.date, true)} <Clock3 size={13}/>{match.time}</span>
    </div>
    <div className="teams"><div><b>{match.home}</b><small>Form {match.homeForm}</small></div><span className="vs">VS</span><div><b>{match.away}</b><small>Form {match.awayForm}</small></div></div>
    <div className="prob"><div><span>Gol</span><strong>{match.goal}%</strong></div><div><span>1.5 Üst</span><strong>{match.over15}%</strong></div><div><span>2.5 Üst</span><strong>{match.over25}%</strong></div><div><span>KG Var</span><strong>{match.btts}%</strong></div></div>
    <div className="signal-row"><span><Zap size={12}/> Gol sinyali</span><b>{match.confidence}</b></div>
    <div className="bar"><i style={{ width: `${match.goal}%` }} /></div>
  </button>;
}

export default function Home() {
  const [active, setActive] = useState("Genel Bakış");
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("Gerçek veri hazırlanıyor");
  const isWeek = active === "Haftanın Maçları";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const range = isWeek ? "week" : "today";
    fetch(`/api/matches?range=${range}&limit=100`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const next = Array.isArray(data.matches) ? data.matches.map((match: Partial<Match>) => ({ ...match, homeForm: match.homeForm ?? "—", awayForm: match.awayForm ?? "—" })) as Match[] : [];
        setMatches(next);
        setSelected(next[0] ?? null);
        setSource(next.length ? (data.source === "api-football" ? "API-Football • gerçek veri" : "Gerçek veri") : isWeek ? "Bu hafta için maç bulunamadı" : "Bugün için maç bulunamadı");
      })
      .catch(() => setSource("Gerçek veri bağlantısı kurulamadı"))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [isWeek]);

  const filtered = useMemo(() => matches.filter((m) => `${m.home} ${m.away} ${m.league} ${m.country ?? ""}`.toLowerCase().includes(query.toLowerCase())), [matches, query]);
  const top10 = useMemo(() => [...filtered].sort((a, b) => b.goal - a.goal).slice(0, 10), [filtered]);
  const leagueGroups = useMemo(() => {
    const groups = new Map<string, Match[]>();
    [...filtered].sort((a, b) => `${a.date ?? ""} ${a.time}`.localeCompare(`${b.date ?? ""} ${b.time}`)).forEach((match) => {
      const key = match.league || "Lig bilgisi bekleniyor";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(match);
    });
    return [...groups.entries()];
  }, [filtered]);
  const dateGroups = useMemo(() => {
    if (!isWeek) return [];
    const groups = new Map<string, Match[]>();
    [...filtered].sort((a, b) => `${a.date ?? ""} ${a.time}`.localeCompare(`${b.date ?? ""} ${b.time}`)).forEach((match) => {
      const key = match.date ?? "Tarih bekleniyor";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(match);
    });
    return [...groups.entries()];
  }, [filtered, isWeek]);

  const title = isWeek ? "Haftanın Maçları" : active === "Bugünün Maçları" ? "Bugünün Maçları" : active === "Gol Sinyalleri" ? "Gol Sinyalleri" : "Genel Bakış";

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><strong>Maç AI</strong><span>FOOTBALL INTELLIGENCE</span></div></div>
      <div className="nav-label">ANA MENÜ</div>
      <nav>{navItems.map(([label, Icon]) => <button type="button" key={label} className={active === label ? "nav active" : "nav"} onClick={() => setActive(label)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-mini"><Activity size={17}/><div><b>Gerçek zamanlı motor</b><span>Fikstür + canlı istatistik + AI sinyali</span></div></div>
      <div className="sidebar-footer"><ShieldCheck size={14}/> İstatistiksel analizdir, garanti değildir.</div>
    </aside>

    <section className="main-content">
      <header className="app-header">
        <div className="header-title"><span className="eyebrow">MAÇ AI <i/> {isWeek ? "HAFTA" : "BUGÜN"}</span><h1>{title}</h1><p>Gerçek maç verileri ve istatistiklerle tek ekranda.</p></div>
        <label className="search"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Takım, maç veya lig ara..." /></label>
      </header>

      <div className="quick-tabs"><button type="button" className={!isWeek && active !== "Canlı" ? "active" : ""} onClick={() => setActive("Bugünün Maçları")}>📅 <span>Bugün</span></button><button type="button" className={isWeek ? "active" : ""} onClick={() => setActive("Haftanın Maçları")}>🗓️ <span>Haftanın Maçları</span></button><button type="button" className={active === "Gol Sinyalleri" ? "active" : ""} onClick={() => setActive("Gol Sinyalleri")}>⚡ <span>Gol Sinyalleri</span></button></div>

      <LiveMatches />

      <section className="overview-strip">
        <div className="overview-main"><span className="hero-kicker"><Zap size={15}/> AI GOL MOTORU</span><h2>{isWeek ? "Haftanın güçlü maçlarını keşfet" : "Bugünün güçlü maçlarını keşfet"}</h2><p>Maçlar gerçek tarih ve saatleriyle listelenir. Önce en yüksek gol sinyalli 10 maç, ardından liglere göre fikstür gösterilir.</p></div>
        <div className="overview-stat"><span>EN YÜKSEK GOL SİNYALİ</span><strong>{top10[0]?.goal ?? 0}<small>%</small></strong><em>{loading ? "Veriler yükleniyor" : source}</em></div>
      </section>

      <section className="match-section">
        <div className="section-head"><div><span className="eyebrow">ÖNE ÇIKANLAR</span><h3><span className="hot">🔥</span> Top 10 Maç</h3></div><span className="count">{top10.length} maç</span></div>
        {top10.length ? <div className="cards">{top10.map((match) => <MatchCard key={`top-${match.id ?? `${match.home}-${match.away}`}`} match={match} selected={selected?.id === match.id} onSelect={() => setSelected(match)} />)}</div> : !loading && <div className="empty-state"><Goal size={20}/><div><b>Henüz maç bulunamadı</b><span>Veri sağlayıcıdan gerçek fikstür bekleniyor.</span></div></div>}
      </section>

      <section className="league-list">
        <div className="section-head"><div><span className="eyebrow">GERÇEK FİKSTÜR</span><h3>{isWeek ? "Günlere ve Liglere Göre" : "Liglere Göre Maçlar"}</h3></div><span className="count">{filtered.length} maç</span></div>
        {isWeek ? dateGroups.length === 0 && !loading ? <div className="empty-state"><CalendarDays size={20}/><div><b>Bu hafta için maç bulunamadı</b><span>Gerçek fikstür verisi geldiğinde burada görünecek.</span></div></div> : dateGroups.map(([date, dayMatches]) => <section className="league-group" key={date}><div className="group-heading"><div><span>{formatDate(date)}</span><h4>Günün Maçları</h4></div><b>{dayMatches.length}</b></div><div className="cards">{dayMatches.map((match) => <MatchCard key={`week-${match.id ?? `${match.home}-${match.away}`}`} match={match} selected={selected?.id === match.id} onSelect={() => setSelected(match)} />)}</div></section>) : leagueGroups.length === 0 && !loading ? <div className="empty-state"><Trophy size={20}/><div><b>Bugün için maç bulunamadı</b><span>Veri sağlayıcıdan gerçek fikstür bekleniyor.</span></div></div> : leagueGroups.map(([league, leagueMatches]) => <section className="league-group" key={league}><div className="group-heading"><div><span>{leagueMatches[0]?.country || "Uluslararası"}</span><h4>{league}</h4></div><b>{leagueMatches.length}</b></div><div className="cards">{leagueMatches.map((match) => <MatchCard key={`league-${match.id ?? `${match.home}-${match.away}`}`} match={match} selected={selected?.id === match.id} onSelect={() => setSelected(match)} />)}</div></section>)}
      </section>

      {selected && <section className="analysis-panel"><div className="analysis-top"><div><span className="eyebrow">MAÇ AI ANALİZİ</span><h3>{selected.home} <em>vs</em> {selected.away}</h3><p><CalendarDays size={14}/> {formatDate(selected.date)} <Clock3 size={14}/> {selected.time} <span>•</span> {selected.league}</p></div><div className="ai-score"><span>GOL SKORU</span><b>{selected.goal}</b><small>/100</small></div></div><div className="metrics"><Metric label="En az 1 gol" value={selected.goal}/><Metric label="1.5 Üst" value={selected.over15}/><Metric label="2.5 Üst" value={selected.over25}/><Metric label="KG Var" value={selected.btts}/></div><div className="reason"><Star size={17}/><div><b>AI değerlendirmesi</b><p>{selected.explanation ?? "Model; mevcut maç verilerini istatistiksel olarak birleştirerek olasılık skoru oluşturuyor."} {selected.expectedGoals ? `Beklenen toplam gol: ${selected.expectedGoals}.` : ""}</p></div></div></section>}
    </section>

    <nav className="mobile-nav">{navItems.slice(0, 5).map(([label, Icon]) => <button type="button" key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}><Icon size={19}/><span>{label === "Genel Bakış" ? "Ana Sayfa" : label === "Bugünün Maçları" ? "Bugün" : label === "Haftanın Maçları" ? "Hafta" : label}</span></button>)}</nav>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><div className="metric-ring" style={{ "--p": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><b>{value}%</b></div><span>{label}</span></div>; }
