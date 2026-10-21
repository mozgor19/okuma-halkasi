# Masaüstü Aralıkları ve İlk Görünüm Seçimi

21 Ekim 2026. Fotoğraf ekleme düğmesinin ayırıcı çizgiye dayanması bildirimi,
ilk gruptan sonra tur/görünüm seçimi, koyu boş durum ve grup görseli düzeltmeleri.

## Canlı Sonuç

21 Ekim17:03TRT, Mustafa'nın yeni açık yayın talebiyle `https://birkoru.com`:
kaynak `86225c25216b2e74f7a6a00d2119ed8aeaf2e8ee`, Worker
`bcdd561c-bae2-44fc-b349-d1faf74940f8` (%100), bakım kapalı.
Yalnız kanonik DB'ye eklemeli0018 uygulandı. Üç şifreli yedeğin diskten
çözme/yerel restore ve migration provası geçti; bütün eski şema/kayıt/medya/
sıra değerleri korundu. **0018 ve önceki migration'ları yeniden uygulama.**
Hesap tabloları dedicated DB'lere eklenmez. Açık paletler/logo/fontlar değişmedi.

Coauthor olmadan çalışma dalına push edilmiş temiz kaynakta23/23 tam test ve
güncel web audit geçti. Son refinements adımı11 kontrol/231 görüntü;80 galeri,
48 boş durum ve32 gerçek grup görseli yerleşimi içeriyor. Canlı15/15 anonim
HTTPS/PWA kontrolü, gerçek paket hashleri ve16 açık/koyu mobil/masaüstü görüntü
başarılı. Kanıtlar: `outputs/release-tests/web-layout-release-86225c2-r1/` ve
`outputs/web-acceptance/86225c2/` (Git dışı).

13 manuel kabul başlığı bekliyor; fiziksel telefon/gerçek posta/ayrıcalıklı
silme kabulü veya standart manuel kapı geçilmiş sayılmaz. Bu sürüme özel yayın
talebi tüketildi. Buluşma postası kapalı; provider, staging, native, main,
Secret ve ücretli hizmet değişmedi. Aşağıdaki yerel sonuçlar kendi tarihindeki
kaynağı anlatır; güncel canlı durum bu bölümdür.

## Yerleşim Bulgusu

Defter'in masaüstü buluşma düzeninde sütun aralığı sıfır, sağ sütun sol kenarı
çizgiliydi. Sağ sütunda 32px iç boşluk varken sol sütunun sağında yoktu. Böylece
fotoğraf düğmesi, boş fotoğraf alanı ve değerlendirme sayısı ayırıcıya dayanıyordu.

- 1251px ve üzerinde Defter ana sütununda 32px sağ iç boşluk; sağdaki mevcut
  32px korunur. Mobilde bu boşluk eklenmez. 1250px ve altında artık yan yana
  olmayan sütunların eski dikey ayırıcısı kaldırılır.
- Ortak bölüm başlıkları aksiyonlarla 16px aralık ve satır kırma kullanır.
  Galeri komutları kendi alanından taşmaz; iki komut arasında 8px kalır.
- Dergi, Katalog ve Minimal'in renkleri veya yerleşim kimliği değiştirilmez.
  Her şema aynı sınır/taşma ölçümlerine girer; şemaya özel renk yaması yoktur.
- Bilerek birleşik olan input/ekle düğmesi gibi kontroller ayrılmaz. Gizli
  native radyo girdileri görünür taşma sayılmaz; görünür Radix düğmeleri ölçülür.

Kalıcı test: `scripts/meeting-layout-checks.mjs`, zorunlu `web-refinements`
yayın adımından çağrılır. Dört şema x açık/koyu x 390/900/1024/1280/1440/1920/2560
genişliklerinde gerçek buluşma ekranını inceler. Sütunlar yan yanaysa galeri
aksiyonları/içeriği ayırıcıdan en az 16px uzakta kalmalı; görünür kontroller
bölümünün içinde ve mevcut bölüm çerçevesinden en az 8px uzakta olmalı.
Dolu galeri ve iki komutlu başlık ayrıca 390/1024/1440px'de sınanır.
Home, Plan, Meeting ve bütün Profile sekmelerinin mevcut regresyonu korunur.

## Yeni Hesap Akışı

Önceki sürümde tur vardı; turdan sonra ayrı görünüm seç/kaydet adımı YOKTU.

