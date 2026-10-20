# Firebase Auth: Prototip ve Geçiş Planı

**20 Ekim son durum:** Operatör ayrı üretim projesini `koru-951bf` olarak
oluşturdu, Spark/Email-Password teyit etti ve web yapılandırmasını sağladı.
Salt okunur proje/uygulama/`birkoru.com` kontrolü geçti.
[Üretim hazırlığı](FIREBASE_PRODUCTION.md). Yerel entegrasyon canlı sağlayıcı
entegrasyonuna çevrilmiş değildir; aşağıdaki prototip geçmişi bunun yerine geçmez.

20 Ekim 2026 güncellemesi: Mustafa **ayrı, ücretsiz Spark test projesi
kurulumunu** açıkça onayladı; önceki yalnız-yerel bekletme bu aşama için kalktı.
Operatörün bildirdiği proje kimliği `koru-auth-test`, proje numarası
`1038145971577`. Numara proje kimliği yerine kullanılmaz. Oluşturma operatörün
Google Console oturumunda yapıldı; operatör Email/Password için Enabled
durumunu ve Spark planını teyit etti. Mevcut giriş/kayıt
ekranı henüz Firebase kullanmaz.

Gerçek hesap aktarımı öncesinde ayrı geçiş planı sunulacak. Eski canlı veri
korunacak, staging verisi TAŞINMAYACAK. Gerçek kullanıcıları test projesine
aktarmak, servis hesabı/Secret yüklemek veya ücretli plan açmak bu onaya dahil
değildir. Güvenlik testleri geçmeden genel yayına çıkılmaz.
Veri geçişinin doğrulanmış kapsamı: [PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md).

## Neden Değerlendiriliyor?

Ayrı, bağsız `koru-password-probe` Worker'ında yalnız sentetik parola ile
100.000 PBKDF2 turu çalıştı; 200.000 ve üç ayrı 600.000 denemesi runtime
sınırına takıldı. Hazır olma işareti kontrol edildi. Test Worker'ı kaldırıldı,
yokluğu ve uygulama/staging/bilgi Worker'larının değişmediği doğrulandı.
Özel ölçüm `.sites-runtime/koru-password-probe/report.json` içindedir.
Duvar saati CPU ölçümü değildir. Eski maliyete düşerek genel kayıt açılmaz.

Öneri: parola doğrulamasını yönetilen Firebase Authentication'a bırakmak.
Cloudflare Worker yetki, grup, oturum ve içerik katmanı olarak kalır. Bu
önerinin güvenlik/kota/veri aktarımı kabulü henüz tamamlanmadı.

## Veri Sınırı

```text
Tarayıcı -> Firebase Authentication: e-posta/parola doğrulaması
Tarayıcı -> Koru Worker: kısa ömürlü ID token, aynı-origin oturum değişimi
Worker -> kanonik D1: güvenilir (project_id, firebase_uid) -> hesap kimliği
Worker -> ilgili grup D1: üyelik, yerel üye kimliği, rol, görünüm, içerik
```

Google kimlik/e-posta, parola doğrulama kaydı ve hizmetin güvenlik verilerini
işleyen yeni taraftır. Kitap, yorum, fotoğraf, grup/rol/tema Firestore'a taşınmaz.
Firebase SDK'nin bir pakete kurulması, Firestore/Analytics/Storage hizmeti
açılması değildir. İleride yalnız `firebase/app` ve `firebase/auth` kullanılır;
analitik, telefon/SMS, Firestore, Functions veya Blaze bu plana dahil değildir.
Gizlilik/aktarım/saklama metinleri ve yetkili inceleme güncellenmeden geçilmez.

## Ücretsiz Planın Sınırı

