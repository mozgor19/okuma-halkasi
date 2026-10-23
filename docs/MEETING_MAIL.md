# Koru Buluşma E-postaları

Son durum23 Ekim11:56TRT: kaynak95a6be4 ile tercih düğmesinin hızlı tepki,
hata geri alma ve grup değişimi izolasyonu canlıda. Gönderim hâlâ OFF;
MEETING_MAIL_FROM ve MEETING_MAIL_API_KEY henüz yok. Hesap sahibinin aşağıdaki
Resend/domain adımları olmadan gönderim açılmaz. Gerçek test veya toplu posta
gönderilmedi; Firebase doğrulama/şifre postaları aynen korundu.

21 Ekim 2026. Kod ve gerekli0016/0017 şemaları artık birkoru.com üzerinde
yayında (kaynak77a69c5). Canlı gönderici henüz kurulmadı; gönderim açık değildir:
`MEETING_MAIL_ENABLED=false`. Tercih kaydedilebilir ama şu anda buluşma değişikliği
postası gönderilmez; arayüz de bunu açıklar. Firebase hesap postaları değişmez.

## Hazır Olan Akış

22 Ekim takip düzeltmesi: tercih düğmesi ağ yanıtını beklemeden görünür durumunu
değiştirir; kayıt sürerken tekrar tıklama engellenir, hata olursa önceki değere
döner. Aynı istekte yinelenen Firebase oturum kontrolü ve tercih/profil okumaları
kaldırıldı; grup yetkilendirmesi, doğrulanmış adres ve hız sınırı korunur.
Gönderim kapalıyken sıfır kuyruk sayaçları gizlenir. Bu arayüz düzeltmesi
gönderici kurulumu yerine geçmez ve gerçek posta gönderimini etkinleştirmez.
22-23 Ekim salt okunur canlı kontrolde From ve ayrı gönderim Secret'ının da
bulunmadığı doğrulandı. Bu eksik ayarlar Firebase hesabı postalarına ait değildir.

- Profilde her hesap/grup için ayrı tercih; varsayılan kapalı. Doğrulanmış
  adres, aktif üyelik ve hesap silme/freeze durumu gönderimden önce denetlenir.
- Tarih/saat, yer, harita bağlantısı veya çevrim içi/yüz yüze değişikliği tek
  işlemsel olay oluşturur. Not değişikliği veya aynı kaydı yeniden kaydetmek
  posta oluşturmaz. Eski sürümle düzenleme 409 döner.
- Her mesaj tek alıcıya gider; diğer adresler To/CC/BCC listesine konmaz.
  Önceki ve güncel bilgi, korumalı buluşma/takvim ve tercih bağlantıları vardır.
- Takvim UID'si korunur, SEQUENCE ve LAST-MODIFIED artar. Harici takvimleri
  sessizce değiştirme izni yoktur; kişi güncel dosyayı içe aktarır veya kendi
  kaydını düzenler. Takvim uygulamalarının içe aktarma davranışı farklıdır.
- Postadaki takvim bağlantısı farklı/kapalı oturumda tarayıcıyla açılırsa normal
  uygulama girişine yönlenir; giriş ve yetkili grup seçimi sonrası buluşmadaki
  takvim komutu kullanılabilir. JSON/API istemcileri gerçek401/403/409'u korur.
- Yerelde yalnız `development_mail` kullanılır. Üretim gönderimi ancak
  `MEETING_MAIL_ENABLED=true`, birkoru.com origin'i, doğrulanmış From ve ayrı
  Secret birlikte varsa açılır. Eksik yapılandırma mevcut uygulamayı bozmaz.
- API 429 yanıtı bekleme zamanıyla ertelenir. Zaman aşımı, belirsiz/eksik
  sağlayıcı yanıtı ve yarıda kalmış lease otomatik tekrar gönderilmez.
  `accepted` sağlayıcının kabulüdür, Gelen Kutusu'na teslim kanıtı değildir.
- Yeni olay sonrası arka plan işlemi ve grup senkronizasyonu kuyruğu tüketir.
  Yönetici yalnız kendi grubunun sayısal durumunu görebilir ve bekleyenleri
  işletebilir. E-posta adresleri bu API'de dönmez.

## Hesap Sahibinin Son Adımları

