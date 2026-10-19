# Koru Kurumsal Kimliği

Sürüm 1.0 · 18 Ekim 2026 · Web/PWA önce, yerel mobil uygulamalar sonra.
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
- Ürün adı, yüklenen uygulama adı ve paylaşım kartı **Koru** olarak sabittir.
- Seçilen grubun adı grup başlıklarında, gezinmede, takvimde ve profilinde
  değişir. Özel grubun adı kamusal paylaşım görseline veya manifestine girmez.
- İşlemler kısa fiillerdir: Giriş yap, Grup kur, Daveti kopyala. Başarı ancak
  sunucu onayından sonra söylenir. Hata metni sorunu ve sonraki adımı açıklar.

## Logo Sistemi

Kaynaklar: `public/brand/koru-mark.svg`, `public/brand/koru-icon.svg`,
`components/brand-mark.tsx`. İşaret, K harfi ile kitap sırtlarının birleşimidir.
Uygulama içindeki diğer simgeler Hugeicons ailesinde kalır; logo bir araç ikonu değildir.

| Kullanım | Ölçü ve Kural |
| --- | --- |
| Tek renk işaret | 64 birimlik kare; mevcut path geometrisi değiştirilmez |
| Güvenli boşluk | Her yönde işaret yüksekliğinin en az dörtte biri |
| En küçük görünür işaret | 20 CSS px; bağımsız marka kullanımında 24 px tercih edilir |
| Normal kelime markası | Bricolage Grotesque 700, Koru, 20–24 px; harf aralığı 0; Minimal dahil sabit |
| Kelime/işaret aralığı | 24 px işarette 8 px; büyük uygulamalarda orantılı |
| Kontrol alanı | İşaret küçük olsa da dokunma alanı en az 44×44 px |
| Uygulama simgesi | 192 ve 512 PNG; Apple 180 PNG; maskable 512 ayrı çıktı |
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

Koyu mod bağımsızdır: temel zemin `#15130f`, yüzey `#211e18`, yükseltilmiş
yüzey `#2d2922`, metin `#e9e5de`, ikincil metin `#b8b0a5`.
Notebook eylemi `#79adbd`, Editorial `#c9766b`, Catalogue `#5aa087`,
Minimal `#e9e5de`. Fotoğraflar ters çevrilmez. Paletlerin makine kaynağı
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
| Standart arayüz metni | 15 px / 1.50 | 400 veya 600 |
| Yardımcı etiket | 13–14 px / en az 1.45 | 400 veya 600 |
| Mobil form girdisi | En az 16 px; iOS odakta otomatik yakınlaşma olmamalı | 400 |
| Dar panel başlığı | 18–24 px; dev başlık kullanılmaz | 600 |

Boyutları `vw` ile ölçekleme; negatif harf aralığı kullanma. Mobil satır
taşarsa önce satır kır, sonra uygun sabit tipografi kademesini seç.
Kesintisiz uzun grup adlarında `overflow-wrap:anywhere`, grid/flex çocuklarında
`min-width:0` kullan. 200% büyütmede metin kesilmemeli.
Eski ekranlardaki küçük meta metinler tek seferde topluca büyütülmez; ekran
bazlı okuma/dokunma kabulüyle bu ölçeğe taşınır. Bu belge bütün eski metinlerin
halihazırda bu ölçüleri geçtiği anlamına gelmez.

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

## Paylaşım ve PWA

- Genel paylaşım görseli: `public/brand/koru-share-v1.png`, 1200×630.
- Canlı metin ve vektör kaynakları `scripts/generate-brand-assets.mjs` içindedir.
- Güvenli dış boşluk en az 64 px. Önizleme dar ve kırpılmışken Koru okunabilmeli.
- Özel grup adı, ad soyad, e-posta, davet/reset kodu, üye fotoğrafı kullanılmaz.
- Open Graph ve Twitter kartı aynı marka görselini kullanır; mutlak URL yalnız
  sunucunun açıkça yapılandırılmış `AUTH_PUBLIC_ORIGIN` değerinden oluşturulur.
- Paylaşım görseli değişince dosya sürümü artırılır; sosyal platform önbelleği
  ayrı kontrol edilir. Tarayıcı ekran görüntüsü gerçek WhatsApp önizleme kanıtı değildir.
- Uygulama adı Koru; manifest ID `/`, başlangıç `/`. Grup veya token ID'ye eklenmez.
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
