# Mobil Form Pencereleri

21 Ekim 2026. Mustafa'nın canlı iPhone görüntülerindeki acil hata bildirimi.
Bu belge tek başına dağıtım veya fiziksel cihaz kabulü değildir.

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
