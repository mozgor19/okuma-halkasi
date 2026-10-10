# Mobil Uygulama Devir Belgesi

Hazırlanma tarihi: 10 Ekim 2026. İncelenen web sürümü: `7ee2fa0`.
Bu belge mevcut kodun envanteridir; mobil uygulamanın hazır olduğu anlamına gelmez.
Kod değiştikçe belgeyi ve [kabul listesini](MOBILE_ACCEPTANCE.md) birlikte güncelle.

## Hedef ve çalışma anlaşması

- Kitap Tahlil & İstişare uygulamasını aynı özelliklerle iOS ve Android'e taşı.
- Mevcut web uygulamasını, kullanıcı hesaplarını ve verileri koru. Mümkünse aynı backend'i kullan.
- Defter, Dergi, Katalog ve Minimal şablonlarını; gündüz, gece ve sistem görünümünü koru.
- Tasarımı yalnızca benzer renklerle yeniden yorumlama; `/design-lab` ve canlı ekranları karşılaştır.
- Kullanıcı geçmişte özellikle form çerçeveleri, giriş ikonları, düşük kontrast,
  taşan mobil metinler ve referans tasarımdan sapma konusunda sorun yaşadı.
  Bu alanlar açık kabul kriterleri olmalı; derlemenin geçmesi görsel doğrulama değildir.
- Kullanıcının çalışma tercihi: tamamlanan, doğrulanan değişiklikleri commit edip push et.
  Bu tercih üretim veritabanında kontrolsüz migration veya mağazaya yayın izni değildir.
- Eski konuşmanın ve ekli ekran görüntülerinin tamamının yeni oturuma geleceğini varsayma.
  Yazılı olmayan bir görsel karar gerekirse kullanıcıdan ilgili referansı yeniden iste.
- Bu devir aşamasında mobil framework seçilmedi, bağımlılık kurulmadı ve mobil kod yazılmadı.

## Yeni oturumda başlangıç

Yeni oturumu bu repo üzerinde aç. Ayrı worktree kullanılacaksa bu belgelerin bulunduğu
commit'ten başla. Ayrı mobil repo kullanılacaksa web kaynaklarına da erişim sağla.
Önce `AGENTS.md`, bu belge, kabul listesi ve `README.md` okunmalı; ardından güncel
`git status`, kaynak kod ve migration durumu kontrol edilmeli.

Yeni oturumun ilk mesajı için:

```text
Bu projeyi mevcut web uygulamasının tüm özelliklerini koruyarak iOS ve Android
uygulamasına dönüştür. Önce AGENTS.md, docs/MOBILE_HANDOFF.md,
docs/MOBILE_ACCEPTANCE.md ve README.md dosyalarını oku; envanteri güncel kodla doğrula.
Webi, hesapları ve mevcut verileri bozma. Dört tasarım şablonu ve gece/gündüz
görünümünde Design Lab'a sadık kal. Önce mimari seçenekleri ve kritik mobil
uyumluluk risklerini değerlendir, önerdiğin yaklaşımı gerekçesiyle sun; sonra
uygulamayı aşamalar halinde geliştir. Kabul listesindeki her özellik için iOS ve
Android doğrulama kanıtı tut. Eksik özellikleri tamamlanmış sayma. Tamamlanan ve
doğrulanan değişiklikleri commit edip push et. Mağaza yayını ve üretim migration'ı
öncesinde hedef ortamı ve gerekli yetkiyi ayrıca doğrula.
```

## Mevcut mimari

