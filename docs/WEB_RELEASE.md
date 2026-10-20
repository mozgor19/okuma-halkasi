# Koru Web/PWA Yayını

19 Ekim 2026. Öncelik web, telefon tarayıcısı ve ana ekrana kurulan PWA'dır.
Native uygulama ve Google Play yayını sonraki aşamadır. Bu belge bir yayın
onayı veya hatasızlık/güvenlik garantisi değildir. Canlıya otomatik çıkılmaz.

19 Ekim ek kabul planı: [sekiz deneyim başlığı](WEB_EXPERIENCE_ACCEPTANCE.md).
Mevcut testleri tekrar saymak yerine eksik akışlar için `web-experience` ve
`web-updates` zorunlu adımları eklendi. `0011_account_experience.sql` henüz
uzak ortamda uygulanmadı. Tur ve silme talebi yerel özelliklerdir; kalıcı
çoklu-D1 silme ve fiziksel cihaz kabulü henüz tamamlanmış değildir.

Ücretsiz origin ve güncel genel yayın hazırlığı:
[WEB_PUBLIC_LAUNCH.md](WEB_PUBLIC_LAUNCH.md).

19 Ekim sonraki ölçüm: onaylı izole uzak Worker 100k'yı destekledi, 200k ve
600k'yı runtime sınırıyla reddetti; kaldırıldığı ve asıl Worker'ların
değişmediği doğrulandı. [Yerel Firebase adayı](FIREBASE_AUTH_PLAN.md) yalnız
sentetik prototip olarak onaylandı, üretim parola engelini henüz kapatmaz.
[Yerel silme servisi](ACCOUNT_ERASURE.md) 13 odaklı testle eklendi; korumalı
işletim, sağlayıcı eşgüdümü ve yedek/restore kabulü hâlâ eksik.

## Şu Anki Karar

**Genel kullanıma yayın kapalı kalmalı.** Yerel regresyon başarısı; canlı
migration, fiziksel cihaz, bağımsız güvenlik, kalıcı posta ve hukuki kabulün
yerine geçmez. Üretim DB'si ve Worker'ı açık operatör onayı olmadan değiştirilmez.

## Otomatik Kontrol

Node 24 ve pnpm 11 kullanılır:

```bash
corepack pnpm test:release
node scripts/security-audit.mjs
corepack pnpm web:release:check --suite=outputs/release-tests/TEST_ID/suite-report.json --evidence=.sites-runtime/web-release-evidence.json
```

İlk komut her koşuda izole sentetik D1'ler kurar; mevcut yerel/canlı veri
sıfırlanmaz. Tip, lint, build, birim, API yetki/izolasyon, mevcut dört görünüm,
eski web, çoklu grup, hesap/kurtarma ve Koru PWA testlerini çalıştırır.
Son komut salt okunurdur, deploy yapmaz. Şunlarda başarısız olur:

- Kaynak revision/digest farklıysa veya çalışma ağacı commit edilmemişse.
- PWA adımı dahil zorunlu adımlar geçmediyse; web raporu yedi günden eskiyse.
- Web üretim bağımlılığında high/critical bulgu varsa veya audit bir günden eskiyse.
- İncelenmiş HTTPS origin, aşağıdaki insan/cihaz kanıtları ve operatör onayı yoksa.
  Onaylı ücretsiz üretim Workers adresi kabul edilir; staging edilmez.

Audit bir paketin yüklü olduğunu saptar; ilgili zafiyetin bu uygulamada
gerçekten sömürülebildiğini tek başına kanıtlamaz. Web/mobil yolları ayrılır;
mobil açıkları native yayın öncesi ayrıca kapatılır. Dev/build araçları,
paket kilidi ve Worker çıktısı bağımsız güvenlik incelemesinin de kapsamındadır.
Koru script-src/nonce katmanı eklendi; yerel üretim tarayıcısında saldırgan
inline HTML, sahte nonce ve hydration sınanır. Uzak Turnstile ve bağımsız
güvenlik kabulünün yerine geçmez.
18 Ekim ilk taramasındaki Next/sharp/source-map-js web high/critical
uyarıları yama güncellemeleriyle giderildi; bu yalnız paket taramasının
kapsamıdır. Mobil araç zincirindeki uyarılar ve native React/RSC peer
uyumluluğu native çalışma tekrar açıldığında ayrıca değerlendirilmelidir.

## Yayını Durduran İşler

