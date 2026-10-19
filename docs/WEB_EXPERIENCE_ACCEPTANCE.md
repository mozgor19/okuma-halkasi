# Web/PWA Deneyim Kabul Planı

19 Ekim 2026. Bu plan yeni istekleri mevcut kanıtlarla eşleştirir. Geçmiş
raporlar kendi kaynak sürümlerinin kanıtıdır; yeni kodu kendiliğinden onaylamaz.
Değişmeyen kontrolleri sırf yeniden saymak için çalıştırma. Değişen davranışa
odaklı regresyon ekle; yayımlanacak sabit sürümde yayın kapısı ayrıca geçilmeli.

## Önceki Kanıtlar

- Yerel paket: `outputs/release-tests/web-mveatcbh-b079de/suite-report.json`,
  16 adım başarılı. PWA alt raporu 40 kontrol; uygulama UI 211 kontrol.
- HTTPS staging: `outputs/koru-staging/2026-10-18T20-54-42-626Z/report.json`,
  58 kontrol, 146 ekran görüntüsü, sıfır tarayıcı hatası.
- Mobil laboratuvar: `outputs/web-quality/mobile-lab.json`; anonim giriş,
  390×844, 1.6 Mbps / 150 ms / CPU ×4; LCP 1.928 sn, CLS 0.
  Oturumlu ana ekran veya gerçek telefondaki açılış süresi değildir.

## Sekiz Başlık

| Başlık | Tekrar Edilmeyecek Kanıt | Yeni İş / Kalan Kabul |
| --- | --- | --- |
| Kurulu uygulamanın güncellenmesi | SW kaydı, no-store, özel verinin cache dışında kalması | İki sürüm, açık form ve iki pencereyle bekleme; kapanış sonrası geçiş; gerçek Android/iPhone ayrıca |
| Uçak modu | HTTPS üzerinde genel offline ekran ve bağlantı geri gelince açılma | Açık uygulamada durum bandı, yazmanın engellenmesi, formun korunması; bağlantı dönünce yalnız güvenli boşta yenileme |
| Açılış süresi | Yukarıdaki anonim mobil ölçüm | 2.1 MB giriş görselini optimize et; oturumlu/soğuk/sıcak açılış ölçümünü ayrıca izle; tek örneği garanti diye sunma |
| Koyu mod | Dört şema × açık/koyu; Home/Plan/Meeting/tüm profil sekmeleri | Yalnız yeni durum bandı, tur ve veri talebi bileşenlerinin 390/1440 kontrolü; kapsamlı erişilebilirlik/gerçek cihaz kabulü ayrı |
| Uzun grup adı | Sunucuda `cleanName` 2–100; form `maxLength=100`; uzun/kesintisiz ad ve HTML kaçış testi | API'den 101 karakter ve kontrol karakteriyle sınırın aşılmadığını odaklı doğrula |
| Klavye | 16 px alanlar, 44 px hedefler, simüle safe-area | Görsel viewport daralınca dialog/form erişimi; gerçek kurulu Android/iPhone klavyesi henüz doğrulanmadı |
| İlk kullanım | Yok | Hesaba bağlı sürümlü ilk adımlar turu; ertele/tamamla, menüden tekrar aç; gruba geçince tekrar başlamasın |
| Hesap/veri silme | Destek e-postası ve veri envanteri | Yeniden şifre doğrulamalı, kalıcı/idempotent talep ve iptal; gerçek çoklu-D1 silme/anonimleştirme ve yedeklerden tekrar silme ayrı yayın engeli |

## Çevrimdışı Sözleşme

- Daha önce açık olan ekrandaki bellekteki kayıtlar görülebilir; güncel oldukları
  iddia edilmez. Görünüm değiştirilebilir; henüz indirilmemiş ekran/medya açılamaz.
- Bağlantı yokken sunucuya kayıt, yükleme, grup değiştirme, davet ve hesap
  işlemleri yapılmaz. Bir yazma kuyruğu veya sonradan otomatik gönderim yoktur.
