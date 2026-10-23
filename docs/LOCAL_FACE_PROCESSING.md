# Tarayıcıya Özel Yüz Eşleştirme

22 Ekim 2026: Mustafa yüz işlemlerinin tamamının tarayıcıda kalmasını istedi.
Bu yeni yön sunucuda referans saklayan eski özelliği etkinleştirmez. Native
çalışma, model eğitimi veya kişileri otomatik katılımcı yapma kapsam dışıdır.

## Veri Sınırı

- Koru'nun eski yüz referansı yükleme/okuma yolu kapalı kalır; eski kayıtların
  silinmesi ayrı, yetkili ve açık bir işlemdir. Mevcut kayıtlar taşınmaz.
- Tek referans fotoğrafı yerel Worker'da çözülür; birden çok yüz, küçük veya
  düşük güvenli referans reddedilir. Orijinal, normalleştirilmiş ve aydınlatma
  varyasyonlarından descriptor çıkarılır; ham referans saklanmaz.
- Descriptor'lar IndexedDB'de çıkarılamayan AES-GCM anahtarıyla şifrelenir.
  AAD hesap/grup/kişi/model/sürüm/zamanları bağlar; 30 günde geçerlilik biter.
  Şifre ve şifre anahtarı aynı tarayıcı kökenindedir: bu XSS, ele geçirilmiş
  cihaz veya tarayıcı eklentisine karşı mutlak koruma/E2E şifreleme değildir.
- Yerel kasa cihaz/hesap/grup kapsamındadır, sunucuyla veya diğer cihazlarla
  senkron olmaz. Açık izin kaydı sürümlü ve yereldir; başkasının verisini
  işlerken kutucuk tek başına hukuki uygunluk kanıtı sayılmaz.
- İşçi yalnız aynı kökendeki sabit model dosyalarına gövdesiz GET yapabilir.
  Referans/analiz fotoğrafı/descriptor/puan hiçbir API'ye gönderilmez.
- Analiz komutu galeri yüklemesinden ayrıdır. Galeriye bilerek eklenen normal
  buluşma fotoğrafı mevcut sistemde sunucuda saklanmaya devam eder.
- Eşleştirme yalnız öneridir. Belirsiz/yakın sonuçlar reddedilir; yönetici
  gözden geçirip onaylamadıkça katılım yazılmaz. Onay sıradan kişi/meeting
  kimliğiyle mevcut addAttendance API'sini kullanır, biyometrik veri göndermez.
- Silme komutu yerel kasayı temizler. Çıkış yapmak, sunucudaki hesap silme
  talebi veya başka cihazda silme bu cihazın IndexedDB'sini kendiliğinden
  temizlemez; kullanıcı yerel silme komutunu veya site verisi temizlemeyi kullanır.

## Kalite ve Kabul

Mevcut Human3.3.6, yerel modeller, mesh ve dönüş düzeltmesi korunur. Model
yeniden eğitilmez. Tek referansın sınırlamaları, yanlış eşleşme ve eşleşememe
olasılığı vardır. Aydınlatma varyasyonları doğruluk artışının ölçülmüş kanıtı
değildir. Gerçek izinli örneklerde ayrı pozitif/negatif değerlendirme gerekir.

Human'ın birleşik description/yaş/cinsiyet yolu KAPALIDIR. Hizalanmış yüz
tensöründen yalnız mevcut grafın `global_pooling/Mean` embedding çıktısı
çalıştırılır; yaş/cinsiyet başlıkları yürütülmez. Emotion, gear/race, liveness,
body, hand ve object modülleri de kapalıdır. Tensorlar her analizde temizlenir;
model ağırlıkları hız için işçide kalabilir, sayfa kapanınca işçi sonlandırılır.
Üç aydınlatma varyasyonunda eski descriptor önbelleği kullanılmaz.

Yerel politika, kasa izolasyonu/şifreleme/silme/TTL, ağ sınırı, gerçek model
yükleme, boş görsel reddi, UI duyarlılığı ve tüm görünüm modları kontrol edilir.
Sentetik browser kontrolleri gerçek yüz doğruluğu veya hukuki kabul değildir.

Kaynak: [Human embedding](https://github.com/vladmandic/human/wiki/Embedding),
[Worker desteği](https://github.com/vladmandic/human/wiki).
## Yayın Sonucu

23 Ekim11:56TRT: kaynak95a6be4, Worker9b8b42e6-9d26-4230-8c66-2a9db662aaff
üzerinde bu araç yayında.306 birim/91 backend ve derlenmiş Chromium/WebKit
kontrolleri geçti: gerçek sıfır tensörle yalnız embedding grafı çalıştı; boş
fotoğraf reddi, tekrar analiz, ana iş parçacığı tepkisi, yalnız yerel model GET,
gerçek IndexedDB/AES-GCM izolasyon/TTL/değişiklik reddi/silme ve dört görünümde
karşıtlık doğrulandı. Üç referans varyasyonu/tensor temizliği mocked-face birim
testinde de sınandı; bunlar gerçek kişi doğruluğu veya cihaz kabulü değildir.
Gerçek izinli pozitif/negatif örnek ölçümü ve fiziksel telefon kabulü bekliyor.
Canlıda hiçbir gerçek yüz/test hesabı/posta kullanılmadı. Sunucu biyometri
flag'i kapalıdır, Koru'nun yerel aracı bu flag'den bağımsızdır. Ayrıntılı yayın
ve veri koruma kanıtı: SESSION_MEMORY.md ve outputs/web-acceptance/95a6be4/.