1. Kayıt sonrası sıfır gruplu hesapta veya grup hazırlık ekranında tur açılmaz.
   Önce grup başarıyla kurulur ya da davetle katılınır; grup seçimi tamamlanır
   ve gerçek ana ekran/üye/grup verisi yüklendikten sonra mevcut dört adım açılır.
   Başarısız oluşturma veya katılma turu tamamlamaz/ertelemez. Tur gerçek Plan,
   Buluşmalar ve Profil ekranlarında ilerler; boş hazırlanış ekranını kapatmaz.
2. Son tanıtımın ardından **Görünümünü seç**: Dergi, Katalog, Defter, Minimal.
   Ayrıca Açık, Koyu ve Sistem renk modu seçilir. Erişilebilir native radyo
   seçenekleri, klavye/odak ve 44px hedef sözleşmesi korunur.
3. Seçim taslaktır. **Kaydet ve başla** sunucu tarafından onaylanmadan tema veya
   tur bitişi kaydedilmiş sayılmaz. Hata olursa seçimler kalır, tekrar denenebilir.
4. Hesap varsayılanı, varsa yalnız seçili grup üyeliği ve tur bitişi aynı D1
   işleminde kaydedilir. Geçersiz grup veya iptal edilmiş oturum/üyelik reddedilir.
5. Yeni kurulan/ilk kez katılınan gruplar bu hesap varsayılanını alır. Başka
   mevcut gruplardaki tercihler değiştirilmez; tekrar davet/oluşturma isteği
   mevcut üyeliğin görünümünü sıfırlamaz. Kayıt diğer tarayıcı/cihazdan da okunur.

Tur sürümü 1 kalır. Önceden tamamlamış kişilere zorla yeni tur açılmaz;
**İlk adımlar** menüsünden isteyerek yeniden açılabilir. Tur ertelenebilir.
Eski şemada yalnız yeni seçim adımı kapanır; mevcut tur ve grup işleri sürer.

## Veri ve Yayın Sınırı

`0018_account_appearance.sql` YALNIZ kanonik DB içindir: hesap FK'si, şema,
renk modu ve güncellenme zamanı. Hesap silinince tercih cascade ile silinir.
Mevcut kayıtlar, grup tercihleri ve tur satırları migration ile değiştirilmez.
Üretimde 0015/0016/0017 zaten uygulanmıştır; bunları yeniden çalıştırma.

Yerel birim/gerçek workerd testleri; eklemeli veri koruma, tüm seçenekler,
geçersiz istekler, aynı hesap/grup kontrolü, atomiklik, iptal edilmiş erişim,
grup oluşturma/davet tekrarı, varsayılan aktarımı ve FK silmeyi kapsar.
Tarayıcı testleri grup öncesi tur olmamasını, başarısız grup işlemini, oluşturma
ve ilk davetle katılma sonrası ana ekran turunu, başarısız tercih kaydının
taslağı korumasını, farklı
tarayıcıdan okuma, yeni dedicated grubun tercihi alması ve tüm ekran/tema
ölçümlerini kapsar. Seçim ekranı ayrıca 320/390/430/1440px'de kontrol edilir;
dar ekranda renk modu simgesi metnin üstüne geçer, kelimeler bölünmez.
Gerçek fiziksel telefon veya üretim kabulü değildir.

## Boş Durum Karşıtlığı

Koyu moddaki `Henüz bir buluşma yok` başlığı eski sabit açık-tema renginde
kalmıştı. Bütün görünümlerin ortak koyu boş durum sözleşmesi artık başlık için
`--color-text`, açıklama/simge için `--color-text-muted`, sınır için
`--color-border` kullanır. Palet veya açık görünüm renkleri değiştirilmez.
`scripts/empty-panel-checks.mjs` tarayıcıda hesaplanan renkleri/arka planı ölçer:
koyu metin en az 4.5:1, simge 3:1; açık metinler eski renklerle aynı kalmalı.
Home, boş Buluşmalar ve boş Plan x dört görünüm x iki mod x390/1440 kontrol edilir.

Sonraki canlı değişiklik için yeni kaynakla eşleşen yayın kanıtı/ayrı yetki,
kanonik şema incelemesi, taze şifreli yedek ve varsa yeni SQL provası gerekir.
0018 artık uygulanmıştır; tekrar çalıştırılmaz. Önceki yayın kararları tekrar
kullanılmaz. Gerçek posta, Firebase ayarları, staging,
logo, renk paletleri, native kod ve ücretli hizmetler bu çalışmanın dışındadır.

