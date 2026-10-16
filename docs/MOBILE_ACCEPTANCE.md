# Mobil Özellik ve Kabul Listesi

16 Ekim 2026. [Devir belgesi](MOBILE_HANDOFF.md), [mimari karar](MOBILE_ARCHITECTURE.md)
ve [grup geliştirme/üretim rehberi](READING_GROUPS.md) ile birlikte kullan.

## Güncel Yaklaşım

Expo uygulaması, mevcut web arayüzünü aynı origin'den React Native WebView içinde
açar. Dört şablon, ekranlar ve iş kuralları ikinci kez yazılmaz. Eski native ekran
iskeleti kaldırıldı; `mobile/src/web-shell.tsx` güncel giriş noktasıdır. Web ve mobil
aynı hesapları ve API'yi kullanır. Grup desteği varsayılan kapalıdır; yalnız izole
yerel geliştirme ortamında açıldı. Üretim SQL'i veya deploy yapılmadı.

Doğrulama ortamı: Ubuntu/WSL2, Node 24, JDK 17; Pixel 7 emülatörü, Android 16/API 36,
x86_64. WebView mantıksal alanı 412x839, cihaz görüntüsü 1080x2400'dür. Bunlar
fiziksel telefon sonuçları değildir. Android APK derleme/kurulum başarılıdır.
iOS JS/Hermes export kontrolü, Xcode derlemesi veya iPhone testi değildir.

`Doğrulandı` yalnız belirtilen kapsamı ifade eder. `Kısmi`, çalışan ortak özellik
ve test edilen alt akışlar yanında açık cihaz/kenar durumları olduğunu belirtir.
`Engelli`, gereken platform/erişim bulunmadığını; `Bekliyor`, test yapılmadığını
belirtir. API testi tek başına native etkileşim kanıtı sayılmaz.

## Tek Hesap ve Gruplar

| Kabul ölçütü | Web / backend | Android | iOS |
| --- | --- | --- | --- |
| Tek üyelikte girişten doğrudan uygulamaya geçiş | Doğrulandı | Doğrulandı | Engelli |
| Çoklu üyelikte her yeni girişte grup seçimi | Doğrulandı | Doğrulandı | Engelli |
| Profil üzerinden grup değiştirme | Doğrulandı | Doğrulandı | Engelli |
| Grup değişince uygulamadaki adın ve sekme başlığının değişmesi | Doğrulandı; ilk HTML ve 32 uzun ad görünümü | 17 Ekim: iki grup arasında gerçek WebView geçişi, başlık, alt bilgi ve manifest | Engelli |
| Grup verisi, yerel üye kimliği ve rol ayrımı | Doğrulandı | Doğrulandı | Engelli |
| Hesap+grup görünümü, web/mobil eşitleme ve kalıcılık | Doğrulandı | Doğrulandı | Engelli |
| Grup değişiminde ilk HTML'de doğru şablon | Doğrulandı | Ortak HTML; matris kontrolü | Engelli |
| Eski sekmenin başka grubun kaydına yazamaması | Doğrulandı | Ortak API; rol/grup geçişi kontrolü | Engelli |
| Başka istemcideki favori/RSVP değişikliğinin yenilenince görülmesi | Doğrulandı | Favori ve uygulamaya dönüş kontrolü | Engelli |
| Parola değişikliğinin bütün eski oturumları iptal etmesi | Doğrulandı | Ortak oturum API'si; native UI bekliyor | Engelli |
| Bayrak kapalıyken eski web ve cihaz görünümü | Doğrulandı | Aynı web kaynağı; ayrı native koşum bekliyor | Engelli |

Sunucu kanıtları: `scripts/test-reading-groups-unit.mjs` (88 kontrol),
`scripts/test-reading-groups.mjs` (20 yerel D1 senaryosu),
`scripts/test-legacy-web.mjs` (bayrak kapalı akışlar ve sekiz görünüm).
Eşzamanlı istek bağlamı, farklı yerel üye numarası, izinli binding listesi,
eksik registry, yetki reddi, gizli oylar, medya ve eski grup yazmaları kapsanır.
`scripts/test-reading-group-memberships.mjs`, yalnız ek gruba ait hesap, anında
üyelik iptali, geçmiş üye kaydının korunması ve geri almada yetki reddini gerçek
yerel D1 üzerinde ayrıca denetler.

## Özellikler

Bütün iOS native satırları macOS/Xcode ve simülatör/fiziksel cihaz erişimi
olmadığından **Engelli**. Ortak kodun veya JS export'un geçmesi bunları değiştirmez.