- Form metni açık sayfanın belleğinde kalır; kaydedildi mesajı gösterilmez.
  Sayfa kapatılır/yenilenirse bu metin kurtarılacağı vaat edilmez.
- Kapatılmış uygulamayı offline açmak yalnız genel bağlantı ekranını gösterir.
  Özel HTML, API, kitap, fotoğraf veya parola cache'e yazılmaz.
- `navigator.onLine` bir ipucudur, internet erişiminin kanıtı değildir. Ağ/sunucu
  hatası da açıkça başarısız sayılır. Online olayında yazmalar tekrarlanmaz.

## Veri Silme Güvenlik Sınırı

Silme talebi hesabı silmiş olmak değildir. Talep kayıt/iptal aşaması ayrı,
kişisel verilerin bütün D1'lerden silinmesi/anonimleştirilmesi ayrı kabul edilir.
Son yönetici devri, ortak kayıt sahipliği, etkin/pasif üyelikler, fotoğraflarda
üçüncü kişiler, saklama gerekçeleri, geri yüklenen yedeklere tekrar silme ve
başarısız/tekrarlanan işlem testleri bitmeden otomatik kalıcı silme açılmaz.
Güvenli testler yalnız yeni, izole yerel sahte hesaplarda yapılır. Staging'deki
gerçek operatör hesapları ve dolu grup havuzları silinmez.

Yeni migration yalnız yerelde uygulanır; uzaktaki şema durumu doğrulanmadan
staging/canlıya SQL uygulanmaz. Eski şemada yeni hesap araçları kapalı kalmalı,
mevcut giriş/grup/şifre akışı bozulmamalıdır.

## 19 Ekim Sonuçları

- `outputs/release-tests/experience-20261019/web-experience/report.json`:
  27 odaklı kontrol, 32 görünüm görüntüsü; offline yazma engeli, form koruma,
  tur tamamla/tekrar aç, hesap kimliği/CSRF/gövde limiti, silme talebi ve iptal.
- Aynı dizindeki `extra-report.json`: 7 ek kontrol, 16 son yerleşim görüntüsü;
  gerçek talep formu, inceleme durumunun korunması, eşzamanlı idempotent kayıt,
  daralan dialogun son düğmesi, eski şema uyumu, iptal edilmiş oturum.
  İki klavye simülasyonu ayrıca görüntülendi. Fiziksel cihaz kabulü değildir.
- Ayrıca grubu olmayan `demo.none` hesabıyla yeni Hesabım sayfası ve silme
  talebi formu ayrı bir UI kontrolünde geçti; bu kontrol sonraki `--extra`
  koşularına da eklendi (yukarıdaki önceki 7 kontrollü rapora dahil değildir).
- `outputs/release-tests/experience-20261019/web-updates/report.json`: 4 sürüm
  geçişi kontrolü. İki pencerenin açık formu korunur, biri kapanınca güncelleme
  zorlanmaz, hepsi kapanınca yeni kabuk etkinleşir; başarısız kurulum eski
  worker'ı bozamaz. Deneme oturum çerezi korunur.
- Yeni politika/yayın kapısı birimleri (7), TypeScript, odaklı lint ve üretim
  derlemesi geçti. UI sözleşmesi dört şema × iki mod için geçti. Odaklı lintte
  hata yok; mevcut img/effect uyarıları sürüyor. Tüm eski paket yeniden koşulmadı.

### Hız Ölçümü

`outputs/release-tests/experience-20261019/web-performance/report.json`:
üretilmiş paket, Chromium 390×844, 1.6 Mbps / 150 ms / CPU ×4, her durum
için üç örneğin ortancası. Service worker kapalı; yerel üretim önizlemesi,
canlı internet sunucusu veya fiziksel cihaz ölçümü değildir.

