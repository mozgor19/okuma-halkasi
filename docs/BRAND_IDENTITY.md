# Koru Kurumsal Kimliği

Sürüm 1.5 · 21 Ekim 2026 · Web/PWA önce, yerel mobil uygulamalar sonra.
Bu belge tüm platformların tasarım sözleşmesidir. Yeni bir görsel yön, bu
belgenin sürümü ve karar kaydı güncellenmeden uygulanmaz. Marka tescili veya
bağımsız erişilebilirlik sertifikası değildir.

## Marka ve Hiyerarşi

- Yazılış: **Koru**. Cümle içinde tamamı büyük harfli KORU kullanılmaz.
- Kategori: birlikte okuma ve okuma grubu uygulaması.
- Ana ifade: **Birlikte oku, düşün, paylaş.**
- Kısa açıklama: Kitaplar, buluşmalar ve okuma grubun.
- Karakter: sakin, özenli, kültürlü, samimi; resmi kurum dili veya çocukça dil değil.
- Destek: `koru.destek@gmail.com`. İşletici: Mustafa Özgör.
- Canlı uygulama origin'i: `https://birkoru.com`. 20 Ekim'de mevcut veriler
  korunarak açıldı. Eski `https://okuma-halkasi.mustafayapayzeka.workers.dev`
  adresi ikinci bağımsız hesap sistemi değildir. Bu belgenin yeni sürümü yeni
  kodun canlıya dağıtıldığı anlamına gelmez; yayın kaydı ayrıca doğrulanır.
- Ayrı kamusal tanıtım/politika hedefi:
  `https://koru-public-info.mustafayapayzeka.workers.dev`. Bu adres hesap veya
  PWA origin'i değildir; mevcut uygulamanın adresini ve marka geometrisini
  değiştirmez. Yalnız kamusal sayfa dağıtımı ayrıca onaylandı.
- Ürün adı, yüklenen uygulama adı ve paylaşım kartı **Koru** olarak sabittir.
- Seçilen grubun adı grup başlıklarında, gezinmede, takvimde ve profilinde
  değişir. Özel grubun adı kamusal paylaşım görseline veya manifestine girmez.
- İşlemler kısa fiillerdir: Giriş yap, Grup kur, Daveti kopyala. Başarı ancak
  sunucu onayından sonra söylenir. Hata metni sorunu ve sonraki adımı açıklar.

## Logo Sistemi

20 Ekim'de Mustafa seçtiği **C: sade sayfa ve yaprak** logosunun entegrasyonunu
açıkça onayladı. İşaret altta açık kitabın iki sayfasını, üstte üç yaprağı ve
ortada kitap sırtı/ağaç gövdesini taşıyan negatif alanı birleştirir.
Eski K/kitap sırtı işareti yeni Koru sürümünde kullanılmaz.

Tek geometri kaynağı: `lib/brand-identity.ts` içindeki `KORU_MARK_PATHS`.
`components/brand-mark.tsx`, varlık üreticisi ve kamusal bilgi sayfası aynı
beş dolu path'i kullanır. İnternetsiz ekranın gömülü kopyası birim testinde
aynı kaynakla karşılaştırılır. Palet ve fontlar bu kararda değiştirilmedi.
Uygulama içindeki diğer simgeler Hugeicons ailesinde kalır; logo bir araç ikonu değildir.

| Kullanım | Ölçü ve Kural |
| --- | --- |
| Tek renk işaret | 64 birimlik kare; beş path, dolgu `currentColor`, kontur yok |
| Güvenli boşluk | Her yönde işaret yüksekliğinin en az dörtte biri |
| En küçük görünür işaret | 20 CSS px; bağımsız marka kullanımında 24 px tercih edilir |
| Normal kelime markası | Bricolage Grotesque 700, Koru, 20–24 px; harf aralığı 0; Minimal dahil sabit |
| Kelime/işaret aralığı | 24 px işarette 8 px; büyük uygulamalarda orantılı |
| Kontrol alanı | İşaret küçük olsa da dokunma alanı en az 44×44 px |
| Uygulama simgesi | `koru-192-v2.png`, `koru-512-v2.png`; Apple 180 ve maskable 512 ayrı çıktı |
| Apple simgesi | Tam opak kare; köşeyi işletim sistemi maskeler, saydam köşe dağıtılmaz |
| Maskelenebilir sürüm | Arka plan tamamen dolu; kritik şekil merkezdeki yüzde 80 çaplı güvenli daire içinde |
| Bildirim rozeti | Saydam zeminli beyaz tek renk 96 PNG |

