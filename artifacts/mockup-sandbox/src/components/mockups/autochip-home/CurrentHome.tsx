import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Cpu,
  FileText,
  Folder,
  Home,
  Moon,
  Plus,
  Search,
  Settings,
  Signal,
  Wifi,
  Zap,
} from 'lucide-react';
import './_group.css';

function StatusBar() {
  return (
    <div className="auto-status">
      <span>8:51 ▣ ▴ ▣</span>
      <div className="auto-status-icons"><Signal size={12} /><Wifi size={12} /><span>▰</span></div>
    </div>
  );
}

function Header() {
  return (
    <header className="auto-header">
      <div className="auto-brand">
        <img className="auto-brand-icon" src="/__mockup/images/autochip-icon.png" alt="" />
        <div>
          <div className="auto-brand-name">AutoChip Finder</div>
          <div className="auto-brand-tagline">SMART MODULE SEARCH</div>
        </div>
      </div>
      <div className="auto-header-actions"><Moon size={18} /><Settings size={19} /></div>
    </header>
  );
}

function ProgrammerCard({ name, subtitle, modules, pdfs, iprog = false }: {
  name: string; subtitle: string; modules: number; pdfs: number; iprog?: boolean;
}) {
  return (
    <article className={`auto-current-tool${iprog ? ' iprog' : ''}`}>
      <div className={`auto-tool-icon${iprog ? ' iprog' : ''}`}>
        {iprog ? <Activity size={19} /> : <Cpu size={19} />}
      </div>
      <ArrowUpRight className="auto-card-arrow" size={16} />
      <h3 className="auto-tool-name">{name}</h3>
      <p className="auto-tool-subtitle">{subtitle}</p>
      <div className="auto-tool-foot"><span>{modules} modules</span><span>{pdfs} PDFs</span></div>
    </article>
  );
}

function BottomTabs() {
  return (
    <nav className="auto-tabbar">
      <div className="auto-tab active"><Home size={17} /><span>Home</span></div>
      <div className="auto-tab"><Folder size={17} /><span>Library</span></div>
      <div className="auto-tab"><Bookmark size={17} /><span>Saved</span></div>
    </nav>
  );
}

export function CurrentHome() {
  return (
    <div className="autochip-preview">
      <StatusBar />
      <main className="auto-home-body">
        <Header />
        <section className="auto-current-hero">
          <div className="auto-hero-top"><span className="auto-offline-pill">OFFLINE-READY</span><Zap size={14} /></div>
          <h1 className="auto-hero-title">Find your<br />automotive chip data.</h1>
          <p className="auto-hero-copy">Search across your CG100X and iProg Pro manuals in seconds.</p>
          <div className="auto-search-box"><Search size={17} /><span className="auto-search-placeholder">Part no., chip, brand, vehicle…</span></div>
          <div className="auto-hero-hint">Search every indexed page <ArrowUpRight size={12} /></div>
        </section>
        <h2 className="auto-current-title">Your programmers</h2>
        <section className="auto-current-tools">
          <ProgrammerCard name="CG100X" subtitle="Support databases" modules={4} pdfs={4} />
          <ProgrammerCard name="iProg Pro" subtitle="Programmer library" modules={0} pdfs={0} iprog />
        </section>
        <section className="auto-stat-row">
          <div className="auto-stat"><strong>4</strong><small>PDFs</small></div>
          <div className="auto-stat"><strong>221</strong><small>Indexed pages</small></div>
          <div className="auto-stat"><strong>1.1 MB</strong><small>Library size</small></div>
        </section>
        <section className="auto-quick-actions">
          <div className="auto-action"><Plus size={14} />Add a PDF</div>
          <div className="auto-action secondary"><Folder size={14} />PDF library</div>
        </section>
        <section className="auto-recent">
          <h2 className="auto-recent-heading">Recently opened</h2>
          {[
            ['CG100X Support Airbag List', 'Airbag · page 4'],
            ['CG100X Support ECU List', 'ECU · page 1'],
            ['CG100X Support BCM List', 'BCM · page 1'],
          ].map(([title, detail]) => (
            <div className="auto-recent-row" key={title}>
              <div className="auto-recent-icon"><FileText size={14} /></div>
              <div className="auto-recent-copy"><strong>{title}</strong><small>{detail}</small></div>
              <ChevronRight size={15} color="#738097" />
            </div>
          ))}
        </section>
      </main>
      <BottomTabs />
    </div>
  );
}

export default CurrentHome;