"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Compass,
  MapPin,
  Star,
  UserRound,
} from "@/components/icons";
import "./design-lab.css";

type Direction = "editorial" | "catalogue" | "notebook";
type DemoScreen = "home" | "meeting" | "profile";

const directions: Array<{ id: Direction; label: string; number: string }> = [
  { id: "editorial", label: "Dergi", number: "01" },
  { id: "catalogue", label: "Katalog", number: "02" },
  { id: "notebook", label: "Defter", number: "03" },
];

const screens: Array<{ id: DemoScreen; label: string }> = [
  { id: "home", label: "Ana sayfa" },
  { id: "meeting", label: "Buluşma" },
  { id: "profile", label: "Profil" },
];

const members = ["MÖ", "YA", "SF", "EB", "MM", "MK"];

function MemberStack() {
  return (
    <div className="demo-members" aria-label="6 katılımcı">
      {members.map((member, index) => (
        <span key={member} style={{ "--member-index": index } as CSSProperties}>{member}</span>
      ))}
    </div>
  );
}

function DemoNavigation({ screen, onScreen }: { screen: DemoScreen; onScreen: (screen: DemoScreen) => void }) {
  return (
    <nav className="demo-navigation" aria-label="Demo ekranları">
      <button className={screen === "home" ? "active" : ""} onClick={() => onScreen("home")}><BookOpen size={20} /> Ana sayfa</button>
      <button className={screen === "meeting" ? "active" : ""} onClick={() => onScreen("meeting")}><Archive size={20} /> Buluşmalar</button>
      <button onClick={() => onScreen("home")}><Compass size={20} /> Plan</button>
      <button className={screen === "profile" ? "active" : ""} onClick={() => onScreen("profile")}><UserRound size={20} /> Profilim</button>
    </nav>
  );
}

function ConceptHeader({ screen, onScreen }: { screen: DemoScreen; onScreen: (screen: DemoScreen) => void }) {
  return (
    <header className="concept-header">
      <button className="concept-brand" onClick={() => onScreen("home")}>
        <span className="concept-mark"><BookOpen size={26} /></span>
        <span><strong>Kitap Tahlil</strong><b>&amp; İstişare</b></span>
      </button>
      <DemoNavigation screen={screen} onScreen={onScreen} />
      <button className="concept-user" onClick={() => onScreen("profile")}><span>MÖ</span><strong>Mustafa Özgör</strong></button>
    </header>
  );
}

function BookObject({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "demo-book compact" : "demo-book"} aria-label="Saatleri Ayarlama Enstitüsü kitap kapağı">
      <span>TANPINAR</span>
      <strong>Saatleri<br />Ayarlama<br />Enstitüsü</strong>
      <small>roman</small>
    </div>
  );
}

function HomeDemo({ onScreen }: { onScreen: (screen: DemoScreen) => void }) {
  return (
    <main className="demo-content home-demo">
      <section className="demo-lead">
        <div className="lead-copy">
          <span className="demo-kicker">SIRADAKİ BULUŞMA / 12 EKİM</span>
          <h1>Saatleri Ayarlama Enstitüsü</h1>
          <p>Tanpınar’ın zaman, toplum ve modernleşme üzerine kurduğu dünyayı bu pazar aynı masada konuşuyoruz.</p>
          <button className="demo-command" onClick={() => onScreen("meeting")}>Buluşma kaydını aç <ArrowRight size={20} /></button>
        </div>
        <figure className="lead-image">
          <img src="/reading-room.png" alt="Kitaplarla çevrili okuma odası" />
          <figcaption><span>07</span><strong>Pazar, 16.00</strong><small>Kadıköy Kitap Kafe</small></figcaption>
        </figure>
      </section>

      <section className="home-register">
        <div className="register-main">
          <div className="section-heading"><span>MASA NOTLARI</span><h2>Bu buluşmada</h2></div>
          <div className="register-book"><BookObject compact /><div><strong>İkinci bölüm</strong><p>Hayri İrdal’ın enstitüyle kurduğu ilişkinin değişimi ve zaman fikri.</p></div><span>148–260</span></div>
          <div className="register-members"><MemberStack /><div><strong>6 kişi masada</strong><span>Katılımını buluşma sayfasından belirtebilirsin.</span></div></div>
        </div>
        <aside className="next-reading">
          <span className="demo-kicker">SONRAKİ OKUMA</span>
          <h2>Bir Bilim Adamının Romanı</h2>
          <p>Oğuz Atay</p>
          <button>Yol haritasına bak <ArrowRight size={20} /></button>
        </aside>
      </section>

      <section className="archive-register">
        <div className="section-heading"><span>ARŞİV / 2026</span><h2>Son buluşmalar</h2></div>
        <div className="archive-table">
          <button onClick={() => onScreen("meeting")}><span>06</span><strong>Huzur</strong><em>Ahmet Hamdi Tanpınar</em><small>28 Eylül</small><ArrowRight size={20} /></button>
          <button onClick={() => onScreen("meeting")}><span>05</span><strong>İnsan Ne ile Yaşar?</strong><em>Lev Tolstoy</em><small>14 Eylül</small><ArrowRight size={20} /></button>
          <button onClick={() => onScreen("meeting")}><span>04</span><strong>Yavaşla</strong><em>Kemal Sayar</em><small>31 Ağustos</small><ArrowRight size={20} /></button>
        </div>
      </section>
    </main>
  );
}