1. [Resend](https://resend.com/) üzerinde Free hesap aç; kart, Pro, Scale,
   otomatik yükseltme veya ücretli aşım açma. Güncel panelde ücretsiz kota ve
   koşulları tekrar kontrol et. 21 Ekim kontrolünde günlük sınır 100 postadır;
   bu sınırsız toplu gönderim değildir. [Fiyatlandırma](https://resend.com/pricing).
2. Domains bölümüne `birkoru.com` ekle. Yalnız gönderimi etkinleştir; ayrı posta
   kutusu veya gelen posta yönlendirmesi gerekmiyor. Sağlayıcının verdiği
   gerçek DKIM/SPF ve Return-Path kayıtlarını Cloudflare DNS'e aynen gir.
   Mevcut kök MX/TXT veya Gmail/Firebase yapılandırmasını silme. SPF için ikinci
   çelişen kayıt oluşturma; çakışma varsa değişiklikten önce incele.
   [Alan adı doğrulama](https://resend.com/docs/dashboard/domains/introduction).
3. Domain Verified olunca yalnız bu domain için Sending Access anahtarı üret.
   Anahtarı sohbete, `.md` dosyasına, istemci koduna veya Git'e koyma. Sonraki
   onaylı dağıtımda Cloudflare Worker Secret adı `MEETING_MAIL_API_KEY` olacak.
4. Runtime değişkenleri: `MEETING_MAIL_FROM=bildirim@birkoru.com`, önce
   `MEETING_MAIL_ENABLED=false`. `AUTH_PUBLIC_ORIGIN=https://birkoru.com`
   sabit kalır. Görünen ad Koru, Reply-To `koru.destek@gmail.com`.
   Açılma/tıklama takibini kapalı tut; sağlayıcıdaki veri sözleşmelerini incele.
5. Aşağıdaki SQL/dağıtım kontrolünden sonra yalnız sahibinin onayladığı test
   hesabıyla teslim, Spam, Türkçe karakter ve takvim bağlantısı kabulü yap.
   Üyelerin tercihleri kendiliğinden açılmayacak. Sonra ayrıca onayla gönderimi
   etkinleştir; ilk gerçek toplu gönderimi bu geliştirme çalışması başlatmadı.

## İşletim Sınırları

Kuyruk bir istekte en çok üç 90 kişilik paket ve yaklaşık 20 saniye işler.
İşlenmemiş 20 saatten eski değişiklikler eski bilgi göndermemek için kapanır;
30 günlük sonuç/geçmiş kayıtları sonraki kuyruk çalışmasında temizlenir.
Günlük sağlayıcı kotası yetmiyorsa herkese anında posta vaadi verilemez.
Aktivite olmayan grupların kota sonrası otomatik devamı için ayrıca zamanlanmış
bir kuyruk işleticisi gerekir; bu sürüm yeni bir Cron/Queue Worker yayımlamaz.
Bildirimler uygulama içindedir; cihaz bildirimi izin ve açık uygulama gerektirir,
arka plan web push hizmeti eklendiği iddia edilmez.

Belirsiz sonuçları Resend panelinde incelemeden tekrar gönderme. Sağlayıcı
mesaj gövdesi veya alıcı listesini hata günlüğüne kopyalama. Tercihi kapatmak
sonraki gönderimleri durdurur, kabul edilmiş postayı geri çekmez. Sağlayıcı
silme/saklama yükümlülükleri ve KVKK değerlendirmesi işletmeciye aittir.
[Gizlilik](https://resend.com/legal/privacy-policy),
[Batch API](https://resend.com/docs/api-reference/emails/send-batch-emails),
[hata yanıtları](https://resend.com/docs/api-reference/errors),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Uygulanan SQL Sırası (Tarihsel Kayıt)

Bu sıra21 Ekim10:06TRT yayınında TAMAMLANDI.0016 üç üretim DB'sinde,0017 yalnız
kanonik DB'dedir; yeniden çalıştırma. Üç şifreli yedek, yerel restore ve birebir
eski veri karşılaştırması yapıldı. Ayrıntı FIREBASE_PRODUCTION.md içindedir.
Yeni gönderici etkinleştirmesi ayrıca yapılandırma/teslim kabulü gerektirir;
bu belge tek başına SQL, posta veya başka dağıtım çalıştırmaz.

1. Güncel binding/DB kimliği, `reading_groups`, `shared_group_storage` ve
   migration envanterini salt okunur doğrula. Staging veya test DB'sini taşıma.
2. Yazmaları bakım penceresinde durdur, üç fiziksel DB'nin yedeğini al ve
   yedeklerin ilgili kaynakla eşleştiğini doğrula. Mevcut içerik taşınmaz/silinmez.
3. `0016_meeting_details.sql`: canonical `DB` ve mevcut iki dedicated binding
   `GROUP_CREATE_ONE`, `GROUP_CREATE_TWO` üzerinde yalnız henüz uygulanmadıysa
   uygula. İki domain tablosu ekler; eski buluşma satırlarını değiştirmez.
4. `0017_group_communication.sql`: **yalnız canonical DB**, zaten uygulanmış
   0015'in üzerine. Shared metadata ve hesap/grup tercih/teslim tablolarıdır.
   Dedicated DB'lere uygulama; 0015'i yeniden çalıştırma.
5. Her DB'de integrity/FK kontrolü, önceki tablo/medya/hesap özeti karşılaştırması,
   grup kapsamı ve eski oturum davranışı kabulü yap. Yeni tablolar boş olmalı.
6. Gönderici kapalıyken uygulamayı dağıt. Eski buluşmalar metadata yoksa yüz yüze
   ve revision 0 okunur; eski şemada yalnız yeni buluşma seçenekleri kapanır.
7. Geri dönüşte mail flag'ini kapalı tut ve yazmaları durdurup incele. Açılıştan
   sonra çevrim içi buluşma metaverisi yazılmış olabileceğinden, bunu okumayan
   eski Worker'a sessizce dönme; ortak okuyucular ve metaveri desteği korunarak
   düzelt. Yeni tabloları/içerikleri silme veya yedeği mevcut DB üzerine dökme.

Yerel workerd testlerine ek olarak bu yayında uzak SQL sonrası tüm eski tipli
satırlar/medya/sayaçlar, yeni boş tablolar ve FK/integrity kontrolleri de geçti.
Bu, tam çoklu-DB felaket kurtarma veya gerçek sağlayıcı teslim kabulü değildir.
