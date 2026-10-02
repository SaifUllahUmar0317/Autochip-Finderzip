import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  Cpu,
  Folder,
  Home,
  Moon,
  Plus,
  Settings,
  Signal,
  Wifi,
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

function ProgrammerCard({ name, subtitle, modules, pdfs, icon }: {
  name: string; subtitle: string; modules: number; pdfs: number; icon: 'cpu' | 'activity';
}) {
  const AccentIcon = icon === 'activity' ? Activity : Cpu;
  const isIprog = icon === 'activity';
  return (
    <article className={`auto-picker-card${isIprog ? ' iprog' : ''}`}>
      <div className={`auto-tool-icon${isIprog ? ' iprog' : ''}`}><AccentIcon size={20} /></div>
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

export function ProgrammerPicker() {
  return (
    <div className="autochip-preview">
      <StatusBar />
      <main className="auto-home-body auto-picker-body">
        <Header />
        <section>
          <h1 className="auto-current-title">Your programmers</h1>
          <p className="auto-picker-intro">Choose a library to continue.</p>
        </section>
        <section className="auto-picker-list">
          <ProgrammerCard name="CG100X" subtitle="Support databases" modules={4} pdfs={4} icon="cpu" />
          <ProgrammerCard name="iProg Pro" subtitle="Programmer library" modules={0} pdfs={0} icon="activity" />
          <button type="button" className="auto-add-card">
            <span className="auto-add-icon"><Plus size={18} /></span>
            <span className="auto-add-copy">Add programmer<small>Create a library for another device</small></span>
            <ArrowUpRight size={16} />
          </button>
        </section>
      </main>
      <BottomTabs />
    </div>
  );
}

export default ProgrammerPicker;