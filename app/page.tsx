"use client";

import { useMemo, useState } from "react";
import { Activity, CalendarDays, ChevronRight, CircleHelp, Gauge, Goal, Search, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";

type Match = {
  league: string;
  time: string;
  home: string;
  away: string;
  homeForm: string;
  awayForm: string;
  goal: number;
  over15: number;
  over25: number;
  btts: number;
  confidence: "Yüksek" | "Orta";
};

const matches: Match[] = [
  { league: "Premier League", time: "20:00", home: "Liverpool", away: "Brighton", homeForm: "WWDWW", awayForm: "WDLWL", goal: 91, over15: 86, over25: 73, btts: 69, confidence: "Yüksek" },
  { league: "La Liga", time: "22:00", home: "Barcelona", away: "Villarreal", homeForm: "WWWWW", awayForm: "DWWDL", goal: 88, over15: 84, over25: 71, btts: 66, confidence: "Yüksek" },
  { league: "Serie A", time: "21:45", home: "Inter", away: "Atalanta", homeForm: "WWDWW", awayForm: "WDWWW", goal: 86, over15: 81, over25: 68, btts: 72, confidence: "Yüksek" },
  { league: "Süper Lig", time: "20:00", home: "Galatasaray", away: "Trabzonspor", homeForm: "WWWWD", awayForm: "WDLWD", goal: 84, over15: 78, over25: 65, btts: 63, confidence: "Orta" },
];

const navItems = ["Genel Bakış", "Gol Sinyalleri", "Bugünün Maçları", "Ligler"];

export default function Home() {
  const [active, setActive] = useState("Genel Bakış");
  const [selected, setSelected] = useState<Match>(matches[0]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => matches.filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>Maç AI</strong><span>Football Intelligence</span></div></div>
        <div className="nav-label">MENÜ</div>
        <nav>{navItems.map((item, i) => <button key={item} className={active === item ? "nav active" : "nav"} onClick={() => setActive(item)}><span>{[Gauge, Goal, CalendarDays, Trophy][i] && (() => { const I = [Gauge, Goal, CalendarDays, Trophy][i]; return <I size={18} />; })()}</span>{item}</button>)}</nav>
        <div className="sidebar-card"><Sparkles size={18}/><div><b>Maç AI Motoru</b><p>Veri tabanlı tahminler hazırlanıyor.</p></div></div>
        <div className="sidebar-footer"><ShieldCheck size={15}/> İstatistiksel analiz • Garanti değildir</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">SAL 25 AĞUSTOS 2026</div><h1>{active}</h1></div>
          <div className="search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Maç veya takım ara..." /></div>
        </header>

        <section className="hero">
          <div><div className="hero-kicker"><Zap size={16}/> BUGÜNÜN GOL SİNYALLERİ</div><h2>Gol ihtimali en yüksek<br/>maçları keşfet.</h2><p>Maç AI; form, gol ortalamaları ve takım performanslarını analiz ederek maçlar için olasılık skorları üretir.</p></div>
          <div className="hero-stat"><span>En yüksek gol olasılığı</span><strong>{filtered[0]?.goal ?? 0}%</strong><small>Model güveni: yüksek</small></div>
        </section>

        <div className="section-head"><div><span className="eyebrow">MAÇ LİSTESİ</span><h3>Öne Çıkan Maçlar</h3></div><button className="ghost">Tümünü gör <ChevronRight size={16}/></button></div>
        <div className="cards">
          {filtered.map((m) => <button className={`match-card ${selected.home === m.home ? "selected" : ""}`} key={`${m.home}-${m.away}`} onClick={() => setSelected(m)}>
            <div className="card-top"><span>{m.league}</span><time>{m.time}</time></div>
            <div className="teams"><div><b>{m.home}</b><small>Form {m.homeForm}</small></div><span>VS</span><div><b>{m.away}</b><small>Form {m.awayForm}</small></div></div>
            <div className="prob"><div><span>Gol</span><strong>{m.goal}%</strong></div><div><span>1.5 Üst</span><strong>{m.over15}%</strong></div><div><span>2.5 Üst</span><strong>{m.over25}%</strong></div><div><span>KG</span><strong>{m.btts}%</strong></div></div>
            <div className="bar"><i style={{ width: `${m.goal}%` }} /></div>
          </button>)}
        </div>

        <section className="analysis">
          <div className="analysis-head"><div><span className="eyebrow">DETAYLI ANALİZ</span><h3>{selected.home} <em>vs</em> {selected.away}</h3><p>{selected.league} • {selected.time}</p></div><div className="score"><span>GOL SKORU</span><b>{selected.goal}</b><small>/ 100</small></div></div>
          <div className="metrics"><Metric label="En az 1 gol" value={selected.goal} /><Metric label="1.5 Üst" value={selected.over15} /><Metric label="2.5 Üst" value={selected.over25} /><Metric label="KG Var" value={selected.btts} /></div>
          <div className="reason"><CircleHelp size={18}/><div><b>Maç AI neden bu maçı öne çıkarıyor?</b><p>Takımların son dönem gol üretimi, savunma performansı ve iç/dış saha verileri birlikte değerlendirildi. Bu ekran şu an örnek model skorlarını gösterir; gerçek veri bağlantısı sonraki aşamada eklenecek.</p></div></div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><div className="metric-ring" style={{ "--p": `${value * 3.6}deg` } as React.CSSProperties}><b>{value}%</b></div><span>{label}</span></div>;
}
