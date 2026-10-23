# Koru Web/PWA Yayını

19 Ekim 2026. Öncelik web, telefon tarayıcısı ve ana ekrana kurulan PWA'dır.
Native uygulama ve Google Play yayını sonraki aşamadır. Bu belge bir yayın
onayı veya hatasızlık/güvenlik garantisi değildir. Canlıya otomatik çıkılmaz.

## Güncel Yayın: Yerel Yüz ve Posta Tercihi

23 Ekim11:56TRT: kaynak `95a6be4`, Worker
`9b8b42e6-9d26-4230-8c66-2a9db662aaff` %100; birkoru.com açık, bakım kapalı.
Yeni koşullu dar kapsamlı talep tüketildi. Coauthorsuz temiz/push edilmiş kaynak,
306 birim/91 backend/tip/lint/build, güncel audit ve Chromium4/WebKit4 yerel yüz/
kasa/ağ/posta kontrolleri geçti. Dört görünüm/açık-koyu/mobil-masaüstü düğme
karşıtlığı ve mevcut üretim10 kontrol/32 mobil form geçti. Üç taze şifreli yedek,
diskten çözme/offline restore/birebir veri kontrolü geçti; SQL/migration/DB
silme veya taşıma YOK. Üç bağlantı, ortak okuyucular, Secret'lar, diğer Worker'lar,
Firebase ve main korundu. Canlı9 anonim HTTPS/politika/tam JS-CSS-Worker dosya
kimliği kontrolü geçti. İlk özel sağlık betiği regex hatası ayrı korunup yalnız
betik düzeltilerek tüm kontroller tamamlandı; uygulama yeniden değiştirilmedi.

Yüz aracı yalnız tarayıcıda, izinli ve yönetici incelemesine bağlı öneri üretir;
sunucuya yüz referansı/analiz fotoğrafı/vektör/puan göndermez. Galeri normal
yüklemesi ayrı kalır. Buluşma postası OFF; From/Secret eksik, sahip kurulumu
gerekiyor. Hiç gerçek hesap/posta/yüz testi veya toplu gönderim yapılmadı.
Tam paket/13 manuel, gerçek yüz doğruluk ölçümü ve fiziksel telefon kabulü
bekliyor; bunlar geçmiş sayılmaz. Sonraki belge commit'i yeni uygulama yayını
değildir. Kanıt: `outputs/web-acceptance/95a6be4/`, SESSION_MEMORY.md.

## Yerel Yüz Talebi: Tarihsel Hazırlık

22-23 Ekim: Mustafa yalnız bu değişiklikler için, soru sorulmadan kritik
kontrollerden sonra koşullu yayın onayı verdi. Bu bölüm tarihsel hazırlıktır;
tamamlanan kaynak ve sonuç yukarıdadır. Ücretli servis, gerçek toplu posta,
DB silme/taşıma veya migration kapsam dışıdır. Üç üretim DB'si ve diğer beş
staging DB'si korunur. Standart tam/manuel kapı geçmiş sayılmaz; yeni kaynağa
özel temiz/push edilmiş coauthorsuz dal, güncel audit, tip/birim/backend/build,
derlenmiş Chromium/WebKit yüz/ağ/kasa/posta ve üretim form kontrolleri, taze
üç şifreli yedek/offline restore/birebir veri karşılaştırması gerekir.

Canlı gönderici flag'i kapalı; From ve ayrı API Secret eksik. Bu sürüm ücretsiz
Resend hesabı/domain kurulumu olmadan gönderimi açmayacak. Firebase postaları
değişmez. Yerel yüz aracı sunucu biyometri flag'inden bağımsızdır; eski sunucu
yolu Koru için kapalı kalır. Referans/analiz fotoğrafı, vektör ve puan dışarı
gönderilmez. Galeri yüklemesi ayrı ve hâlâ sunucuya kaydeder. Mahremiyet/koşullar
bu ayrımı açıklar. Gerçek izinli yüz doğruluk ölçümü ve fiziksel telefon kabulü
bekler; güvenlik/doğruluk garantisi verilmez. Ayrıntı SESSION_MEMORY.md ve
LOCAL_FACE_PROCESSING.md. Sonuç yayından sonra ayrıca kaydedilecek.

## Önceki Yayın: E-posta Doğrulama

22 Ekim23:17TRT: kaynak `7f796da`, Worker
`725de55c-4ed4-4a46-ac7a-1e7ccd7d9fba` %100; bakım kapalı.
Eski hesap doğrulama eşleştirmesi ve `/account` tamamlama akışı yeni açık
yayın talebiyle yayımlandı. Kaynak coauthorsuz çalışma dalına önceden push
edildi; main değişmedi. Güncel audit,298 birim/91 backend/tip/lint/build,
derlenmiş Chromium6/WebKit6 ve üretim10 kontrol/32 mobil form geçti.
Üç taze şifreli yedek/diskten çözme/offline restore/birebir eski veri kontrolü
geçti; SQL/migration/DB temizliği yok. Tüm bağlantılar/Secret'lar, ortak
okuyucular, diğer Worker'lar ve mail OFF korundu. Firebase panel/mail adı
değiştirilmedi. Canlı sekiz anonim HTTPS ve JS/CSS kimlik kontrolü geçti;
gerçek hesap/posta testi yapılmadı. Tam paket/13 manuel/fiziksel kabul hâlâ
bekliyor. Bu kaynağa özel onay tüketildi; belge commit'i yeni uygulama yayını
değildir. Kanıt: `outputs/web-acceptance/7f796da/`, SESSION_MEMORY.md.