| Alan | Kaynak / davranış |
| --- | --- |
| Çalışma ortamı | React 19, TypeScript, vinext/Vite; Next uyumlu API'ler ve Cloudflare Workers |
| Sürümler | Güncel kesin sürümler ve Node gereksinimi için `package.json` ve `pnpm-lock.yaml` |
| Veritabanı | Cloudflare D1, `DB` binding; `db/database.ts`, `db/schema.ts` |
| Veri yükleme | `db/store.ts`, `app/api/state/route.ts`; tek `AppData` yanıtı, `no-store` |
| Canlı ekranlar | `app/page.tsx`: `home`, `archive`, `roadmap`, `meeting`, `profile` |
| Giriş | `app/login/page.tsx`, `proxy.ts`, `lib/auth.ts`, `db/accounts.ts`, `lib/password.ts` |
| Profil | `components/profile-view.tsx` |
| Tasarım | `app/themes.css`, `app/globals.css`, `app/design-lab/` |
| İkonlar | `components/icons.tsx`, `components/ui/` içindeki Hugeicons kaynakları |
| Hosting | `vite.config.ts`, `.openai/hosting.json`, `scripts/run-framework.mjs` |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `public/icons/notebook-*`, `scripts/generate-app-icons.mjs` |

D1, Worker `env`, DOM/CSS, tarayıcı `File`/canvas ve service worker bağımlılıklarını
native istemciye doğrudan kopyalama. Veri tipleri ve saf iş kuralları paylaşılabilir;
sunucu sırları ve veritabanı bağlantısı yalnızca backend'de kalmalı.

## Özellik envanteri

| Alan | Korunacak işlevler | Kaynak |
| --- | --- | --- |
| Ana sayfa | Bu haftaki, sıradaki veya son buluşmanın seçimi; arşiv özeti; yönetici için üst alanda yeni buluşma oluştur eylemi ve uyumlu etiket | `app/page.tsx`, `lib/meeting-time.ts` |
| Navigasyon | Ana sayfa, Buluşmalar, Plan, Profilim; geri hareketi; toplantı linkinden doğru kayda geçiş; yönetici/katılımcı görünümü | `app/page.tsx` |
| Arşiv | Buluşma listesi, kitap bilgileri, kayıt açma; silinen kayıtların aktif listelerden ayrılması | `app/page.tsx`, `db/store.ts` |
| Buluşma yönetimi | Oluşturma/düzenleme/silme; tarih-saat, yer, harita, not, okunan bölüm, tamamlandı/devam ediyor durumu | `app/page.tsx`, `app/api/action/route.ts` |
| Kitaplar | Open Library başlık/ISBN araması, elle künye, kapak, yazar, yayınevi, sayfa, kaynak linki; kayıtlı künye düzenleme | `components/book-edit-dialog.tsx`, kitap arama API'si |
| Devam buluşması | Aynı `bookId` ile bölüm bilgili yeni oturum; kitap oturumlarının ilişkisinin ve sıra bilgisinin korunması | `components/continuation-dialog.tsx`, `app/page.tsx` |
| Katılım/değerlendirme | Okudum/kısmen okudum/okumadım; kaldığım sayfa; 1-10 puan; yorum; ortalama ve kişi bazlı sonuçlar | `app/page.tsx`, `review` action |
| Katılımcılar | Yönetici üye ekleme; yalnızca ilgili buluşmaya bağlı misafir; henüz belirtilmeyen okuma durumu | `addAttendance`, `addGuest` actions |
| Paylaşım ve RSVP | Sistem paylaşımı veya link kopyalama; `/?meeting=<id>`; girişten sonra linke dönme; Geliyorum ekle/kaldır; sayı/isim özeti | `app/page.tsx`, `proxy.ts`, `setMeetingRsvp` |
| Fotoğraflar | Yükleme, küçültme, galeri, büyütme, yönetici silme, tüm albümü ZIP indirme | `components/photo-lightbox.tsx`, `app/page.tsx`, upload API'si |
| Yüz önerileri | Yerel model, rızalı referanslar, tek yüz kontrolü, fotoğraftan aday önerme, yönetici onayından sonra katılım | `lib/face-recognition.ts`, `components/attendance-suggestion-dialog.tsx` |
| Plan ve oylama | Her üye kitap önerebilir; yönetici tarih belirleyebilir; kişi başına tek oy, oy geri alma/değiştirme; açık/gizli oylar; sıfırlama; planı buluşmaya taşıma | `app/page.tsx`, action API'si |
| Genel arama | Kitap, yazar, konum, not, bölüm ve yorum dahil mevcut kayıtları Türkçe normalize ederek arama | `components/global-search-dialog.tsx` |
| Bildirimler | Yeni/yaklaşan buluşma ve eksik değerlendirme kayıtları; kayda geçiş; cihaz bildirim izni | `components/notification-center.tsx`, `public/sw.js` |
| Takvim/harita | Oturum korumalı ICS indirme, harita ve kitap kaynağını açma | `app/api/calendar/[meetingId]/route.ts`, `app/page.tsx` |
| Profil | Özet/istatistikler; Kitaplarım: favoriler ve okuma; Galerim; Görünüm; Güvenlik; Yüz verisi; yönetici Çöp kutusu; ana yönetici Yönetim | `components/profile-view.tsx` |
| Hesap | Avatar, parola değiştirme, çıkış, oturum sürümüyle eski oturumların iptali | auth API'leri, upload API'si |
| Çöp kutusu | Buluşma/plan soft delete, geri yükleme; ana yönetici kalıcı silme | `restoreTrash`, `purgeTrash` actions |
| Görünüm | Dört şablon, açık/koyu/sistem; tercihin cihazda kalıcı olması; navigasyondan mod kontrolü | appearance bileşenleri, `app/layout.tsx` |