| İş | Gerekli Kanıt |
| --- | --- |
| Onaylı origin | Ücretsiz üretim Workers adresi onaylandı; canonical, Turnstile ve posta aynı origin'i kullanmalı. Özel alan adı geçişi ayrıca onaylanır |
| Android Chrome PWA | Gerçek telefonda yükle, standalone aç, oturum/grup değiştir, geri/klavye/safe-area/çıkış/offline/güncelleme |
| iPhone Safari PWA | Gerçek iPhone'da ana ekrana ekle, tam ekran aç; aynı oturum/form/güncelleme kontrolleri |
| Paylaşım | WhatsApp, Telegram, Facebook/LinkedIn gibi hedeflerde gerçek URL önizlemesi; dar kırpma ve yeniden tarama |
| Görsel son okuma | Dört şema × açık/koyu, 390 ve 1440 px; Notebook Home/Plan/Meeting/tüm Profile sekmeleri; ayrıca 320/430 px ve 200% büyütme |
| Performans/erişilebilirlik | Üretim derlemesiyle mobil yavaş ağ/CPU ölçümü; yükleme/yerleşim kayması, klavye/ekran okuyucu, odak ve karşıtlık incelemesi; hata bütçesi ve izleme |
| Parola saklama | Workers CPU/runtime ölçümü ile modern maliyet; mevcut hesapları kaybetmeyen sürümlü hash geçişi |
| Kalıcı e-posta | Gmail test OAuth süresine dayanmayan düzen, kota/hata takibi, teslim ve kurtarma kabulü |
| Gizlilik/silme | Gerçek saklama süreleri, dış sağlayıcılar, hesap silme/export, biyometrik özellik/rıza kararı ve yetkili hukuki inceleme |
| Yedek/geri dönüş | Mevcut tek DB için şifreli yedek ve izole uzak restore geçti; medya/değer eşleşmesi doğrulandı. Tam RPO/RTO, anahtar/saklama, çoklu-D1 ve silme tekrarı açık: BACKUP_RESTORE.md |
| Kapasite/izleme | D1/Worker/medya/posta kotaları, dolu grup havuzu davranışı, alarm ve destek süreci |
| Migration/rollback | Canlı şema salt okunur envanteri, yedek, geriye uyumlu SQL, sürüm rollback ve veri kurtarma ayrımı |
| Güvenlik incelemesi | Oturum/grup/rol, CSRF, XSS, upload/medya, rate limit, bağımlılıklar, sırsız log, CSP, cache ve hesap kurtarma |

