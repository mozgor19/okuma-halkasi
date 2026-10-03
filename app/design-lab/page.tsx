"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookHeart,
  BookOpen,
  CalendarPlus,
  CalendarDays,
  Camera,
  Check,
  Compass,
  Download,
  ImagePlus,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  ScanFace,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  UserRound,
  UserSwitch,
  Users,
  X,
} from "@/components/icons";
import "./design-lab.css";

type Direction = "editorial" | "catalogue" | "notebook";
type DemoScreen = "home" | "archive" | "roadmap" | "meeting" | "profile" | "management";
type ProfileSection = "summary" | "books" | "gallery" | "security" | "face" | "trash";
type UtilityPanel = "search" | "notifications" | "account" | null;

const directions: Array<{ id: Direction; label: string; number: string }> = [
  { id: "editorial", label: "Dergi", number: "01" },
  { id: "catalogue", label: "Katalog", number: "02" },
  { id: "notebook", label: "Defter", number: "03" },
];

const screens: Array<{ id: DemoScreen; label: string }> = [
  { id: "home", label: "Ana sayfa" },
  { id: "archive", label: "Buluşmalar" },
  { id: "roadmap", label: "Plan" },
  { id: "meeting", label: "Buluşma detayı" },
  { id: "profile", label: "Profil" },
  { id: "management", label: "Yönetim" },
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
      <button className={screen === "archive" || screen === "meeting" ? "active" : ""} onClick={() => onScreen("archive")}><Archive size={20} /> Buluşmalar</button>
      <button className={screen === "roadmap" ? "active" : ""} onClick={() => onScreen("roadmap")}><Compass size={20} /> Plan</button>
      <button className={screen === "profile" || screen === "management" ? "active" : ""} onClick={() => onScreen("profile")}><UserRound size={20} /> Profilim</button>
    </nav>
  );
}