## İş kuralları ve yetkiler

- Roller: `member`, `admin`, `super_admin`. `isAdminRole` her iki yönetici rolünü kapsar.
- Normal üye kendi değerlendirmesini, favorisini, oyunu, RSVP'sini, avatarını,
  parolasını ve yüz referansını yönetir; kitap önerebilir ve fotoğraf yükleyebilir.
- Yönetici buluşma/künye/katılımcı/oylama/çöp kutusu geri yükleme/fotoğraf silme
  işlerini yönetir. Görünümde yönetici araçlarını gizlemek sunucu yetkisinin yerine geçmez.
- Yalnız ana yönetici rol atayabilir, kalıcı silme yapabilir ve başkasının yüz
  referansını değiştirebilir/kaldırabilir. Başka bir ana yöneticinin rolünü değiştiremez.
- `read` veya `partial` için puan zorunlu; `unread` için puan isteğe bağlı.
  Puansız kayıt mevcut değerlendirmeyi siler. Yorum yalnız puanla birlikte kaydedilir.
  `unselected`, yönetici eklemesinin başlangıç durumudur; değerlendirme seçeneği değildir.
- Sayfa değeri tamsayı, en az 0; kitap sayfası biliniyorsa onu aşamaz.
- Tek üyenin tek roadmap adayı için aktif oyu olur; yeni oy eskisinin yerini alır.
  Gizli oylamada normal üye için başka oy sahiplerinin kimliği API'de maskelenir.
  Bu davranış oy sayılarını gizlemek veya oylamayı kapatmakla aynı şey değildir.
- Plan buluşmaya taşındığında aynı kitap korunur; roadmap kaydı ve ona bağlı oylar silinir.
- RSVP, fiilî katılım ve değerlendirmeden ayrı kayıttır; biri diğerini otomatik yaratmaz.
  Yalnız oturum sahibi kendi RSVP'sini değiştirir; birleşik anahtar tekrar sayımı engeller.
- Paylaşım/RSVP gelecekteki buluşmalarda ve buluşma günü boyunca gösterilir.
  Mevcut kapanış kuralı `23:59:59+03:00`; yalnız başlangıç saatinde kapanmaz.
  Geçmiş buluşmada RSVP değişikliği sunucudan `409` döner.
- Buluşma tarihi API'de saat dilimi içermeyen `YYYY-MM-DDTHH:mm`, plan tarihi
  `YYYY-MM-DD` biçiminde. Mevcut tarayıcı hesapları yerel saat kullanırken RSVP
  kapanışı +03:00 kullanıyor. Mobilde farklı saat dilimi davranışını açıkça kararlaştır
  ve test et; eski verileri sessizce UTC olarak yorumlama.

## API sözleşmesi