## Dar Kapsamlı Talep: Tarihsel

22 Ekim: Mustafa, test ettiğini bildirerek önceki yerel e-posta doğrulama
düzeltmesini açıkça canlıya dağıtmamızı istedi. Bu yeni talep yalnız bu
düzeltmeyi kapsar; DB temizliği/taşıma, migration veya Firebase şablon ayarı
kapsamaz. Temiz coauthorsuz çalışma dalı, güncel audit, kritik hesap/oturum
ve derlenmiş tarayıcı kontrolleri, üç taze şifreli yedek/offline restore ve
eski verinin birebir korunması zorunludur. Operatörün bildirimi diğer manuel
kriterleri tamamlamaz; tam paket ve kalan fiziksel/manual kabul geçmiş
sayılmaz. Tamamlanan sonuç yukarıdadır; bu talep sonraki yayına yetki vermez.

## Önceki Yayın: Bildirim ve Kurulum

22 Ekim21:32TRT: kaynak `370c0d0`, Worker
`3de95dfd-8c5e-46da-963a-efadab32fc38` %100; bakım kapalı.
Doğrulama bildirimi/mevcut hesap ekranına bağlantı ve mobil kurulum teklifi
yayında. Yeni kritik/yüksek audit nedeniyle zorunlu Next16.4.1 düzeltildi;
güvenlik kapısı gevşetilmedi. Yeni akış Chromium13/WebKit13, önceki form
WebKit18 ve güncel audit geçti.851660c'deki294 birim/91 backend/tip/lint/
derleme/üretim10+32 form kanıtı, yalnız test bekleyicisi değiştiği ispatlanarak
doğrulanmış devamla korundu. Tam paket/13 manuel/gerçek cihaz bekliyor.
Üç taze şifreli yedek/offline restore/birebir eski veri kontrolü geçti;
üçüncü export'un başarısız özgün kaydı korunarak sahipliği doğrulanan bakım
sürümünden devam edildi. SQL/migration yok; veri/bağlantılar/Secret'lar,
mail OFF ve main korundu. Canlı altı anonim sağlık kontrolü geçti; gerçek
hesap/posta kullanılmadı. Kanıt: `outputs/web-acceptance/370c0d0/`.
Bu yayına özel yeni onay tüketildi; belge commit'i yeni uygulama yayını değildir.

## Önceki Yerel Hazırlık (Tarihsel)

22 Ekim: doğrulanmamış e-posta için bildirim ve mevcut `/account` bağlantısı;
mobil tarayıcıda kapatılabilir ana ekrana ekleme teklifi hazırlandı, henüz
canlıya dağıtılmadı. Desteklenen Android tarayıcısında düğme gerçek kurulum
penceresini açar; son onay kullanıcı/tarayıcıya aittir. iPhone/iPad'de Safari
Paylaş → Ana Ekrana Ekle adımları gösterilir, otomatik kurulum vaat edilmez.
Yedi günlük kapatma tercihi, açık pencere/tur/klavye engeli ve kurulu/native
uygulamada göstermeme korunur. Mevcut hesap menüsünden de tekrar açılır.
Tip/lint/üretim derlemesi ve gerçek yerel üretim paketinde Chromium13/WebKit13
hedefli kontrol geçti; dört görünüm/açık-koyu320/1440 görüntüleri incelendi.
Yeni kontrol mevcut `web-pwa` adımına eklendi; bağımsız çalıştırma:
`OKUMA_TEST_RUN_ID=<izole-fixture> OKUMA_TEST_ORIGIN=http://127.0.0.1:<port> node scripts/test-account-install.mjs`.
Tam paket veya fiziksel kurulum kabulü yapılmadı. Canlı veri/ayarlar değişmedi;
aşağıdaki26e6f90 yayını hâlâ güncel. Önceki dar kapsamlı yayın yetkisi yeniden
kullanılamaz. Kaynak ve kanıt ayrıntısı SESSION_MEMORY.md içindedir.

## Önceki Yayın: 22 Ekim09:48TRT

09:48TRT: kaynak `26e6f90`, Worker `93ce9f97-2cf2-43d9-ab0d-9584a17c7562`
%100, bakım kapalı. Yalnız mobil buluşma düzenleme formunun yatay taşması ve
alan genişlikleri için dar kapsamlı CSS yayımlandı; kayıt/veri işlemleri,
diğer pencereler, masaüstü ve paletler değişmedi. Tip/lint/üretim derlemesi,
güncel audit, gerçek minify paketinde WebKit18/Chromium6 yerleşim ve canlı
dosya kimliği kontrolleri geçti. Mustafa'nın yalnız kritik test/yayın talebi
bu kaynağa özel uygulandı; tam paket ve13 manuel başlık geçmiş sayılmadı.
Üç taze şifreli yedek/offline restore/birebir veri kontrolü geçti; SQL yok.
Kanıt: `outputs/web-acceptance/26e6f90/`. Main ve Secret'lar korundu.
Bu yayın yetkisi tüketildi; sonraki belge commit'i yeni uygulama yayını değildir.