Logoyu uzatma, döndürme, gölge/parıltı ekleme, fotoğrafla doldurma veya
gradyana çevirme. Açık zeminde mürekkep, koyu zeminde kâğıt rengi kullan.
Uygulama içi SVG `currentColor` kullanır; sabit marka dosyası kendi paletini taşır.
Grup adı logonun şekline dönüştürülmez. Tescil/benzer marka araştırması ayrıca yapılmalıdır.

## Renk Sistemi

Markanın temel bileşimi tek renkten oluşmaz: mürekkep, kâğıt, sarı ve
ölçülü mercan. Sarı bir metin rengi değildir; koyu mürekkeple etiket yüzeyidir.

| Marka Rolü | HEX | Kullanım |
| --- | --- | --- |
| Mürekkep | `#172d45` | Kelime markası, kuvvetli metin, ince çerçeve |
| Kâğıt | `#fffdf7` | Marka görseli ve boşluk |
| Sarı | `#e2c63f` | İşaret zemini, seçili etiket; sınırlı vurgu |
| Mercan | `#ec543f` | Kitap ayracı, küçük çizgi; küçük gövde metni değil |
| Bağlantı | `#1f5874` | Açık Notebook bağlantısı ve komutları |

Arayüzde doğrudan bu HEX değerlerini kullanma. Mevcut üç katman korunur:
`--app-*` paleti → `--color-*`, `--control-*`, `--tab-*` rolleri → bileşen.
Karşıtlık düzeltmeleri ortak rol sözleşmesinde yapılır, şemaya özel yamada değil.

| Görünüm | Açık Zemin / Metin / Eylem | Kimlik |
| --- | --- | --- |
| Notebook | `#f9f7f0` / `#172d45` / `#1f5874` | Çizgili kâğıt, marj, sarı etiket, defter satırları |
| Editorial | `#f1eee5` / `#202b29` / `#a74235` | Dergi düzeni, güçlü tipografi, ölçülü kırmızı |
| Catalogue | `#edf1e8` / `#17342d` / `#176550` | Katalog sıralaması, yeşil eylemler |
| Minimal | `#f6f6f4` / `#1b1b1a` / `#222220` | Sistem yazı tipi, sade çizgiler, nötr yüzeyler |

Mustafa'nın koyu mod eleştirisi üzerine sürüm 1.3'te yalnız koyu palet yenilendi.
Açık renk değerleri değişmedi; kalıcı test referansı
`scripts/fixtures/approved-light-palettes.json` dosyasıdır.
Koyu mod bağımsızdır: temel zemin `#15191b`, yüzey `#20272b`, yükseltilmiş
yüzey `#2b363c`, metin `#f0f5f7`, ikincil metin `#bed0d8`, sınır `#748e9b`.
Notebook eylemi `#8cd9e8`, Editorial `#ffa28d`, Catalogue `#7ee2b7`,
Minimal `#f0f5f7`. Notebook sarısı `#f3d66a`; mercan odak `#ffa28d`.
Fotoğraflar ters çevrilmez. Paletlerin makine kaynağı
`app/themes.css`; bu tablo değişince kod ve karşıtlık testleri birlikte güncellenir.

## Tipografi

Başlık/marka: **Bricolage Grotesque**, 600 ve 700. Okuma metni: **Literata**,
400 ve 600, gerekli alıntıda 400 italik. Minimal görünümde mevcut sistem
yazı tipleri korunur. Logo her görünümde aynı geometridedir.

Fontlar yerel `public/fonts/` içindedir, Latin ve Türkçe için Latin Extended
alt kümeleri birlikte kullanılır. Lisanslar SIL Open Font License 1.1;
`*-OFL.txt` dosyaları dağıtıma dahildir. Tarayıcı Google Fonts'a istek yapmaz.
Yedekler: `system-ui,sans-serif` ve `Georgia,serif`. `font-display:swap`.