| Yol | Yöntem / önemli alanlar |
| --- | --- |
| `/api/auth/login` | POST JSON `{ username, password }`; `okuma_session` HttpOnly çerezi |
| `/api/auth/logout` | POST; oturum çerezini kaldırır |
| `/api/auth/change-password` | POST JSON `{ currentPassword, newPassword, confirmPassword }`; yeni oturum sürümü ve çerez |
| `/api/state` | GET; `lib/types.ts` içindeki `AppData`, oturumdan `currentMemberId` |
| `/api/action` | POST JSON `{ action, ...payload }`; aşağıdaki eylemler |
| `/api/books/search?q=...` | GET; sorgu 3-100 karakter; en çok 5 Open Library sonucu; zaman aşımı/hata ve elle giriş yolu |
| `/api/upload` | POST multipart `file`, `purpose`; fotoğraf için `meetingId`, yüz için `targetMemberId` |
| `/api/media/<key>` | GET; oturum korumalı görsel baytları |
| `/api/calendar/<meetingId>` | GET; oturum korumalı ICS |

`/api/action` payload alanlarının kesin tipleri ve validasyonları route dosyasındadır:

| Action | Temel payload / yetki |
| --- | --- |
| `createMeeting` | `book` veya `bookId` veya `planId`, `date`, `location`, `mapUrl`, `note`, `readingScope`, `bookStatus`; yönetici |
| `createPlan` | `book`, isteğe bağlı `date`, `note`; üye, tarih yalnız yönetici |
| `editMeeting` / `editBook` | `meetingId` + buluşma alanları / `bookId`, `book`; yönetici |
| `review` | `meetingId`, `readingStatus`, `rating`, `comment`, `currentPage`; kendi hesabı |
| `setMeetingRsvp` | `meetingId`, `active`; kendi hesabı |
| `toggleFavorite` | `bookId`, `active`; kendi hesabı |
| `voteBook` | `roadmapId`, `active`; kendi hesabı |
| `setVoteVisibility` / `clearBookVotes` | `voteVisibility`: `open`/`secret` / ek alan yok; yönetici |
| `addAttendance` / `addGuest` | `meetingId`, `targetId` / `meetingId`, `guestName`; yönetici |
| `confirmDetectedAttendance` | `meetingId`, `targetIds`; yönetici |
| `deleteMeeting` / `deletePlan` / `deletePhoto` | `meetingId` / `planId` / `photoId`; yönetici |
| `restoreTrash` / `purgeTrash` | `trashType`: `meeting`/`plan`, `targetId`; yönetici / ana yönetici |
| `setMemberRole` | `targetId`, `role`: `admin`/`member`; ana yönetici |
| `clearFaceReference` | `targetId`; kendisi veya ana yönetici |

Upload amaçları: `cover`, `photo`, `avatar`, `faceReference`. Sunucu imza kontrolüyle
JPEG/PNG/WebP kabul eder; işlenmiş görsel en fazla 1.800.000 bayt olabilir.
Web ham görseli 8 MiB ile sınırlar ve gerektiğinde canvas ile küçültür.
Mobilde medya URL'lerine API origin'i ekle; korumalı resim isteklerinde oturumun
taşındığını doğrula. Mobil fotoğraf biçimleri/döndürme için dönüştürme gereksinimini test et.

Çoğu action başarıda `{ ok: true }`, hata durumunda `{ error }` döner; `createMeeting`
ayrıca `meetingId` verir. `400`, `401`, `403`, `404`, `409`, `413`, `502`, `503`
durumlarını uygun akışlarda ele al. Web mutasyon sonrası state'i yeniden yükler;
mevcut sistemin gerçek zamanlı abonelik veya offline yazma kuyruğu olduğunu varsayma.

## Mobilde ayrıca çözülmesi gerekenler

1. Mimariyi seçmeden native istemci ve web tabanlı kabuk seçeneklerini bu envantere
   göre değerlendir; güncel birincil framework belgeleriyle uyumluluğu doğrula.
   Yeni kodun yerini ve paylaşılacak modülleri yazılı bir mimari kararıyla belirle.