function ConceptHeader({ screen, onScreen, onUtility }: { screen: DemoScreen; onScreen: (screen: DemoScreen) => void; onUtility: (panel: UtilityPanel) => void }) {
  return (
    <header className="concept-header">
      <button className="concept-brand" onClick={() => onScreen("home")}>
        <span className="concept-mark"><BookOpen size={26} /></span>
        <span><strong>Kitap Tahlil</strong><b>&amp; İstişare</b></span>
      </button>
      <DemoNavigation screen={screen} onScreen={onScreen} />
      <div className="concept-actions">
        <button className="concept-icon-action" aria-label="Ara" title="Ara" onClick={() => onUtility("search")}><Search size={20} /></button>
        <button className="concept-icon-action has-alert" aria-label="Bildirimler" title="Bildirimler" onClick={() => onUtility("notifications")}><Bell size={20} /></button>
        <button className="concept-user" onClick={() => onUtility("account")}><span>MÖ</span><strong>Mustafa Özgör</strong></button>
      </div>
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

function ArchiveDemo({ onScreen }: { onScreen: (screen: DemoScreen) => void }) {
  return (
    <main className="demo-content listing-demo">
      <header className="page-intro">
        <div><span className="demo-kicker">BULUŞMA DEFTERİ / 2026</span><h1>Buluşmalar</h1><p>Yaklaşan masayı ve geride bıraktığımız okumaları aynı kayıt defterinde bul.</p></div>
        <button className="demo-command"><CalendarPlus size={20} /> Yeni buluşma</button>
      </header>
      <div className="listing-tabs"><button className="active">Yaklaşan <span>1</span></button><button>Geçmiş <span>18</span></button></div>
      <section className="upcoming-slip">
        <button className="upcoming-cover" onClick={() => onScreen("meeting")}><BookObject /></button>
        <div className="upcoming-copy">
          <span className="demo-kicker">12 EKİM / PAZAR / 16.00</span><h2>Saatleri Ayarlama Enstitüsü</h2>
          <p>İkinci bölüm, 148–260. sayfalar. Okuma bu buluşmadan sonra devam edecek.</p>
          <div className="inline-facts"><span><MapPin size={18} /> Kadıköy Kitap Kafe</span><span><Users size={18} /> 6 katılımcı</span></div>
          <button className="demo-primary" onClick={() => onScreen("meeting")}>Kaydı aç <ArrowRight size={20} /></button>
        </div>
      </section>
      <section className="archive-register full-register">
        <div className="section-heading"><span>GEÇMİŞ KAYITLAR</span><h2>Masada kalanlar</h2></div>
        <div className="archive-table">
          {[
            ["06", "Huzur", "Ahmet Hamdi Tanpınar", "28 Eylül"],
            ["05", "İnsan Ne ile Yaşar?", "Lev Tolstoy", "14 Eylül"],
            ["04", "Yavaşla", "Kemal Sayar", "31 Ağustos"],
            ["03", "Körlük", "José Saramago", "17 Ağustos"],
          ].map((item) => <button key={item[0]} onClick={() => onScreen("meeting")}><span>{item[0]}</span><strong>{item[1]}</strong><em>{item[2]}</em><small>{item[3]}</small><ArrowRight size={20} /></button>)}
        </div>
      </section>
    </main>
  );
}

function RoadmapDemo() {
  const [vote, setVote] = useState("Saatleri Ayarlama Enstitüsü");
  const [secret, setSecret] = useState(false);
  const books = [
    ["Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar", "4"],
    ["Bir Bilim Adamının Romanı", "Oğuz Atay", "2"],
    ["Kuyucaklı Yusuf", "Sabahattin Ali", "1"],
  ];

  return (
    <main className="demo-content roadmap-demo">
      <header className="page-intro"><div><span className="demo-kicker">OKUMA PUSULASI</span><h1>Sıradaki kitap</h1><p>Öneriler masaya gelsin, herkes oyunu versin; seçilen kitap buluşma planına taşınsın.</p></div><button className="demo-command"><Plus size={20} /> Kitap öner</button></header>
      <section className="vote-control">
        <div><span className="demo-kicker">OYLAMA / AÇIK</span><h2>Hangi kitabı okuyalım?</h2></div>
        <label className="visibility-toggle"><input type="checkbox" checked={secret} onChange={(event) => setSecret(event.target.checked)} /><span aria-hidden="true" /><strong>{secret ? "Gizli oy" : "Oylar görünür"}</strong></label>
      </section>
      <section className="ballot-list">
        {books.map(([title, author, count], index) => <button key={title} className={vote === title ? "selected" : ""} onClick={() => setVote(title)}><span className="ballot-number">0{index + 1}</span><span className="ballot-title"><strong>{title}</strong><small>{author}</small></span><span className="vote-mark">{vote === title && <Check size={18} />}{secret ? "Oy ver" : count + " oy"}</span></button>)}
      </section>
      <section className="roadmap-admin"><div><span className="demo-kicker">YÖNETİCİ ARAÇLARI</span><p>Oylamayı kapatabilir, sonuçları sıfırlayabilir veya seçilen kitap için buluşma oluşturabilirsin.</p></div><div><button><CalendarPlus size={20} /> Buluşma oluştur</button><button>Oyları sıfırla</button></div></section>
    </main>
  );
}

function MeetingDemo({ onScreen }: { onScreen: (screen: DemoScreen) => void }) {
  const [reading, setReading] = useState("read");
  const [starred, setStarred] = useState(true);

  return (
    <main className="demo-content meeting-demo">
      <button className="demo-back" onClick={() => onScreen("archive")}><ArrowLeft size={20} /> Buluşmalara dön</button>
      <header className="meeting-title">
        <div><span className="demo-kicker">07 / YAKLAŞAN BULUŞMA</span><h1>Saatleri Ayarlama Enstitüsü</h1><p>Ahmet Hamdi Tanpınar · Dergâh Yayınları · 384 sayfa</p></div>
        <button className={starred ? "favorite-button selected" : "favorite-button"} onClick={() => setStarred(!starred)}><Star size={22} fill={starred ? "currentColor" : "none"} /> {starred ? "Favorimde" : "Favoriye ekle"}</button>
      </header>
      <section className="admin-strip"><strong>Yönetici görünümü</strong><button><Pencil size={18} /> Buluşmayı düzenle</button><button><BookOpen size={18} /> Künyeyi düzenle</button><button><CalendarPlus size={18} /> Devam buluşması</button><button className="danger"><Trash2 size={18} /> Çöpe taşı</button></section>
      <section className="meeting-record">
        <div className="meeting-book"><BookObject /><span className="continuation-note">Okuma devam edecek</span></div>
        <div className="meeting-notes"><span className="demo-kicker">BULUŞMA FİŞİ</span><h2>İkinci bölüm</h2><p>Hayri İrdal’ın enstitüyle kurduğu ilişkinin değişimini ve romanın zaman fikrini konuşacağız.</p><dl><div><dt><CalendarDays size={20} /> Tarih</dt><dd>12 Ekim 2026, 16.00</dd></div><div><dt><MapPin size={20} /> Yer</dt><dd>Kadıköy Kitap Kafe</dd></div><div><dt><BookOpen size={20} /> Bölüm</dt><dd>148–260. sayfalar</dd></div></dl><div className="meeting-links"><button><Download size={18} /> Takvime ekle</button><button><MapPin size={18} /> Haritada aç</button></div></div>
        <aside className="attendance-panel">
          <span className="demo-kicker">OKUMA DURUMUM</span><h2>Masaya nasıl geliyorsun?</h2>
          <div className="status-options">{[["read","Okudum"],["partial","Kısmen okudum"],["unread","Okumadım"]].map(([id,label]) => <button key={id} className={reading === id ? "selected" : ""} onClick={() => setReading(id)}>{reading === id && <Check size={18} />}{label}</button>)}</div>
          <label className="page-progress"><span>Kaldığım sayfa</span><input type="number" defaultValue="260" /></label>
          {reading !== "unread" && <div className="rating-input"><span>Puanım</span><div>{[1,2,3,4,5].map((star) => <button key={star} aria-label={star + " yıldız"}><Star size={22} fill={star < 5 ? "currentColor" : "none"} /></button>)}</div></div>}
          <label className="comment-input"><span>Notum</span><textarea defaultValue="Zaman fikrinin işlendiği bölümler üzerine konuşmak istiyorum." /></label>
          <button className="demo-primary">Katılımımı kaydet <ArrowRight size={20} /></button>
        </aside>
      </section>
      <section className="attendance-register">
        <div className="section-heading"><span>KATILIM</span><h2>Masadakiler</h2></div><div className="attendance-actions"><button><UserPlus size={20} /> Üye ekle</button><button><Users size={20} /> Misafir ekle</button></div>
        <div className="participant-list"><div><MemberStack /><p><strong>6 kişi katılıyor</strong><span>4 okudu · 1 kısmen · 1 işaretlemedi</span></p></div><button>Katılımı düzenle</button></div>
      </section>
      <section className="photo-workspace">
        <div className="section-heading"><span>FOTOĞRAFLAR</span><h2>Buluşma albümü</h2></div><div className="photo-actions"><button><ImagePlus size={20} /> Fotoğraf yükle</button><button><Download size={20} /> Albümü indir</button><button className="danger"><Trash2 size={20} /> Fotoğraf sil</button></div>
        <div className="photo-grid-demo"><button><img src="/reading-room.png" alt="Buluşma fotoğrafı" /><span><Camera size={20} /> Büyüt</span></button><div className="face-suggestion"><ScanFace size={28} /><strong>Fotoğrafta 4 üye bulundu</strong><p>Mustafa, Yakup, Saltuk ve Eren masadaydı.</p><div><button><Check size={18} /> Katılıma ekle</button><button><X size={18} /> Kapat</button></div></div></div>
      </section>
      <section className="review-register"><div className="section-heading"><span>DEĞERLENDİRMELER</span><h2>Masadan notlar</h2></div><div className="review-row"><span>MÖ</span><div><strong>Mustafa Özgör</strong><small><Star size={16} fill="currentColor" /> 8 / 10</small><p>Romanın mizahı, modernleşme eleştirisini çok daha canlı kılıyor.</p></div></div><div className="review-row"><span>YA</span><div><strong>Yakup Avcı</strong><small><Star size={16} fill="currentColor" /> 9 / 10</small><p>İkinci yarıda ritim ve karakterler iyice yerine oturuyor.</p></div></div></section>
    </main>
  );
}

function ProfileDemo({ onManagement }: { onManagement: () => void }) {
  const [section, setSection] = useState<ProfileSection>("summary");
  return (
    <main className="demo-content profile-demo">
      <header className="profile-title"><div className="profile-avatar-demo">MÖ</div><div><span className="demo-kicker">ÜYE NO / 01</span><h1>Mustafa Özgör</h1><p>Ana yönetici · 2025’ten beri masada</p></div><button><Pencil size={18} /> Profili düzenle</button></header>
      <nav className="profile-tabs">
        {[["summary","Özet"],["books","Kitaplarım"],["gallery","Galerim"],["security","Güvenlik"],["face","Yüz verisi"],["trash","Çöp"]].map(([id,label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id as ProfileSection)}>{label}</button>)}
      </nav>
      {section === "summary" && <><section className="profile-numbers"><div><strong>18</strong><span>buluşma</span></div><div><strong>14</strong><span>kitap</span></div><div><strong>8,4</strong><span>ortalama puan</span></div><div><strong>06</strong><span>favori</span></div></section><section className="profile-summary"><div><span className="demo-kicker">SON KAYIT</span><h2>Huzur buluşması</h2><p>Okudum · 8/10 · 28 Eylül 2026</p></div><button className="demo-command" onClick={onManagement}><ShieldCheck size={20} /> Yönetim alanını aç</button></section></>}
      {section === "books" && <section className="profile-grid-demo"><div className="my-books"><div className="section-heading"><span>OKUDUKLARIM</span><h2>Kitap defteri</h2></div><div className="book-ledger"><button><BookObject compact /><span><strong>Huzur</strong><small>28 Eylül 2026</small></span><em className="read-dot read">Okudum</em></button><button><BookObject compact /><span><strong>Saatleri Ayarlama Enstitüsü</strong><small>12 Ekim 2026</small></span><em className="read-dot partial">Kısmen</em></button><button><BookObject compact /><span><strong>İnsan Ne ile Yaşar?</strong><small>14 Eylül 2026</small></span><em className="read-dot unread">Okumadım</em></button></div></div><aside className="favorite-ledger"><div className="section-heading"><span>YILDIZLADIKLARIM</span><h2>Favorilerim</h2></div><button><BookHeart size={24} /><span><strong>Körlük</strong><small>José Saramago</small></span></button><button><BookHeart size={24} /><span><strong>Huzur</strong><small>Ahmet Hamdi Tanpınar</small></span></button></aside></section>}
      {section === "gallery" && <section className="gallery-ledger"><div className="section-heading"><span>KATILDIĞIM BULUŞMALAR</span><h2>Galerim</h2></div><div><button><img src="/reading-room.png" alt="Huzur buluşması" /><span>Huzur · 28 Eylül</span></button><button><img src="/reading-room.png" alt="Yavaşla buluşması" /><span>Yavaşla · 31 Ağustos</span></button></div></section>}
      {section === "security" && <section className="settings-sheet"><div><KeyRound size={28} /><span><strong>Şifremi değiştir</strong><small>Mevcut şifreni doğrulayarak yeni şifre belirle.</small></span></div><label>Mevcut şifre<input type="password" defaultValue="12345678" /></label><label>Yeni şifre<input type="password" placeholder="En az 8 karakter" /></label><button className="demo-primary">Şifreyi güncelle</button></section>}
      {section === "face" && <section className="settings-sheet"><div><ScanFace size={28} /><span><strong>Yüz tanıma verim</strong><small>Referans yalnızca bu uygulamanın içinde kullanılır.</small></span></div><div className="consent-row"><span className="profile-avatar-demo">MÖ</span><p><strong>Referans fotoğrafı kayıtlı</strong><small>Onay verildi · 2 Ekim 2026</small></p><button>Değiştir</button></div><button className="danger-link">İznimi kaldır ve veriyi sil</button></section>}
      {section === "trash" && <section className="trash-ledger"><div className="section-heading"><span>ÇÖP KUTUSU</span><h2>Silinen kayıtlar</h2></div><div><span><Archive size={22} /><strong>Kürk Mantolu Madonna</strong><small>1 Ekim’de silindi</small></span><button>Geri yükle</button><button className="danger-link">Kalıcı sil</button></div></section>}
    </main>
  );
}

function ManagementDemo() {
  return (
    <main className="demo-content management-demo">
      <header className="page-intro"><div><span className="demo-kicker">ANA YÖNETİCİ ALANI</span><h1>Yönetim</h1><p>Roller ve hassas üye verileri buluşma yönetiminden ayrı tutulur.</p></div><span className="role-stamp"><ShieldCheck size={22} /> Super admin</span></header>
      <section className="permission-note"><strong>Yetki sınırı</strong><p>Normal yöneticiler buluşma oluşturabilir, oylamayı yönetebilir ve fotoğraf silebilir. Yeni yönetici atayamaz veya yüz verilerini değiştiremez.</p></section>
      <section className="member-admin-list"><div className="section-heading"><span>ÜYELER / 6</span><h2>Rol dağılımı</h2></div><div><span className="member-chip">MÖ</span><p><strong>Mustafa Özgör</strong><small>Super admin</small></p><em>Ana yönetici</em></div><div><span className="member-chip">YA</span><p><strong>Yakup Avcı</strong><small>Buluşma yöneticisi</small></p><button><UserSwitch size={18} /> Yetkiyi düzenle</button></div><div><span className="member-chip">SF</span><p><strong>Saltuk Farsak</strong><small>Katılımcı</small></p><button><ShieldCheck size={18} /> Yönetici yap</button></div></section>
    </main>
  );
}

function MobileBottomNav({ screen, onScreen }: { screen: DemoScreen; onScreen: (screen: DemoScreen) => void }) {
  return <nav className="mobile-bottom-nav"><button className={screen === "home" ? "active" : ""} onClick={() => onScreen("home")}><BookOpen size={22} /><span>Ana sayfa</span></button><button className={screen === "archive" || screen === "meeting" ? "active" : ""} onClick={() => onScreen("archive")}><Archive size={22} /><span>Buluşmalar</span></button><button className={screen === "roadmap" ? "active" : ""} onClick={() => onScreen("roadmap")}><Compass size={22} /><span>Plan</span></button><button className={screen === "profile" || screen === "management" ? "active" : ""} onClick={() => onScreen("profile")}><UserRound size={22} /><span>Profil</span></button></nav>;
}

function UtilityDrawer({ panel, onClose, onScreen }: { panel: Exclude<UtilityPanel, null>; onClose: () => void; onScreen: (screen: DemoScreen) => void }) {
  return (
    <div className="utility-layer" onClick={onClose}>
      <section className="utility-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" aria-label="Kapat" onClick={onClose}><X size={22} /></button>
        {panel === "search" && <><span className="demo-kicker">KAYITLARDA ARA</span><h2>Ne arıyorsun?</h2><label className="search-field"><Search size={20} /><input autoFocus placeholder="Kitap, yazar veya buluşma..." /></label><div className="quick-results"><button onClick={() => { onScreen("meeting"); onClose(); }}><BookOpen size={20} /><span><strong>Saatleri Ayarlama Enstitüsü</strong><small>Yaklaşan buluşma</small></span></button><button><Archive size={20} /><span><strong>Huzur</strong><small>28 Eylül buluşması</small></span></button></div></>}
        {panel === "notifications" && <><span className="demo-kicker">BİLDİRİMLER / 2</span><h2>Masadan haberler</h2><div className="notification-list"><button><CalendarDays size={20} /><span><strong>Buluşma yaklaşıyor</strong><small>Saatleri Ayarlama Enstitüsü · Pazar 16.00</small></span></button><button><Compass size={20} /><span><strong>Yeni oylama açıldı</strong><small>Sıradaki kitap için oyunu ver.</small></span></button></div></>}
        {panel === "account" && <><span className="demo-kicker">HESABIM</span><h2>Mustafa Özgör</h2><div className="account-menu"><button onClick={() => { onScreen("profile"); onClose(); }}><UserRound size={20} /> Profilim</button><button onClick={() => { onScreen("management"); onClose(); }}><ShieldCheck size={20} /> Yönetim alanı</button><button><UserSwitch size={20} /> Katılımcı görünümüne geç</button><button>Çıkış yap</button></div></>}
      </section>
    </div>
  );
}

function ConceptDemo({ direction, screen, onScreen }: { direction: Direction; screen: DemoScreen; onScreen: (screen: DemoScreen) => void }) {
  const [utility, setUtility] = useState<UtilityPanel>(null);

  return (
    <section className={`concept-canvas concept-${direction}`}>
      <ConceptHeader screen={screen} onScreen={onScreen} onUtility={setUtility} />
      {screen === "home" && <HomeDemo onScreen={onScreen} />}
      {screen === "archive" && <ArchiveDemo onScreen={onScreen} />}
      {screen === "roadmap" && <RoadmapDemo />}
      {screen === "meeting" && <MeetingDemo onScreen={onScreen} />}
      {screen === "profile" && <ProfileDemo onManagement={() => onScreen("management")} />}
      {screen === "management" && <ManagementDemo />}
      <footer className="concept-footer"><strong>Kitap Tahlil &amp; İstişare</strong><span>Okuma grubu kayıtları · İstanbul</span></footer>
      <MobileBottomNav screen={screen} onScreen={onScreen} />
      {utility && <UtilityDrawer panel={utility} onClose={() => setUtility(null)} onScreen={onScreen} />}
    </section>
  );
}

export default function DesignLabPage() {
  const [direction, setDirection] = useState<Direction>("notebook");
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