function MeetingDemo() {
  return (
    <main className="demo-content meeting-demo">
      <button className="demo-back"><ArrowLeft size={20} /> Buluşmalara dön</button>
      <header className="meeting-title">
        <div><span className="demo-kicker">07 / YAKLAŞAN BULUŞMA</span><h1>Saatleri Ayarlama Enstitüsü</h1><p>Ahmet Hamdi Tanpınar · Dergâh Yayınları · 384 sayfa</p></div>
        <div className="meeting-rating"><Star size={24} fill="currentColor" /><strong>8,7</strong><span>5 değerlendirme</span></div>
      </header>

      <section className="meeting-record">
        <div className="meeting-book"><BookObject /></div>
        <div className="meeting-notes">
          <span className="demo-kicker">BULUŞMA FİŞİ</span>
          <h2>İkinci bölüm</h2>
          <p>Hayri İrdal’ın enstitüyle kurduğu ilişkinin değişimini ve romanın zaman fikrini konuşacağız.</p>
          <dl><div><dt><CalendarDays size={20} /> Tarih</dt><dd>12 Ekim 2026, 16.00</dd></div><div><dt><MapPin size={20} /> Yer</dt><dd>Kadıköy Kitap Kafe</dd></div><div><dt><BookOpen size={20} /> Bölüm</dt><dd>148–260. sayfalar</dd></div></dl>
        </div>
        <aside className="attendance-panel">
          <span className="demo-kicker">OKUMA DURUMUM</span>
          <h2>Masaya nasıl geliyorsun?</h2>
          <div className="status-options"><button className="selected"><Check size={18} /> Okudum</button><button>Kısmen okudum</button><button>Okumadım</button></div>
          <button className="demo-primary">Katılımımı kaydet <ArrowRight size={20} /></button>
        </aside>
      </section>

      <section className="meeting-lower">
        <div className="participant-register"><div className="section-heading"><span>KATILIM</span><h2>Masadakiler</h2></div><MemberStack /><p>6 kişi katılımını belirtti.</p></div>
        <div className="photo-record"><div className="section-heading"><span>FOTOĞRAFLAR</span><h2>Son buluşmadan</h2></div><button><img src="/reading-room.png" alt="Buluşma fotoğrafı" /><span><Camera size={20} /> Fotoğrafı büyüt</span></button></div>
      </section>
    </main>
  );
}

function ProfileDemo() {
  return (
    <main className="demo-content profile-demo">
      <header className="profile-title"><div className="profile-avatar-demo">MÖ</div><div><span className="demo-kicker">ÜYE NO / 01</span><h1>Mustafa Özgör</h1><p>Ana yönetici · 2025’ten beri masada</p></div><button>Profili düzenle</button></header>
      <section className="profile-numbers"><div><strong>18</strong><span>buluşma</span></div><div><strong>14</strong><span>kitap</span></div><div><strong>8,4</strong><span>ortalama puan</span></div><div><strong>06</strong><span>favori</span></div></section>
      <section className="profile-grid-demo">
        <div className="my-books"><div className="section-heading"><span>KİTAP DEFTERİ</span><h2>Okuduklarım</h2></div><div className="book-ledger"><button><BookObject compact /><span><strong>Huzur</strong><small>28 Eylül 2026</small></span><em className="read-dot read">Okudum</em></button><button><BookObject compact /><span><strong>Saatleri Ayarlama Enstitüsü</strong><small>12 Ekim 2026</small></span><em className="read-dot partial">Kısmen</em></button><button><BookObject compact /><span><strong>İnsan Ne ile Yaşar?</strong><small>14 Eylül 2026</small></span><em className="read-dot unread">Okumadım</em></button></div></div>
        <aside className="profile-gallery-demo"><div className="section-heading"><span>GALERİM</span><h2>Masadan kareler</h2></div><button><img src="/reading-room.png" alt="Okuma grubundan bir kare" /><span>Huzur · 28 Eylül</span></button></aside>
      </section>
    </main>
  );
}

function ConceptDemo({ direction, screen, onScreen }: { direction: Direction; screen: DemoScreen; onScreen: (screen: DemoScreen) => void }) {
  return (
    <section className={`concept-canvas concept-${direction}`}>
      <ConceptHeader screen={screen} onScreen={onScreen} />
      {screen === "home" && <HomeDemo onScreen={onScreen} />}
      {screen === "meeting" && <MeetingDemo />}
      {screen === "profile" && <ProfileDemo />}
      <footer className="concept-footer"><strong>Kitap Tahlil &amp; İstişare</strong><span>Okuma grubu kayıtları · İstanbul</span></footer>
    </section>
  );
}

export default function DesignLabPage() {
  const [direction, setDirection] = useState<Direction>("editorial");
  const [screen, setScreen] = useState<DemoScreen>("home");


  return (
    <div className="design-lab">
      <header className="lab-toolbar">
        <Link href="/" aria-label="Uygulamaya dön"><ArrowLeft size={20} /><span>Tasarım laboratuvarı</span></Link>
        <div className="lab-modes" role="group" aria-label="Tasarım yönü">
          {directions.map((item) => <button key={item.id} className={direction === item.id ? "active" : ""} onClick={() => setDirection(item.id)}><span>{item.number}</span>{item.label}</button>)}
        </div>
        <div className="lab-screens" role="group" aria-label="Örnek ekran">
          {screens.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>{item.label}</button>)}
        </div>
      </header>
      <ConceptDemo direction={direction} screen={screen} onScreen={setScreen} />
    </div>
  );
}