## Önceki Yayın: 22 Ekim00:49TRT

00:49TRT: kaynak `6762dc8`, Worker `25afe82b-b410-4184-ace0-58e44a6f7865`,
%100; bakım kapalı. [Mobil form takibi](MOBILE_DIALOG_HOTFIX.md) yayında.
Asıl hata minify edilmiş CSS'te kalan `%50` translate utility'siydi;
yalnız Koru mobil formlarında kaldırıldı. Masaüstü/eski web, renkler ve
veri işlemleri korunur.32 gerçek üretim formu Chromium ve32 WebKit geçti.

Mustafa son açık talebiyle geniş testleri durdurup doğrudan yayın istedi.
14 tamamlanan otomatik adım geçti;23 aşamanın tamamı geçmedi. İptal edilen
legacy ve sonraki8 adım BEKLİYOR, geçmiş sayılmaz.13 manuel başlık/gerçek
iPhone klavyesi de bekliyor. Standart kapı geçilmedi; bu kaynağa özel yeni
yetki tüketildi, sonraki yayına test atlama izni değildir. Önceki onaylar kullanılmadı.

Üç taze şifreli yedek/diskten çözme/çevrimdışı restore ve birebir eski veri
karşılaştırması geçti. SQL/migration yok;0015/16/17/18'i tekrarlama.
Secret'lar, üç DB, ortak okuyucular, diğer Worker'lar ve buluşma postası
kapalı durumu korundu. Temiz kaynak coauthor olmadan çalışma dalına push
edilerek dağıtıldı; main değişmedi. Kanıt: `outputs/web-acceptance/6762dc8/`.
Sonraki belge commit'i uygulama dağıtımı değildir.

## Güncel Canlı Durum: 21 Ekim

23:44TRT, acil mobil form düzeltmesi yayında: kaynakaa6df77, Worker
e6d97ef8-d8c7-4803-af9c-693b3be0ebe0 (%100), bakım kapalı. Yalnız form CSS'i
ve klavye sırasında form içi odak kaydırması değişti. Aynı temiz kaynakta23
aşama (başarısız rapor korunarak12 geçen adımdan doğrulanmış devam), ayrı
WebKit128 yerleşim/96 görüntü, güncel audit, üç şifreli yedek/yerel restore/
eski veri karşılaştırması ve15 canlı HTTPS kontrolü geçti. SQL/migration yok;
0015/16/17/18 zaten uygulanmıştır, tekrar çalıştırma. Mevcut veri, Secret'lar,
renk/marka, staging, native ve main korundu.13 manuel kabul hâlâ BEKLİYOR;
bu gerçek iPhone klavyesi veya standart manuel kapı kabulü değildir. Yeni
acil talep tüketildi; ilerideki yayınlara yetki değildir. Kanıtlar:
`outputs/release-tests/mobile-dialog-release-aa6df77-r2/suite-report-continued.json`,
`outputs/web-acceptance/aa6df77/`. [Mobil form kapsamı](MOBILE_DIALOG_HOTFIX.md).

### Önceki Güncelleme

21 Ekim17:03TRT: Mustafa'nın yeni açık yayın talebiyle birkoru.com'a
dağıtıldı: kaynak86225c2, Workerbcdd561c-bae2-44fc-b349-d1faf74940f8.
Galeri aralıkları, ilk gruptan sonra tur/görünüm seçimi, hesap görünüm
varsayılanı, koyu boş durum karşıtlığı ve grup görselinin ekranda değişmesi yayında.
23 temiz otomatik adım, güncel web audit, üç şifreli DB yedeği/yerel restore,
yalnız kanonik DB'de eklemeli0018 ve tüm eski verilerin birebir karşılaştırması,
15 anonim canlı HTTPS kontrolü geçti.0015/0017/0018 yalnız kanonik DB'de,
0016 üç DB'de zaten uygulanmış durumda; hiçbirini yeniden çalıştırma.
Mail göndericisi kurulmadığı için buluşma e-postası kapalı; Firebase hesap
postaları değişmedi.13 manuel kabul başlığı BEKLİYOR; standart manuel kapı
geçti diye gösterilmedi. Eski istisnalar tekrar kullanılmadı, bu talep sonraki
yayına yetki değildir. Kanıtlar: outputs/release-tests/web-layout-release-86225c2-r1/
ve outputs/web-acceptance/86225c2/. Sonraki belge commit'i yeni uygulama dağıtımı
değildir. Aşağıdaki19 Ekim hazırlık bölümleri tarihsel bağlamdır;
güncel kaynak/kanıt için FIREBASE_PRODUCTION.md ve SESSION_MEMORY.md okunur.

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

## 19 Ekim Kararı (Tarihsel)

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