Spark ödeme yöntemi olmadan kullanılabilen ücretsiz plandır; ücretli Blaze'e
otomatik geçiş açılmayacak. E-posta/parola hedeflenir. Identity Platform'lu
Spark için günlük Tier 1 aktif kullanıcı sınırı 3.000; doğrulama postası
1.000/gün, şifre sıfırlama 150/gün olarak belgelenir. Parolasız e-posta
bağlantısının 5/gün sınırı bu ürün için genel giriş varsayılanına uygun değildir.
Gerçek proje modu/kotaları panelde tekrar kontrol edilir; ücretsiz kullanım
sınırsız hizmet veya teslim garantisi değildir. IP/abuse kısıtları ayrıca vardır.
[Fiyatlandırma](https://firebase.google.com/pricing),
[resmi kotalar](https://firebase.google.com/docs/auth/limits).

Firebase'in kendi doğrulama/reset postaları kabul edilirse bu iki akış Gmail
OAuth token'ına dayanmaz. Fakat mevcut Gmail Testing engeli kendiliğinden
kapanmış sayılmaz: uygulama hâlâ eski sağlayıcıyı kullanıyor. Gönderen adı,
Türkçe metin, eylem linki/domain, kota ve gerçek teslim ayrıca kabul edilecek.
Destek kutusu `koru.destek@gmail.com` olarak kalır; Gmail kullanıcılara giriş
yöntemi olarak dayatılmaz.

## Yerel Prototip

`prototypes/firebase-auth` bağımsız workspace/lockfile'dır. Ana web/mobil
bağımlılıkları değişmedi. Resmi Web/Admin SDK'ları ve Auth emülatörü kullanılır.
Çalıştırma: [README](../prototypes/firebase-auth/README.md).

- `demo-koru-auth-local`, yalnız `127.0.0.1`, boş ve rastgele portlar.
- Gerçek Google ortam değişkenleri/kimlik dosyaları devralınmaz; giriş yapılmaz.
- Sentetik kayıt, yerel doğrulama kodu, reset/kod tekrar kullanımı, yanlış/eski
  parola, SDK revocation ve silinen sağlayıcıya giriş reddi sınanır.
- Yerel SQLite sözleşmesi tek Firebase UID'yi aynı kanonik hesapla eşler;
  iki farklı yerel üye kimliği, rol ve görünüm korunur. Bu gerçek Koru grup
  ekranı veya D1/Firebase entegrasyonu kabulü değildir.
- JOSE ile imzalı token testleri: RS256/kid/imza/issuer/audience/zaman,
  doğrulanmış e-posta, provider; bozuk/anonim/tenant/unsigned token reddi.
- İmzalı doğrulayıcı emülatör token'ı kabul etmez. Admin SDK'deki güvensiz
  emülatör modu üretim Worker'ına taşınamaz.

19 Ekim yerel sonuç: 20 sözleşme testi ve 11 emülatör akış kontrolü geçti.
20 Ekim ek kontrol: `provider-status.mjs` adayı, imza doğrulamasından sonra
sabit resmi `accounts:lookup` endpoint'ine önbelleksiz sorgu yapar. UID,
doğrulanmış e-posta ve `validSince` sınanır; kapalı/silinmiş/iptal edilmiş
hesap, eksik durum, kota/ağ/JSON/yanıt boyutu hatasında erişim reddedilir.
Dokuz ek testle imzalı sözleşme toplamı 29/29 geçti. Bunlar sentetik yanıtlı
yerel testlerdir; gerçek API alanlarının görünürlüğü, iptal sınırı ve Workers
uyumu henüz doğrulanmadı. Aday Koru oturumu üretmez; mevcut 30 günlük
çerezin geçerliliğini kendiliğinden değiştirmez. Gerçek durum köprüsü ve
oturum entegrasyonu hâlâ yayın engelidir.
Kanıtlar `.sites-runtime/firebase-prototype/runs/` altındadır; özel
emülatör bağlantıları/logları Git'e veya CI genel artifact'ına konmaz.

**Eksik doğrulamalar:** gerçek posta, gerçek Firebase parola içe aktarma,
gerçek Workers token/JWKS/CPU, dış sağlayıcı durum kontrolü ve uygulama
entegrasyonu. Emülatör başarısı bunların yerine geçmez.
Yerel araç audit'i ayrıca high bulgularla BLOKE: CLI'de `basic-ftp`/`braces`,
SDK'nin kullanılmayan Firestore bağımlılık yolunda `@grpc/grpc-js`.
Orta bulgular da vardır. Bunlar ana web paketine eklenmedi; bulgular
gizlenmez veya audit atlanmaz. Ayrı rapor `dependency-audit.json` içindedir.
Yerel prototip, yalnız sabit sentetik girdili/loopback test aracıdır; gerçek
hesap aktarımı veya yayımlanacak bağımlılık seti olarak kullanılamaz.

## Üretim İçin Zorunlu Sözleşme

1. E-posta eşitliği, kullanıcıdan gelen üye ID'si veya custom `admin` claim'i
   hesap bağlayamaz. Kanonik DB'de tekil `(project_id, firebase_uid)` ve tekil
   hesap bağlantısı, incelenmiş migration ve yetkili kurulum gerekir.
2. Mevcut kullanıcı adı alanı korunacaksa e-posta çözümlemesi özel/rate-limitli
   sunucu akışında olmalı; genel kullanıcı/e-posta arama endpoint'i açılmaz.
   Firebase yerel olarak e-posta/parola kullanır. UX kararı ayrıca test edilir.
3. Token imzası ve doğru proje yeterli değildir. Sağlayıcıda disabled/deleted/
   revoked durumu ve kanonik silme günlüğü de kontrol edilir. JOSE adayı
   revocation sorgusu yapmaz; bu açık iş çözülmeden oturum üretilmez.
4. Hedef: kimlik değişiminde aynı-origin/CSRF/Turnstile/rate-limit kontrolü;
   mevcut HttpOnly Secure SameSite oturumu, kanonik `session_version` ve
   grup korumaları korunur. Token/localStorage veya client rolü yetki kaynağı
   olmaz. ID token/profil/parola log, hata raporu veya SW cache'e yazılmaz.
5. Reset/parola değişimi ile Koru oturum iptali birlikte tasarlanmalı. Sadece
   Firebase token iptali mevcut 30 günlük Koru çerezini iptal etmez. Alternatif
   kısa sunucu oturumu/durum kontrolü ve provider outage fail-closed davranışı
   yazılıp test edilmeli. Yetki veren cache bu zorunluluğu geciktiremez.
6. Kayıtta doğrulama ve UID bağlantısı tekrar denemeye dayanıklı olmalı;
   Firebase hesabı var/D1 yok veya tersi durum yanlış kişiye hesap açmamalı.
   Silme kuyruğu Firebase hesabı/token iptali ve D1 purge adımlarını ayrı
   checkpoint'lerle yönetmeli. Yerel D1 silme servisi bunu henüz yapmaz.
7. Web/PWA mevcut dört tasarımda kalır. SDK ağ/CSP, token yenileme, çevrimdışı,
   çoklu sekme ve origin geçişi sabit revision'da sınanır. Yerel Firebase
   Admin SDK Node içindir; Worker'a uyumlu olduğu varsayılmaz. Ayrı bir
   privilegeli backend gerekiyorsa yeni mimari/ücretsiz çalışma koşulu ve
   Secret/dağıtım için tekrar onay gerekir.

[Token doğrulama](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[oturum iptali](https://firebase.google.com/docs/auth/admin/manage-sessions),
[emülatör sınırı](https://firebase.google.com/docs/emulator-suite/connect_auth).

## Hesapları Kaybetmeyen Geçiş

1. Önce onaylı gerçek proje/Spark konfigürasyonu ve ayrı staging projesi.
   Kart/Blaze yok; anonim/telefon/diğer sağlayıcılar kapalı, e-posta enumeration
   ve parola politikası incelenir. Domain/posta/şablon kabulü ayrı yapılır.
2. Salt okunur hesap envanteri: doğrulanmış e-posta tekilliği, bootstrap-only
   hesap, her hash maliyeti, aktif/pasif üyelik, silme/talep/lock durumu.
   Export/parola hash'i, kişisel veri içerir; bu çalışma onu yapmadı.
3. Yedek/restore ve yazıcıları durdurma planından sonra sınırlı sentetik
   gerçek-proje denemesi için ayrı onay alınır. `PBKDF2_SHA256` import üst
   sınırı 120.000 turdur. Prototip yalnız bilinen mevcut 100.000 sürümünü
   kabul eder; 120.000 altında bilinmeyen maliyet de otomatik alınmaz.
   100.000 adayları raw hex->byte ile ayrı batch'te hazırlanır. Prototip yalnız formatı sınar;
   Google'a aktarım/doğru parola kabulü henüz sınanmadı.
4. 600.000 turlu, eksik/geçersiz hash'li veya e-postasız hesaplar otomatik
   import edilmez ve eski maliyete düşürülmez. Onaylı kimlik kanıtıyla
   kurtarma/yeniden doğrulama gerekir; kullanıcıdan parolayı destekle
   paylaşması istenmez. Silme günlüğündeki hesap kesinlikle aktarılmaz.
5. Kanonik hesap/üyelik ID'leri sabit kalır; başarılı her aktarım tekil UID
   bağlantısıyla checkpoint'lenir. Hata/çakışmada tahminle bağlama yoktur.
6. Kanarya hesaplarla giriş, tüm grup/rol/görünüm, reset, eski oturum reddi,
   silme ve provider kesintisi kabulünden sonra kontrollü kesim düşünülür.
7. Eski ve yeni parola yazıcısı aynı anda açık bırakılmaz. Yeni sağlayıcıda
   parola değiştikten sonra eski D1 hash'ine basit rollback güvenli değildir;
   durdurma/ileri düzeltme/kurtarma planı gerekir. Erişilebilir parolayı veya
   eski kimlik fallback'ini koruyarak sonsuz çift sistem kurulmaz.

[Resmi import sınırları ve API](https://firebase.google.com/docs/auth/admin/import-users).

## Gerçek Test Projesi Kurulumu

Onaylı test hedefi yalnız `koru-auth-test`; mevcut `koru-mail`, Koru üretim
hesapları ve staging D1'leri kullanılmaz. Panelden yeni proje oluşturulurken
Analytics/Gemini isteğe bağlı seçenekleri kapalı tutulur, kart/Blaze bağlanmaz.
Authentication > Sign-in method altında yalnız Email/Password açılır; e-posta
bağlantısı/telefon/anonim/diğer sağlayıcılar kapalı kalır. Test projesi canlı
kullanıcılara açılmaz. Password policy ve enumeration koruması ayrıca incelenir.

Operatör Email/Password listesindeki Enabled durumunu teyit etti; önceki
görüntüde Email link kapalıydı. Web uygulaması SDK ekranı da tamamlandı:
`1:1038145971577:web:262fb6d97d63a64601fba8`. Spark sonradan operatörce teyit
edildi; bu görsellerden gerçek posta teslimi veya uygulama entegrasyonu
tamamlandı sonucu çıkarılmaz. SDK örneği Analytics/measurementId içeriyor;
bu örnek çalıştırılmadı ve uygulamaya Analytics eklenmedi.

### Salt Okunur Gerçek Bağlantı Kontrolü

```bash
nvm use 24
corepack pnpm auth:test:preflight
```

Yalnız resmi Identity Toolkit `GET /v1/projects` çağrısı yapılır. İstek
`firebaseAppId` ile API anahtarının projeye ait web uygulamasıyla eşleşmesini
sağlayıcıya kontrol ettirir. Yerel yapılandırma yalnız onaylı test kimliği,
numarası, authDomain ve web appId ile kabul edilir; üretim/eski posta/demo
projeleri, servis hesabı veya emulator ortamı reddedilir. Redirect/çerez/cache
yoktur; anahtar/ham yanıt/log veya dönen özel alanlar rapora alınmaz.

20 Ekim gerçek API sonucu: PASSED. Test projesi/web app eşleşti, beklenen
authDomain mevcut. Doğrulanmış public domain listesi localhost ve projenin
firebaseapp.com/web.app adresleridir; staging/üretim domaini eklenmedi.
Sıfır hesap oluşturma/içe aktarma, sıfır posta, sıfır Cloudflare değişikliği.
Bu API Spark/faturalandırma, sağlayıcı yöntemleri, API-key kısıtları, parola
politikası, gerçek token/iptal, posta teslimi veya üretim hazır oluşunu kanıtlamaz.

Yapılandırma Git-ignored `.sites-runtime/firebase-auth-test/web-config.json`
dosyasında (0600, dizin 0700), yalnız dört web alanıyla tutulur. Bu Firebase
istemci API anahtarı servis hesabı özel anahtarı değildir. Yine de sohbete,
kurumsal kimlik belgesine veya raporlara tekrar yazdırılmaz.
Özel gerçek kontrol raporu:
`.sites-runtime/firebase-auth-test/preflight-8e34d8a4-ee6b-4b86-9b2d-e8dc1046c334.json`.
Dokuz ek sentetik kontrolle prototip birim toplamı 38/38 geçti.

Sonraki açık onay alındı: Spark teyit edildi; tek geçici test hesabı, yalnız
kendi `koru.destek+firebase-test@gmail.com` adresine bir doğrulama ve bir reset
postası, sonrasında test hesabını silme. Hesap oluşturuldu; yanlış parola ve
doğrulanmamış gerçek imzalı token reddedildi. Operatör doğrulama postasının
geldiğini ve bağlantıyla doğruladığını bildirdi. `verified` gerçek aşaması da
doğrulanmış e-posta + imzalı token + güncel sağlayıcı durumunu teyit etti;
aynı token yanlış proje için reddedildi. Tek reset postası gönderime kabul
edildi. Operatör reseti yapıp kendi terminalindeki gizli `finish` istemine yeni
TEST parolasını girdi. Nihai özel rapor ve yerel durum kontrolü `complete`,
`deleted: true` gösteriyor: yeni parolayla giriş başarılı, eski parola/refresh/
imzalı ID token reddedildi; sahipliği kanıtlanan test hesabı silindi, silinen
hesaba token/refresh/parola erişimi reddedildi. Yerel kayıttaki credentials
alanı kaldırıldı. Parola veya bağlantı sohbete/argümana alınmadı. Bu tek hesaplık
izole test tamamlandı; yeniden hesap/posta denemesi ayrıca onay gerektirir.
[Güncel sınırlar/komutlar/kanıt](FIREBASE_REMOTE_TEST.md). Yerel güvenlik
testleri toplamı 52/52, hedefli lint geçti. Gerçek Koru oturumları/Workers/D1
ve kullanıcı aktarımı bu deneyin dışındadır; genel yayın açılmadı.

Proje, plan ve sağlayıcı kurulumu operatörce teyit edildi; web uygulaması/config
ve sınırlı gerçek test yukarıdaki kanıtla tamamlandı. Sonraki açık onayla
[yerel Koru entegrasyonu](FIREBASE_LOCAL_INTEGRATION.md) eklendi: mevcut
ekranlar/API'ler, yerel Worker/D1, kanonik UID, şifreli oturum/iptal köprüsü
ve sentetik Auth Emulator. Bu, gerçek sağlayıcıya bağlı Koru veya üretim
Workers entegrasyonu değildir; canlı bayrak açma izni olarak kullanılamaz.
Gerçek kullanıcı/parola hash'i export/import yapılmadı. Firebase CLI
audit engeli kapanmadan bu CLI ile gerçek yetki/giriş işlemi yapılmaz; mevcut
emülatör yalnız yerel ve kimlik bilgisiz kalır. Secret veya servis hesabı JSON'u
sohbete, Git'e, loga ya da web paketine girmez.

[Resmi proje kurulum adımları](https://firebase.google.com/docs/web/setup),
[E-posta/parola sağlayıcısı](https://firebase.google.com/docs/auth/web/password-auth),
[Hesap durumu API](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup),
[UserInfo alanları](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/UserInfo),
[Kamusal proje/app kontrolü](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/TopLevel/getProjects),
[Firebase istemci anahtarlarının niteliği](https://firebase.google.com/support/guides/security-checklist#api-keys-not-secret).