| Ekran | Soğuk LCP / Etkileşime Hazır | Sıcak LCP / Etkileşime Hazır |
| --- | --- | --- |
| Giriş | 1.052 / 3.682 sn | 0.380 / 1.005 sn |
| Oturumlu ana ekran | 3.964 / 4.710 sn | 0.408 / 1.422 sn |

Girişte aktarılan kaynak yaklaşık 734 KB; aynı odanın görseli 2,126,335
bayttan 170,602 bayta indi (%92 azalma). Önceki HTTPS ölçümüyle yeni yerel
ölçümün sürelerini doğrudan hız kazanımı olarak karşılaştırma. En yüksek CLS
0.034. İlk etkileşim hızı henüz kabul edilmedi: soğuk ana ekranın yaklaşık
4.7 saniyesi için kritik JS/hydration ve state isteği zinciri profillenip
iyileştirilmeli. Yeni ölçüm bir performans uygunluk onayı değildir.

### Tekrar Çalıştırma

```bash
# Yeni ve ayrı bir ad kullan; mevcut fixture verisini sıfırlamaz.
OKUMA_TEST_RUN_ID=experience-yeni corepack pnpm groups:setup
OKUMA_TEST_RUN_ID=experience-yeni OKUMA_TEST_ORIGIN=http://127.0.0.1:5196 OKUMA_GROUPS_DEVELOPMENT=1 OKUMA_SELF_SERVICE_DEVELOPMENT=1 OKUMA_APPLICATION_BRAND=Koru OKUMA_BRAND_ORIGIN=https://koru.example corepack pnpm dev --host 127.0.0.1 --port 5196
# İkinci terminal, aynı fixture adı/origin:
OKUMA_TEST_RUN_ID=experience-yeni OKUMA_TEST_ORIGIN=http://127.0.0.1:5196 corepack pnpm web:test:experience
OKUMA_TEST_RUN_ID=experience-yeni OKUMA_TEST_ORIGIN=http://127.0.0.1:5196 corepack pnpm web:test:experience --extra
OKUMA_TEST_RUN_ID=experience-yeni corepack pnpm web:test:updates
```

Üretim paketi ölçümü için geliştirme sunucusunu kapat, `corepack pnpm build`
çalıştır. `OKUMA_TEST_RUN_ID=experience-yeni corepack pnpm web:preview:local`
yalnız yerel sahte DB'lere bağlı 5197 önizlemesini açar. Başka terminalde
`OKUMA_TEST_RUN_ID=experience-yeni corepack pnpm web:measure --origin=http://127.0.0.1:5197`
ölçümü üretir. Bu araçlar deploy etmez; gerçek üretim DB kimliklerini kopyalamaz.
Üretim için `dist/server/wrangler.json` doğrudan kullanılmaz.

Mimari dayanaklar: [service-worker yaşam döngüsü](https://web.dev/articles/service-worker-lifecycle),
[PWA güncelleme](https://web.dev/learn/pwa/update),
[mobil klavye viewport davranışı](https://developer.chrome.com/blog/viewport-resize-behavior),
[D1 batch sınırı](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Sıradaki Kabul

1. Soğuk ana ekran yüklemesini iyileştir; aynı koşullarda tekrar ölç ve bütçe belirle.
2. Korunan staging şema envanteri/yedeği ve açık migration onayı sonrası yalnız
   kanonik DB'ye 0011'i uygula; Gmail/grup akışlarını bozmadan HTTPS kabulünü yap.
3. Destek talep kuyruğu, yanıt/saklama takvimi, sahiplik devri ve çoklu-D1
   kalıcı silme/anonimleştirme + yedekten geri yükleme senaryolarını tamamla.
4. Android Chrome ve iPhone Safari'de gerçekten kurulu PWA ile uçak modu,
   klavye, iki sürüm güncelleme ve oturum/grup korumasını ayrı ayrı doğrula.
5. Yayın adayı sabitlendiğinde yeni zorunlu deneyim/güncelleme adımları dahil
   yayın kapısını çalıştır. Yerel başarı, canlıya çıkış izni değildir.
