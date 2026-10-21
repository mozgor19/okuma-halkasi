# Mobil Form Pencereleri

21 Ekim 2026. Mustafa'nın canlı iPhone görüntülerindeki acil hata bildirimi.
Bu belge tek başına dağıtım veya fiziksel cihaz kabulü değildir.

## 22 Ekim: Hata Tekrar Açıldı

Mustafa, önceki yayından sonra gerçek iPhone'da sorunun sürdüğünü bildirdi.
Aşağıdaki eski motor testleri sorunun çözüldüğünün kanıtı değildir.
Yeni düzeltme yalnız mobil form pencerelerini kapsar; henüz yayın sonucu
değildir. Masaüstü, diğer pencereler, paletler ve veri işlemleri korunur.

- Uretim paketinde ASIL sol-ust hata yeniden uretildi: derleyici sabit
  `translate:none`/`translate:0 0` sifirlamasini `transform` zincirine indiriyor,
  ama Tailwind'in degisken kullanan `%50` translate utility'si modern
  tarayicida etkin kaliyor. Vite/dev testi bunu gormuyordu. Basarisiz gercek
  paket kontrolu `translate:-50% -50%` degerini yakaladi; kabul gevsetilmedi.
  Formlar mobilde bu utility siniflarini ARTIK URETMEZ. Ayni merkezleme
  utility'leri yalniz681px ve ustunde kalir; masaustu geometrisi korunur.
  Bu sinif secimi mevcut useKoruBrand baglamiyla yalniz Koru'ya uygulanir;
  eski webin merkezlemesi/otomatik odagi sekiz acik-koyu gorunumde ayrica sinanir.
- Mobil form yüzde/transform ile ortalanmaz; görünür alanın kenarlarına
  sabitlenir, safe-area ve klavye yüksekliği kadar sınırlandırılır.
- Zoom animasyonu ve konum/boyut geçişi kapatılır. Normal hareket modunda
  test,200ms geçiş sırasında yanlış top/yükseklik değerlerini yakaladı;
  eski reduced-motion koşusu bu ara durumu kapsamıyordu.
- Açılışta ilk girdi yerine pencereye preventScroll ile odaklanılır.
  Kullanıcı bir alana dokununca klavye açılır; Radix odak tuzağı ve kapatma
  davranışı korunur. Masaüstünde otomatik odak davranışı değişmez.
- Odak kaybolurken klavye henüz kapanmadıysa form büyüyüp sıçramaz.
  Kapanıştaki eski Safari offset'i sınırlandırılır; pinch zoom engellenmez
  ve form yakınlaştırma sırasında yeniden boyutlandırılmaz.
- Kalıcı testler normal ve azaltılmış hareketi, farklı viewport kaymalarını,
  blur/klavye kapanış sırasını ve taslağın korunmasını kapsar.
- Zorunlu web-production adımı ayrıca gerçek minify edilmiş CSS/JS ile
  dört formu dört görünüm/açık-koyuda32 kez sınar. Derleyicinin identity
  transform çıktısı geometrik olarak denetlenir; yalnız Vite/dev kontrolü
  veya CSS kaynak metni yeterli kabul edilmez.
  Ayrı WebKit kabulü için izole üretim preview'ında
  `node scripts/test-mobile-dialogs.mjs --webkit --production` aynı32 mobil
  yerleşimi sınar; Vite/dev yanıtını üretim kanıtı diye kabul etmez.

Yeni talep, önceki acil düzeltmenin başarısız devamı için dar kapsamlıdır;
eski yayın kararı yeniden kullanılmaz. Güncel temiz kaynak/push, tam otomatik
paket, audit, üç DB'nin taze şifreli yedek/yerel restore ve birebir veri
karşılaştırması zorunludur. SQL yazımı yoktur. Fiziksel telefon doğrulanmadan
bu hata kullanıcı tarafında kapanmış sayılmaz.

## Yayın Sonucu

21 Ekim23:44TRT: düzeltme `https://birkoru.com` üzerinde yayında.
Kaynak `aa6df77e14772cca67efc8ba61e437061edc0eec`; Worker
`e6d97ef8-d8c7-4803-af9c-693b3be0ebe0` (%100), bakım kapalı.
Üç DB'nin taze şifreli yedeği/yerel restore ve eski veri karşılaştırması geçti.
SQL veya migration uygulanmadı; mevcut veriler ve ayarlar korundu.