| Özellik / kabul ölçütü | Android | Kanıt / açık kapsam |
| --- | --- | --- |
| Giriş, kalıcı oturum ve çıkış | Doğrulandı | Native giriş, grup seçimi, süreç kapatıp yeniden açma; kilitlenme/hatalı parola UI sınırları ayrıca bekliyor |
| Normal üye ve ana yönetici görünümü, sunucu yetkileri | Kısmi | Native iki grup/iki rol; API yetki testleri. Ayrı admin hesabı native matrisi bekliyor |
| Ana sayfa, arşiv, Plan, Buluşma ve bütün Profil sekmeleri | Doğrulandı | Native dört şablon x iki mod görüntü/geometri matrisi |
| Android geri, klavye ve modal kapanışı | Doğrulandı | Önce IME, sonra arama modalı; lightbox geri testi |
| Buluşma/künye/devam, katılımcı ve misafir yönetimi | Kısmi | Aynı web formları; gerçek D1 API senaryoları geçiyor. Bütün native form etkileşimleri bekliyor |
| Katalog araması, hata/zaman aşımı ve elle künye | Kısmi | Web özelliği korunuyor; dış Open Library bağlantısı ve native hata UI'si ayrıca bekliyor |
| Okuma durumu, puan, yorum, sayfa, ortalama | Kısmi | API sınırları; native form ve kaydedilmemiş yorumun resume sırasında korunması |
| Favoriler ve cihazlar arası veri eşitleme | Doğrulandı | Native değişiklik bağımsız web oturumunda okunuyor |
| RSVP ve tarih sınırı | Kısmi | API tekrar/idempotency ve iki oturum; native uçtan uca etkileşim ayrıca bekliyor |
| Paylaşım ve grup kimlikli bağlantı | Doğrulandı | Gerçek Android sistem paylaşımı ve native deep link ile doğru grup/buluşma |
| Fotoğraf yükleme ve korumalı görsel | Kısmi | Native DOM dosya girdisinden sentetik PNG yükleme başarılı. Fiziksel kamera, izin reddi, HEIC/EXIF ve bozuk/aşırı dosya durumları bekliyor |
| Galeri, lightbox, silme, albüm ZIP | Doğrulandı | Native upload, lightbox/geri, gerçek ZIP paylaşımı, ZIP içeriği ve silme |
| Büyük albüm aktarımı | Doğrulandı | 21 MiB parça aktarımı ve cihaz önbelleğinde SHA256 eşitliği; alıcı uygulamaların ayrı fiziksel testi bekliyor |
| Yüz rızası, eşleştirme ve yönetici onayı | Kısmi | Yerel Human/WebGL modellerinin soğuk yüklenmesi ve boş görüntü reddi geçiyor. Rızalı gerçek yüz ile pozitif eşleştirme ve onay zinciri bekliyor |
| Yüz referansını kaldırma ve rol sınırları | Kısmi | Ortak web UI/API korunuyor; gerçek biyometrik veriyle native test yapılmadı |
| Plan, tek oy, gizli/açık oy, sıfırlama ve buluşmaya taşıma | Kısmi | D1 API senaryoları ve native Plan görünümü; bütün native komutlar ayrıca bekliyor |
| Genel arama | Kısmi | Native arama açılışı/klavye/geri; bütün Türkçe sonuç eşleşmeleri ayrıca bekliyor |
| Bildirim merkezi ve cihaz izni | Doğrulandı | Native ilk ret/tekrar isteme/kalıcı ret/onay; bildirim üretimi; süreç kapalıyken mevcut bildirime dokunarak doğru grup ve buluşmayı açma |
| Uygulama kapalıyken sunucudan yeni olay push'u | Bekliyor | Eski webde de APNs/FCM olay altyapısı yok. Yerel bildirim veya mevcut bildirime dokunma bunun kanıtı değildir |
| Takvim ICS ve dış bağlantılar | Kısmi | Gerçek ICS sistem paylaşımı; URL politikası testleri. Fiziksel harita/takvim alıcısı bekliyor |
| Profil, istatistikler, Kitaplarım, Galerim ve avatar | Kısmi | Sekiz native sekme; avatar API/korumalı medya. Kamera ve tüm düzenleme etkileşimleri bekliyor |
| Dört şablon, açık/koyu/sistem, kalıcılık | Doğrulandı | Native sekiz görünüm, Android OS temasını canlı değiştirme, grup değiştirip yeniden açma |
| Çöp kutusu, restore, purge ve rol atama sınırları | Kısmi | D1 API senaryoları ve native yönetim sekmeleri; bütün native komutlar ayrıca bekliyor |
| Ağ hatası/tekrar deneme ve gerçek başarı durumu | Kısmi | Kabuk hata/bağlantı durumları ve API fail-closed testleri; fiziksel ağ kopması henüz bekliyor |
| İkon, splash ve kurulu uygulama açılışı | Doğrulandı | Mevcut ürün ikonları, API36 debug APK kurulumu ve açılışı |
| İmzalı release ve mağaza dağıtımı | Bekliyor | Staging HTTPS origin, imzalama, hesaplar ve fiziksel cihaz onayı gerekli |