| Rol | Boyut / Satır Yüksekliği | Ağırlık |
| --- | --- | --- |
| Gerçek ana başlık | 46 px / 1.10 | 600 |
| Sayfa başlığı | 34 px / 1.15 | 600 |
| Bölüm başlığı | 24 px / 1.25 | 600 |
| Uzun okuma | 19 px / 1.62, en çok 68ch | 400 |
| Standart arayüz/gövde metni | 16 px / 1.55–1.65 | 400 veya 600 |
| Yardımcı etiket ve meta | 14 px / en az 1.45 | 400 veya 600 |
| Mobil form girdisi | En az 16 px; iOS odakta otomatik yakınlaşma olmamalı | 400 |
| Dar panel başlığı | 18–24 px; dev başlık kullanılmaz | 600 |

Boyutları `vw` ile ölçekleme; negatif harf aralığı kullanma. Mobil satır
taşarsa önce satır kır, sonra uygun sabit tipografi kademesini seç.
Kesintisiz uzun grup adlarında `overflow-wrap:anywhere`, grid/flex çocuklarında
`min-width:0` kullan. 200% büyütmede metin kesilmemeli.
Gövde paragrafları ve önemli meta metinler ekran bazlı kontrolle bu ölçeğe
taşınır; küçük sayaç/rozetler otomatik olarak gövde boyutuna çıkarılmaz.
Bu belge bütün eski metinlerin bu ölçüleri geçtiği anlamına gelmez.

Grup görseli yöneticinin yüklediği özel grup medyasıdır. Onaylı okuma odası
varsayılan ve hata yedeği olarak kalır. Minimal'in varsayılan sade başlık
yapısı korunur; yalnız özel görsel seçilince başlığın üzerinde fotoğraf bandı
gösterilir. Logo veya genel paylaşım görseli grup fotoğrafıyla değiştirilmez.

## Yerleşim ve Etkileşim

- 4 px temel ölçü; ana aralıklar 8, 12, 16, 24, 32, 48 px.
- Mobil içerik kenarı genellikle 18–24 px. 320, 390, 430 ve 1440 px kontrol edilir.
- Tekrarlanan öğelerde köşe yarıçapı 2–4 px; üst sınır 8 px.
- Sayfa bölümleri kart içine alınmaz; kart içinde kart yapılmaz.
- Notebook masaüstünde üst gezinme, mobilde alt gezinme kullanır.
- Alt gezinme safe-area ile birlikte içerikten ayrı kalır. Klavye açıkken
  form ve son eylem görülebilmeli. Kısa sayfada footer aşağıda, uzun sayfada akışta kalır.
- Geri, paylaş, indir, ara gibi araçlar tanıdık simgelerle; anlamı belirsiz
  kontroller erişilebilir ad ve tooltip ile gösterilir.
- Seçenekler sekme/menü, ikili ayarlar toggle/checkbox, sayılar sayısal alan
  veya stepper ile sunulur. Devre dışı durum tek geri bildirim değildir.
- Yeni dokunma hedefleri en az 44×44 px. Komşu hedefler yanlış dokunma üretmemeli.
- Odak görünür olmalı; yalnız renk ile durum anlatılmaz. Gövde metni en az
  4.5:1, kontrol ve odak halkası en az 3:1 karşıtlık sağlar.
- `prefers-reduced-motion` korunur. Durum animasyonları işlemi engellemez.
- Skeleton, boş liste, yetkisiz, hata, yükleniyor, çevrimdışı ve tekrar dene
  durumları özelliğin tasarımının parçasıdır.
- Koyu boş durumlarda başlık `--color-text`, açıklama ve simge
  `--color-text-muted`, sınır `--color-border` kullanır. Açık renkli eski sabit
  başlık rengi koyu moda taşınmaz; açık görünüm renkleri değiştirilmez.
- Masaüstü ayırıcılarına buton/içerik dayanmaz: Defter'in yan yana buluşma
  sütunlarında çizginin iki yanında 32px iç boşluk; mobilde tek sütun korunur.
  Bölüm başlığı/komut aralığı 16px; komut grupları dar alanda satır kırar.