## Önceki Yerel Sonuç

21 Ekim 12:39 TRT: 23 kontrol adımı aynı ürün kaynağında tamamlandı. İlk koşum
16 başarılı adımdan sonra kesildi; orijinal rapor korundu, kalan yedi adım aynı
kaynak parmak izi doğrulanarak tamamlandı. Kesinti veya önceki başarısız
denemeler geçmiş gibi yeniden etiketlenmedi.

- Birleşik rapor: `outputs/release-tests/layout-onboarding-suite-20261021-r3-continued/suite-report.json`.
- Odaklı rapor: `outputs/release-tests/layout-onboarding-suite-20261021-r3-refinements/web-refinements/report.json`.
- 80 boş/dolu galeri yerleşimi, 150 odaklı ekran görüntüsü; ayrıca mevcut 211
  ekran/yerleşim kontrolü, 43 deneyim kontrolü/96 görüntü, sekiz ek deneyim ve
  59 PWA kontrolü başarılı. Tip/lint/build ve yetki/izolasyon adımları da geçti.
- 1440px'de galerinin sağ sınırı ile sütun ayırıcısı arasında Defter'de 32px,
  diğer üç görünümde 44px ölçüldü; açık/koyu aynı mesafeleri koruyor.
- Yeni renk modu seçicisinin dış alanı en az 48px, gerçek native radyo tıklama
  alanı en az 44px; 320px'de simge üstte ve daha yüksek alan kullanılır.
- `http://127.0.0.1:5321` yalnız sentetik yerel önizlemedir. Önceki sentetik
  `demo.welcome` hesabı korunur; tur/üyelik durumu sıfırlanmaz. Test parolası
  yalnız yerel ayar dosyasında tutulur.

Bu sonuç aşağıdaki yeni tur sırası/karşıtlık düzeltmelerinden ÖNCEKİ kaynak
içindir; yeni kodun testi olarak kullanılamaz. Kaynak hâlâ commit edilmemiştir;
bunlar normal yayın kapısının veya
gerçek Android/iPhone kabulünün geçtiği anlamına gelmez. Canlıya dağıtım yoktur.

## Tur Sırası ve Karşıtlık Sonucu

21 Ekim 13:58 TRT, yeni yerel kaynak üzerinde:

- `tour-timing-20261021-c/web-refinements/report.json`: 11 kontrol,199 görüntü;
  48 boş Home/Buluşmalar/Plan ve80 boş/dolu galeri yerleşimi başarılı.
- İlk grup oluşmadan tur yok; başarısız oluşturma bunu tüketmiyor. Gerçek grup
  ana ekranı açılınca tur başlıyor. İlk davetle katılım da aynı sırayı izliyor.
  Tamamlama ve erteleme yeni yüklemede korunuyor; görünüm seçimi sonda kalıyor.
- Koyu boş durumlarda en düşük başlık karşıtlığı16.10:1, açıklama/simge11.12:1.
  Açık metin renkleri ve orijinal açık paletler aynı. Defter'in390/1440 koyu
  ekran görüntüleri ayrıca gözle incelendi.
- `tour-timing-20261021-a/web-experience/{report,extra-report}.json`:
  43+8 kontrol,96+16 görüntü. `groups-ui/report.json`: dört görünüm, iki mod,
  mobil/masaüstü ve bütün Profil sekmeleri dahil211 yerleşim kontrolü geçti.
- 13 birim kontrolü, TypeScript, UI sözleşmesi ve üretim derlemesi başarılı.
  Hedef lint hatasız; ReadingApp'in mevcut beş img/hook uyarısı devam ediyor.
- İlk denemelerdeki test sekmesi/hazırlık ve davet başlığı hataları düzeltildi;
  başarısız kayıtlar geçiş diye etiketlenmedi. `b` profili başarısız raporu korunur.
  Kayıt regresyonunun eski tur beklentisi güncellendi, ancak self-service
  paketinin tamamı bu odaklı çalışmada yeniden koşturulmadı.

Bunlar yeni23-adımlı tam yayın çalışması veya manuel cihaz kabulü değildir.
0018 yerelde kalır. Commit/push, canlı migration veya dağıtım yapılmadı.5321'deki
önceki sentetik önizleme aynı veri ve parolayla korunur; test sunucuları kapatıldı.