2. Backend bugün same-origin, HttpOnly çerez temellidir; bearer-token API'si yoktur.
   Native HTTP, korumalı resimler ve WebView çerezlerinin birlikte çalışacağını varsayma.
   Oturum yenileme/sona erme, parola değişimi ve güvenli cihaz saklamasını tasarla.
   WebView/cross-origin seçilirse CSP `connect-src 'self'`, CORS ve Origin kontrollerini
   güvenlik sınırlarını gevşetmeden değerlendir. Sırları uygulama paketine koyma.
3. Gerçek arka plan push altyapısı yoktur: mevcut React effect'i izin verildiğinde
   `showNotification` çağırır; `sw.js` yalnız bildirim tıklamasını yönetir.
   Cihaz tokenı, APNs/FCM bağlantısı ve sunucudan olay yayını ayrı geliştirme işidir.
   Yeni buluşma push'unu uygulama kapalıyken iki platformda test et.
4. `/?meeting=<id>` paylaşım linklerini koru; oturum açma dönüşünü, soğuk başlangıcı,
   kurulu/kurulu olmayan uygulama davranışını ve notification deep link'ini tasarla.
   Alan adı doğrulaması ve native bağlantı yapılandırması henüz yoktur.
5. Fotoğraf seçme/çekme, izinler, boyut/biçim dönüşümü, sistem paylaşımı, ZIP ve ICS
   dışa aktarımı, harita açma native adaptörler gerektirebilir. İzin reddi işlevi çökertmemeli.
6. Yüz eşleştirme `@vladmandic/human`, WebGL ve DOM kullanır; native uyumluluğu
   doğrulanmadı. Teknik yaklaşımı ayrıca kanıtla; bu özelliği sessizce kaldırma.
   Fotoğraflar/vektörler harici AI servisine gönderilmemeli; vektörler kalıcı saklanmamalı.
   Bu özellik giriş biyometrisi değildir; rıza ve yönetici onayı korunmalı.
7. Çevrimdışı çalışma kapsamını açıkça belirle. Şu anda service worker'da offline
   cache/sync yoktur. Bağlantı yokken kaydedilmemiş işlemi başarılı göstermemek asgari şarttır.
8. Paket kimlikleri, desteklenen OS sürümleri, imzalama, mağaza hesapları ve test
   cihazları henüz belirlenmedi. Mevcut Linux ortamında iOS derleme/test olanağını
   ayrıca doğrula. Mağaza yüklemesini kodun tamamlanmasından ayrı bir aşama olarak takip et.

## Tasarımın kaynağı ve hassas noktalar

- `AGENTS.md` üç katmanlı tema sözleşmesini tanımlar: palette, semantik roller, bileşenler.
  Native karşılığı kurulursa aynı rol ayrımını koru; şema bazlı okunabilirlik yamaları ekleme.
- Şema kimlikleri `editorial`, `catalogue`, `notebook`, `minimal`.
  Varsayılan `notebook`; renk modu `light`, `dark`, `system`.
  Web cihaz tercihleri `kitapTahlilScheme`, `kitapTahlilColorMode` anahtarlarında tutulur.
- Defter: çizgili kâğıt, kenar çizgisi, sarı etiketler, konturlu eylemler,
  kayıt satırları, bölünmüş profil istatistikleri; mobil alt navigasyon.
  Aktif/pasif navigasyon şeritlerini Design Lab ile karşılaştır.
- Ana sayfa üst eylemi yönetici için yeni buluşma oluşturmalıdır; etikette arşivden
  yazıp oluşturma eylemi göstermemeli. Geçmiş kayıtlar zaten aşağıda listelenir.
- Giriş ikonları ayrı, ortalı hücrede; metin ikona binmemeli. Autofill ve odak rengi
  alanı iki ayrı kutu gibi göstermemeli. Web düzeltmelerinin kaynağı `app/themes.css`.
- Input/select/düğmeli birleşik alanlarda tek kesintisiz dış çerçeve ve tutarlı odak,
  yeterli iç boşluk, okunur placeholder/etiket, devre dışı ve hata durumları gerekir.