- Yeni hesabın turu kayıt veya grup hazırlık ekranlarında AÇILMAZ. İlk grup
  başarıyla kurulup veya davetle katılıp grubun gerçek ana ekranı yüklendiğinde
  başlar. Başarısız grup işlemi turu tüketmez. Tamamlanan/ertelenen tur hesap
  bazındadır, her yeni grupta tekrar dayatılmaz. Bu sıra 1.5'te düzeltildi.
- Turun sonunda dört görünüm ve Açık/Koyu/Sistem seçimi, ardından
  **Kaydet ve başla** vardır. Sunucu onayına kadar seçim taslaktır. Hesap
  varsayılanı yeni üyeliklere taşınır; diğer mevcut grup tercihleri değişmez.
  Seçenekler 4px köşeli, native radyo, açık odak ve 44px hedefle sunulur.
  Bu etkileşim sözleşmesi 1.4'te eklendi; logo/font/renk paleti değişmedi.

## Paylaşım ve PWA

- Genel paylaşım görseli: `public/brand/koru-share-v2.png`, 1200×630.
- Vektör ve varlık adresleri `lib/brand-identity.ts`, deterministik çıktı
  üreticisi `scripts/generate-brand-assets.mjs` içindedir.
- SVG, Apple, maskable ve bildirim adresleri `v2` sürümlüdür. Eski kurulumların
  isteyebileceği sürümsüz Koru simgeleri aynı yeni geometriyi taşır; eski webin
  `favicon.svg` ve `notebook-*` dosyaları değiştirilmez.
- Offline kabuk önbelleği `v3` oldu; yeni logo çevrimdışı ekrana gömülüdür.
  SW yalnız bu anonim ekranı saklar, güncelleme açık formu zorla yenilemez.
- Güvenli dış boşluk en az 64 px. Önizleme dar ve kırpılmışken Koru okunabilmeli.
- Özel grup adı, ad soyad, e-posta, davet/reset kodu, üye fotoğrafı kullanılmaz.
- Open Graph ve Twitter kartı aynı marka görselini kullanır; mutlak URL yalnız
  sunucunun açıkça yapılandırılmış `AUTH_PUBLIC_ORIGIN` değerinden oluşturulur.
- Paylaşım görseli değişince dosya sürümü artırılır; sosyal platform önbelleği
  ayrı kontrol edilir. Tarayıcı ekran görüntüsü gerçek WhatsApp önizleme kanıtı değildir.
- Uygulama adı Koru; manifest ID `/`, başlangıç `/`. Grup veya token ID'ye eklenmez.
- Yeni simge adresleri tarayıcıya değişikliği bildirir; önceden kurulu ana ekran
  simgesinin ne zaman yenileneceğini işletim sistemi belirler. Web içi logo ve
  offline kabuk güncellemesiyle aynı anda değiştiği varsayılmaz; fiziksel
  Android/iPhone kabulünde ayrıca incelenir.
- Ana ekrana ekleme Android tarayıcısında gerçek kurulum olayıyla; iPhone'da
  işletim sisteminin paylaş/ana ekrana ekle akışıyla doğrulanır.
- Offline destek yalnız genel bağlantı ekranıdır; hesap, API, fotoğraf, kitap
  veya form içeriği service-worker cache'ine yazılmaz. Çevrimdışı yazma kuyruğu yoktur.
- Güncelleme açık formu zorla yenilemez. Yeni sürüm için bütün pencereler
  kapatılıp yeniden açılınca geçiş testi yapılır.

## Teslim Sözleşmesi

Her görsel değişiklikte dört şema × açık/koyu × mobil/masaüstü kontrolü,
uzun grup adı, Türkçe karakterler, hata/boş durum ve dokunma kontrolü gerekir.
Notebook için Home, Plan, Meeting ve tüm Profile sekmeleri ayrıca incelenir.
Kimliği değiştiren kararlar bu belge ve `SESSION_MEMORY.md` içinde kaydedilir.
Yerel mobil, e-posta, destek ve gelecekteki mağaza görselleri de aynı kimliği
kullanır; ayrı bir platform için yeni font/palet icat edilmez.