Native kanıt üreten komutlar:

```bash
corepack pnpm mobile:test:android
corepack pnpm mobile:test:android:media
corepack pnpm mobile:test:android:notifications
```

Yalnız izole yerel sunucu ve sentetik hesaplar üzerinde çalıştır.
Bildirim izin testi yalnız emülatörde çalışır; test uygulamasının izin geçmişini
sıfırlar. Fotoğraf testi sentetik, yüz içermeyen PNG kullanır. Kişisel fotoğraf,
parola, çerez ve sunucu sırlarını kanıtlara ekleme. Çalıştırma ayrıntıları
[Android rehberinde](MOBILE_ANDROID.md).

## Görsel ve Güvenlik Kapıları

- Web matrisi 390px ve 1440px: dört şablon, iki mod; Ana sayfa, Arşiv, Plan,
  Buluşma ve sekiz Profil sekmesi. Native Android matrisi ayrıca çalıştırılır.
  Webde 193, Android WebView'de 101 görüntü/geometri kontrolü başarılıdır.
  [Web raporu](mobile-evidence/web-layout-report.json),
  [Android raporu](mobile-evidence/android-layout-report.json),
  [medya raporu](mobile-evidence/android-media-report.json),
  [bildirim raporu](mobile-evidence/android-notifications-report.json).
- Görsellerin yüklenmesi, yatay taşma ve tarayıcı hataları otomatik denetlenir.
  `check:ui` ortak semantik token, mod ve kontrast sözleşmelerini denetler.
- Büyük sistem yazısı, ekran okuyucu, bütün modal/form durumları, fiziksel küçük
  ekran ve iOS geri/safe-area/klavye akışları ayrıca manuel kabul gerektirir.
- Korumalı medya grup ve oturum denetimine tabidir. Sunucu sırları mobil pakete
  taşınmaz. Native köprü yalnız tanımlı origin, komutlar, ZIP/ICS ve geçerli
  uygulama bağlantılarını kabul eder; release için açık HTTPS adresi zorunludur.
  Özellik kapalıyken ek grup kimlikli URL ve API istekleri `503 GROUP_DISABLED`
  alır; ana grubun aynı numaralı kaydına düşmez.
- Dosyalar 64 KiB parçalarla aktarılır; disk alanı kontrol edilir. Eksik/başarısız
  aktarım temizlenir. Paylaşılan geçici dosya alıcıya zaman tanımak için beş dakika
  korunur; sonraki açılışta eski önbellek de temizlenir.
- RSC peer notu: Expo Router'ın isteğe bağlı `react-server-dom-webpack@19.2.6`
  paketi React `^19.2.6` ister; native renderer React 19.2.3 gerektirir. Native
  RSC sunucusu kullanılmıyor. Kök web React 19.2.6 olarak korundu; SDK/RSC
  değişikliğinde uyumluluğu yeniden incele.

## Teslim Sınırı

17 Ekim 2026: [Google Play yayın kapısı](GOOGLE_PLAY_RELEASE.md) ve
[veri envanteri](USER_DATA.md) eklendi. İzole otomatik koşumlar ve CI,
mağaza onayı değildir. `release:check`, imzalı AAB, aynı temiz kaynak sürümüne
ait güncel web/Android raporları ve manuel kanıtlar tamamlanmadan yayını reddeder.
Play Console ve staging/canlı HTTPS ortamları henüz kurulmadı. Gizlilik/veri
hakları, UGC raporlama, fiziksel cihaz ve release kabulü açık yayın engelleridir.

Bu çalışma geliştirme/test teslimidir, mağaza veya üretim onayı değildir.
Yerel D1 başarısı üretim migration durumunu kanıtlamaz. Üretim DB yedeği,
şema/binding/üyelik denetimi, ayrı staging koşumu, fiziksel iOS/Android kabulü,
imzalı release ve mağaza incelemesi tamamlanmadan canlıya çıkarma.