- Görselleri gece modu için ters çevirme. Metin kontrastı en az 4.5:1;
  kontrol/işaret/odak göstergeleri en az 3:1. Büyük yazı ve küçük ekranda taşma olmamalı.
- Hugeicons ailesini koru; native ikon/animasyon uyarlamasını doğrula, ikinci aile ekleme.
  Hareket azaltma tercihi ve erişilebilir adlar korunmalı.
- Yeni kimlik görselleri `public/icons/notebook-*` ve `public/favicon.svg` içindedir.
  Native ikon/splash çıktılarının ayrıca üretilip cihazda doğrulanması gerekir.

## Veritabanı ve bilinmeyen üretim durumu

- SQL migration sırası `README.md` içinde: `0000` ile `0007` arasındaki dosyalar.
  Yeni istemci için ayrı üye/katılım veritabanı oluşturma; önce mevcut D1'i incele.
- `drizzle/meta/_journal.json` yalnız `0003`'e kadar kayıt içeriyor; sonraki SQL'lerin
  uygulanmış olduğunu journal'dan çıkarma ve migration'ları körlemesine yeniden çalıştırma.
- Önceki çalışmada `0007_meeting_rsvps.sql` yerelde test edildi; ajan üretime
  uygulayamadı çünkü Cloudflare API yetkisi yoktu. Bugünkü üretim durumu doğrulanmadı.
  Kullanıcı sonradan uygulamış olabilir; table/alanları hedef ortamda kontrol et.
- State'in eksik migration fallback'i vardır; `clubFeaturesReady` ve `rsvpFeaturesReady`
  false olabilir. UI'nin açılması tüm özelliklerin çalıştığının kanıtı değildir.
  RSVP hazır değilse web Geliyorum düğmesinde Hazırlanıyor gösterir.
- `SESSION_SECRET` yalnız sunucuda kalır. `MEMBER_CREDENTIALS` başlangıç hesap
  geçişi için eski bir mekanizmadır; gerçek değerleri belgeye, commit'e veya mobil pakete koyma.
- Parolalar PBKDF2-SHA-256 hash/salt ile saklanır. Yeni hash 100.000 iterasyon;
  beş hatalı giriş 15 dakika kilit; oturum çerezi 30 gün ve hesap sürümüyle doğrulanır.
  Mobil için hesap güvenliğini veya eski kullanıcıların girişini zayıflatma.
- Genel kullanıcı kayıt/şifre sıfırlama ekranı, native push, native deep link ve
  offline senkronizasyon mevcut özellik diye varsayılmamalıdır.

## Doğrulama ve teslim sırası

1. Envanteri kodla doğrula; üretimden bağımsız yerel test verisini hazırla.
2. Mimari karar ve kısa bir uçtan uca kanıt: giriş, korumalı state/media,
   bir buluşma açma, RSVP ve paylaşım linkinden giriş sonrası dönüş.
3. Kabul listesindeki bütün özellikleri taşı; web API değişirse web regresyonlarını çalıştır.
4. Her şema/mode için screenshot ve işlevsel test; her iki OS için ayrı sonuç ve kanıt.
5. İzin, bağlantı, saat dilimi, rol ve eski/eksik backend şeması senaryolarını dene.
6. Debug derlemesi, gerçek cihaz/simülatör testleri, release derlemesi ve mağaza
   teslimini ayrı kaydet. Uygulanamayan testleri dürüstçe açık bırak.

Mevcut web kontrol komutları, Node 22.13+ ve pnpm ile repo kökünde:

```bash
pnpm check:ui
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

`pnpm check:ui` kaynak/CSS sözleşmesi ve bazı sabit kontrast kontrolleridir;
tarayıcı E2E, tüm hesaplanmış renklerin kontrast testi veya native test değildir.
Repo şu an tam özellik kapsamlı bir otomatik E2E test paketi içermez.
Native test/derleme komutları teknoloji seçildikten sonra eklenecek.
Notebook web regresyonunda 1440px ve 390px, açık/koyu; Home, Plan, Meeting ve
bütün Profile sekmelerini kontrol et. Dört şema için mobil kabul listesi ayrıca uygulanır.