Aynı temiz kaynakta23 aşama tamamlandı: ilk port çakışması ve sonra tarayıcı
zaman aşımı raporları korundu; aynı kaynak/verideki12 geçen adımdan doğrulanmış
devamla başarısız görsel adım ve bütün kalanlar yeniden çalıştırıldı.
Son refinements12 kontrol/327 görüntü, yeni128 form yerleşimi dahil; ayrı
kaynakla eşleşen WebKit128 yerleşim/96 görüntü geçti. Önceki kusurlu font ve
alt alan ölçümleri başarılı diye yeniden etiketlenmedi. Güncel web audit
ve15 anonim gerçek HTTPS/PWA kontrolü geçti; yeni dosyalar derlemeyle birebir.

Git dışı kanıtlar: `outputs/release-tests/mobile-dialog-release-aa6df77-r2/suite-report-continued.json`,
`outputs/release-tests/mobile-dialog-hotfix-20261021-a/mobile-dialogs-webkit/report.json`,
`outputs/web-acceptance/aa6df77/`.13 manuel başlık ve fiziksel iPhone klavye
kabulü bekliyor; bu yayına özel talep tüketildi, yeni dağıtım için genel yetki yok.

## Neden ve Kapsam

Radix form pencereleri `.app-shell` içinde değil, body portalında açılır.
Mevcut mobil16px girdi kuralı bu alanlara ulaşmıyor;14px girdiler iPhone'da
odak yakınlaşmasına açıktı. Düzeltme öncesi Chromium ve WebKit testi bunu
reddetti. Tarih alanının doğal genişliği ve minimum grid genişlikleri de
dar ekranda sınırlandırılmamıştı. Bazı düzenleme formları kaydırma alanına
sahip değildi.

Ürün değişikliği `app/themes.css`: mobil portal girdileri16px,
daralabilir tek form sütunu/etiketler ve alanlar, pencere içinde kaydırılan
uzun form, mobil dinamik ekran yüksekliği sınırı. `PwaLifecycle` klavye sonrası
aktif alt alanı yalnız kendi form kaydırıcısında görünür tutar; odak, sayfa
veya pencerenin konumuna müdahale etmez. Alt alanın önce görünür viewport
dışında kaldığı ayrı bir yerel ölçümle doğrulandı. Yakınlaştırma kullanıcıya
kapatılmaz. Renk/marka/iş kuralları, masaüstü sayfaları, veri akışları ve
native uygulama değiştirilmez. SQL veya yeni migration yoktur.

## Kalıcı Kontrol

`scripts/mobile-dialog-checks.mjs`, zorunlu `web-refinements` adımına dahildir:
128 gerçek form yerleşimi,320/390/430/1440px, dört görünüm ve açık/koyu.
Buluşma düzenleme, kitap künyesi, yeni buluşma ve plan kitabı formlarında
tarih/dosya/metin/select alanları, odak fontu, dikey/yatay sınırlar, kaydet
düğmesine erişim ve kapatma denetlenir.390px'de görsel viewport daralması
simüle edilir; pencere/odak ve son eylem görünür, taslak kalıcı olmalı.
İptal edilen formlar kitap/buluşma/plan kayıtlarını değiştirmemelidir.

Ayrı motor kontrolü: `node scripts/test-mobile-dialogs.mjs --webkit`;
varsayılan Chromium. Yalnız adlandırılmış, izole sentetik yerel ortam kullanır.
Kaynak kimliği rapora yazılır. Gerçek iPhone/Android klavyesi, Safari alt
çubuğu ve yüklü PWA kabulü bu motor testleriyle tamamlanmış sayılmaz.

Bu acil talep yalnız bu düzeltmenin yayını içindir. Güncel tam test/audit,
üretim kimliği/ayarları ve veri koruma kontrolleri atlanmaz. Eski0018 veya
başka migration'lar yeniden çalıştırılmaz; önceki yayın yetkisi kullanılmaz.
Gerçek yayın sonucu `SESSION_MEMORY.md` ve `FIREBASE_PRODUCTION.md` içinde
ayrıca kaydedilir.13 manuel kabul başlığı henüz bekliyor.