100.000 olan eski parola varsayılanı korunur. `PASSWORD_HASH_ITERATIONS=600000`
yalnız doğrulanmış çalışma zamanı için adaydır; yerel testte CAS yükseltmesi
ve standart vektör sınandı, uzakta açılmadı. Node API de aynı üretim PBKDF2
sınırına tabidir. Genel Koru kaydı eski maliyetle açılmaz; modern parola
mimarisi/runtime kararı gerçek bir yayın engelidir, yalnız sayı değiştirerek
veya yerel testi uzak CPU kanıtı sayarak kapanmaz.
[OWASP parola saklama](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Gmail test yetkisinin yedi günlük süresini tarih değiştirerek uzatma.
Staging'de iki grup oluşturma havuzu doludur; bunları sıfırlayıp gerçek
grupları kaybetme. Bir DB/grup mimarisi genel kayıt kapasitesi açısından
ayrıca planlanmalıdır. Ücretsiz kullanım sınırsız kullanım değildir.

## PWA ve Cache Sözleşmesi

Koru manifesti `/koru.webmanifest`, worker `/koru-sw.js`, kapsam ve ID `/`.
Kurulum adı ve simgesi gruptan bağımsızdır. İstemci kurulumu bildirim iznine
bağlı değildir. Android yükleme komutu yalnız gerçek `beforeinstallprompt`
olayı geldiğinde hesap menüsünde görünür. iPhone Safari sistem paylaş menüsünde
**Ana Ekrana Ekle** kullanılır; tarayıcı desteği fiziksel cihazda kaydedilir.
[Web.dev kurulum](https://web.dev/learn/pwa/installation).

Service worker yalnız `/offline.html` genel kabuğunu, kimlik bilgisi olmadan
önbelleğe alır. Navigation her zaman ağı dener. API/POST/medya yakalanmaz;
hesap, kitap, grup, HTML oturumu, davet veya parola verisi cache'e yazılmaz.
Offline ekranında kayıt yapılmış gibi davranılmaz. Güncelleme formu zorla
yenilemez; önceki sürümün tüm pencereleri kapanınca yeni worker etkinleşir.
Eski webin `/sw.js` bildirim işlevi ayrı korunur.
Cloudflare `.html` adreslerini kısa adrese yönlendirebilir; worker çevrimdışı
kabuğun son adresini ve MIME türünü doğrulayıp yeni bir Response olarak
saklar. Aksi halde yönlendirilmiş cache yanıtı gerçek HTTPS çevrimdışı
gezinmesinde başarısız olur. Hem birim hem HTTPS staging testi bunu kapsar.

Mobil tarayıcı/PWA çerezleri her platformda aynı depoyu paylaşmayabilir;
ilk kurulumda yeniden giriş gerekmesi veri kaybı değildir. Aynı hesaba giriş,
aynı sunucu kayıtlarını getirir. Alan adı değişimi yeni origin ve ayrı çerez
deposudur; eski oturumun otomatik taşınacağı söylenmez.

Statik başlıklar `public/_headers`, SSR/API başlıkları `proxy.ts` içindedir.
Cloudflare statik dosya kuralları Worker tarafından üretilen yanıtları
kendiliğinden kapsamaz; ikisi ayrı HTTPS kabulü gerektirir.
[Cloudflare başlıkları](https://developers.cloudflare.com/workers/static-assets/headers/).

## Kanıt Dosyası

`docs/web-release-evidence.example.json` şeması yalnız şablondur, onay değildir.
Özel kanıt dosyasını `.sites-runtime/` altında tut. Her kontrol için `passed`,
inceleyen kişi, ISO tarih ve `outputs/web-acceptance/` altında mevcut, gizli
bilgi içermeyen kanıt dosyaları gerekir. Cookie/token/özel URL/parola kaydetme.
Kanıtlar aynı `commit` ve `sourceDigest` ile bağlanır; en çok yedi günlük olur.
Bu bir insan onay kaydıdır, kriptografik bir denetim imzası değildir.

GitHub web regresyon işi PWA testini içerir. Mevcut Android regresyon işi
korunur; web önceliği, native kalite kontrolünü silmek demek değildir.
Otomatik deploy/push entegrasyonu ayrıca incelenmeden commit'i main'e göndermek
yayın onayı sayılmaz. Canlı dağıtım otomasyonu henüz bu kapıya bağlanmış değildir;
operatör bunu atlayarak panelden dağıtım yapmamalıdır.

## Yayın Sırası

1. Onaylanan ücretsiz origin'i kullan; alan adı ileride seçilirse yenileme ve geçiş planını ayrıca değerlendir.
2. Kalıcı posta, parola, veri yaşam döngüsü ve kapasite engellerini kapat.
3. Sabit revision için izole test, audit ve staging dağıtımı yap.
4. Gerçek Android/iPhone ve sosyal önizleme kanıtlarını tamamla.
5. Üretim yedeği ve salt okunur şema incelemesini onayla; migration/rollback planını değerlendir.
6. Yayın kapısını çalıştır, operatörün ayrı açık dağıtım onayını al.
7. Kontrollü canlı dağıtım, gerçek HTTPS smoke testi, izleme ve destek nöbeti.
# First Public Launch Decision: October 20, 2026

Mustafa explicitly declined the proposed six-account restricted opening and
requested public access with best-effort safeguards. This is NOT a passing
standard release gate. `first-public-launch-policy.mjs` records the exception
separately, pinned to the exact clean commit/source digest and dated operator
proof. Outstanding manual criteria remain pending; failed criteria cannot be
waived. Automated suite, dependency audit, exact origin, account preservation,
schema/backup/runtime policy and operator approval stay mandatory. Later
releases continue to use the existing strict gate.

`scripts/deploy-production.mjs` separates preflight, maintenance, migrate and
open. Writes require `--confirm=koru-public-production`; maintenance/open also
require revision-matching `--suite=`, `--evidence=` and `--decision=` artifacts.
No main push, staging import, synthetic remote account/mail, fee or paid plan.
First deploy blocks application requests. After drain, export-only encrypted
backup + offline restore/rehearsal precede atomic reviewed 0008-0014 SQL.
Every original table/row/type/media/sequence and exact new seed is compared.
Two permanent empty production group DBs are created, never reused staging DBs.
Only root/www Custom Domains are configured; mail DNS is not managed by this
tool. Runtime secrets remain Worker Secrets. Existing accounts retain IDs,
hashes/roles/content and must prove ownership to link to Firebase, never import
by guessed email. On migration failure keep maintenance and fix forward; never
restore an old backup over subsequent writes automatically.

The tool never creates a Firebase user or sends mail. Physical phone PWA,
production mail, provider/admin erasure, independent legal review, sustained
capacity and full multi-DB recovery remain separately evidenced operational
work. Do not describe these as verified merely because the site opens.

## Shared Group Update: Explicit One-Time Decision

Later October20 Mustafa separately replied: "Evet, yalnız bu güncelleme için
belirtilen riskleri kabul ederek yayınla" after being told the13 manual criteria
remain unproven. This supersedes the strict-gate-only hold for THIS update, not
for future work. `shared-update-policy.mjs` accepts only a new revision/digest/
0015-migration-bound decision, exact pending list, real operator proof, a clean
pushed work branch, the fixed baseline, allowlisted shared-storage paths and an
unchanged package/dependency graph. Technical failures and failed manual evidence
remain blocking. The standard gate is unchanged and continues to report missing
manual checks. Never relabel them passed or reuse the consumed first-launch decision.

This shared-update exception is now CONSUMED by source `d6a1c4d`, live Worker
`fc31de5a-5c8f-4e7b-9645-81f151453374`, journal838d658f (20:18UTC).
The full clean suite/audit, fresh encrypted backup, offline rehearsal and exact
old-data preservation passed; thirteen manual categories remain pending. Do
not replay0015 or use this decision as authority for another release.
