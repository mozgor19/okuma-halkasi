# Mobil Özellik ve Kabul Listesi

[Devir belgesi](MOBILE_HANDOFF.md) ile birlikte kullan.
10 Ekim 2026 itibarıyla mobil uygulama henüz geliştirilmedi; aşağıdaki bütün
native sonuçlar bekliyor. Webdeki özellik varlığı native doğrulama anlamına gelmez.

## Sonuçların kaydı

Her özellik iki OS'de ayrı test edilmeli. Durumları `Bekliyor`, `Geliştiriliyor`,
`Engelli` veya `Doğrulandı` olarak güncelle. Doğrulanan satıra commit, test adı,
OS/cihaz sürümü ve kanıt yolu ekle. Kanıtları repo içinde veya ekipçe erişilebilir
test raporlarında tut; şifre, oturum değeri, rızasız kişisel fotoğraf ekleme.
Simülatör testini gerçek cihaz testi diye kaydetme. Bütün gereken satırlar
doğrulanmadan özellik eşitliği sağlandı deme.

| Özellik / kabul ölçütü | iOS | Android | Kanıt / engel |
| --- | --- | --- | --- |
| Giriş, hatalı parola, kilitlenme, kalıcı oturum ve çıkış | Bekliyor | Bekliyor | |
| Parola değişimi ve başka cihazdaki eski oturumun iptali | Bekliyor | Bekliyor | |
| Normal üye, yönetici, ana yönetici ekranları ve sunucu yetkileri | Bekliyor | Bekliyor | |
| Ana sayfa haftalık/sıradaki/son kayıt seçimi ve doğru oluşturma etiketi | Bekliyor | Bekliyor | |
| Navigasyon, Android geri, iOS geri hareketi ve modal kapanışı | Bekliyor | Bekliyor | |
| Arşiv, kayıt açma, boş/yükleniyor/hata durumları | Bekliyor | Bekliyor | |
| Buluşma oluşturma/düzenleme, tarih-saat, harita, not ve bölüm | Bekliyor | Bekliyor | |
| Open Library başlık/ISBN arama, hata/zaman aşımı ve elle künye | Bekliyor | Bekliyor | |
| Kapak yükleme ve kayıtlı kitap künyesi düzenleme | Bekliyor | Bekliyor | |
| Devam buluşması: aynı kitap, farklı bölüm ve oturum sırası | Bekliyor | Bekliyor | |
| Okuma durumu, 1-10 puan, yorum, sayfa ve kayıt güncelleme | Bekliyor | Bekliyor | |
| Puan ortalaması, yorum listesi ve katılımcı okuma durumu | Bekliyor | Bekliyor | |
| Yönetici üye ekleme ve yalnız buluşmaya bağlı misafir | Bekliyor | Bekliyor | |
| Paylaşım, web linki, giriş sonrası dönüş ve native deep link | Bekliyor | Bekliyor | |
| Geliyorum ekle/kaldır, tek kayıt, sayı/isimler ve tarih sınırı | Bekliyor | Bekliyor | |
| Fotoğraf yükleme, biçim/boyut dönüşümü, hata ve korumalı resim | Bekliyor | Bekliyor | |
| Galeri, büyütme, fotoğraf silme ve albümü ZIP dışa aktarma | Bekliyor | Bekliyor | |
| Yüz rızası, tek yüz doğrulaması, yerel eşleştirme ve yönetici onayı | Bekliyor | Bekliyor | |
| Kendi yüz verisini kaldırma; ana yöneticinin toplu referans işlemleri | Bekliyor | Bekliyor | |
| Kitap önerme, plan tarihi ve planı aynı kitapla buluşmaya taşıma | Bekliyor | Bekliyor | |
| Tek oy, değiştirme/geri alma, gizli/açık oy ve yönetici sıfırlaması | Bekliyor | Bekliyor | |
| Türkçe normalize edilmiş genel arama ve sonuç navigasyonu | Bekliyor | Bekliyor | |
| Bildirim merkezi, izin reddi ve bildirimin doğru kaydı açması | Bekliyor | Bekliyor | |
| Uygulama kapalıyken yeni buluşma push'u | Bekliyor | Bekliyor | Webde gerçek push yok; yeni altyapı gerekli |
| ICS dışa aktarımı, harita ve kitap kaynak linki | Bekliyor | Bekliyor | |
| Profil özeti, istatistikler, avatar ve Galerim | Bekliyor | Bekliyor | |
| Kitaplarım: favoriler, okuma listesi ve ilerleme | Bekliyor | Bekliyor | |
| Görünüm: dört şablon, açık/koyu/sistem ve tercih kalıcılığı | Bekliyor | Bekliyor | |
| Çöp kutusu: soft delete, geri yükleme ve kalıcı silme yetkileri | Bekliyor | Bekliyor | |
| Ana yönetici rol atama/kaldırma, korunan ana yönetici hesabı | Bekliyor | Bekliyor | |
| Bağlantı kesilmesi, tekrar deneme ve sahte başarı göstermeme | Bekliyor | Bekliyor | |
| Yeni kimliğe uygun uygulama ikonu, splash ve açılış | Bekliyor | Bekliyor | |
| İmzalı release derlemeleri ve dağıtım hazırlığı | Bekliyor | Bekliyor | Hesaplar/imzalama/test ortamı doğrulanacak |

## Görsel test matrisi

Her platformda `editorial`, `catalogue`, `notebook`, `minimal` için açık ve koyu
mod: sekiz kombinasyon. Sistem modu için OS temasını değiştirip canlı güncellemeyi
ve yeniden açılışta doğru görünümü ayrıca test et.

- Giriş, Ana sayfa, Arşiv, Plan, Buluşma ve Profilin erişilebilir bütün sekmeleri.
- Profil: Özet, Kitaplarım/favoriler/okuma, Galerim, Görünüm, Güvenlik, Yüz verisi,
  yönetici Çöp kutusu ve ana yönetici Yönetim.
- Oluşturma, kitap arama, künye düzenleme, devam buluşması, genel arama,
  katılımcı/misafir ve yüz önerisi form/modal ekranları.
- Küçük ekran, 390px referans genişliği, büyük ekran; safe area ve klavye açık hali.
  Native mantıksal ölçüler ile screenshot piksel ölçülerini karıştırma.
- Uzun kitap/üye adları, büyük sistem yazısı; metin kesilmesi ve yatay taşma yok.
- Input/select odak çerçevesi dört yönde kesintisiz; birleşik alan tek dış çerçeveli.
- Giriş kullanıcı/şifre ikonları ortalı, metin ayrı; password manager/autofill,
  boş/dolu/odak/hata/devre dışı durumları tutarlı.
- Buton/dosya seçici metinleri sınıra yapışmaz; sekmeler ve eylemler örtüşmez.
- Koyu modda devam bandı, rol düğmeleri, yüz referans adları, form etiketleri okunur.
- Metin kontrastı 4.5:1, kontrol ve odak 3:1; erişilebilir adlar, ekran okuyucu
  odağı ve hareket azaltma. Kayıt işlemi hata verdiğinde açıklama görünür.
- Defter tasarımını `/design-lab` ile yan yana karşılaştır; yalnız renk benzerliği yeterli değil.
- Backend veya ortak web kodu değişirse webde 1440px/390px regresyon matrisi de çalıştır.

## Kritik uçtan uca senaryolar

1. Oturumsuz paylaşım linki: giriş, doğru buluşmaya dönüş, Geliyorum, sayı artışı;
   ikinci istemcide state yenilenince aynı sonucu görme; iptal ve tekrar tıklamada tek kayıt.
2. Bugünkü buluşma saatinden sonra RSVP açık; +03:00 gün sınırından sonra kapalı.
   Geçmiş buluşmaya doğrudan API isteği `409`; gelecekteki farklı kayıtlar bağımsız.
3. Yeni buluşma: diğer üyenin kapalı uygulamasına push; bildirime tıklayınca doğru
   kayıt. İzin reddi, çıkış yapan cihaz, tekrar eden olay ve eski oturum senaryoları.
4. Normal üye yönetici action'ını doğrudan çağıramaz (`403`). Admin rol atayamaz,
   purge yapamaz, başkasının yüz referansını değiştiremez. Gizli oy kimlikleri maskeli.
5. Korumalı medya oturumla yüklenir, oturumsuz reddedilir; parola değişince eski
   oturum state/media/action kullanamaz. Sırlar binary, log veya test kanıtında bulunmaz.
6. Fotoğraf izin reddi, aşırı büyük dosya, bozuk görsel, mobil biçimler, yön bilgisi,
   upload sırasında bağlantı kopması ve yüz modeli hatası. Fotoğraf başarıyla
   yüklendi ama eşleştirme başarısızsa yüklemeyi başarısız diye gösterme.
7. Yüz vektörü cihaz dışına çıkmaz ve kalıcı saklanmaz; rıza yoksa eşleştirme yapılmaz.
   Öneri reddedilirse katılım yaratılmaz; onay tekrarında çift katılım oluşmaz.
8. Puansız read/partial reddedilir; puansız unread kaydedilir; önceki puanı kaldırır.
   Yorum/sayfa sınırları; favori ve oy tekrarları; plan taşıma sonrası oyların temizlenmesi.
9. Soft delete aktif listelerden kaldırır; restore ilişkileri korur; purge ilgili
   katılım/RSVP/yorum/fotoğraf/misafirleri temizler. Testleri üretim kaydıyla yapma.
10. Eksik migration veya `503`: kontrollü hata/özellik kapalı durumu; sahte başarı yok.
    Offline ve yeniden bağlantı; uygulama yeniden açılışında state ve tercihler tutarlı.

## Teslim sınırı

Tek bir platformun derlenmesi, webin telefonda açılması veya PWA kurulması
iOS/Android uygulamasının tamamlanması değildir. Test edilemeyen cihaz/OS,
imzalama ve mağaza aşamalarını engel ve gereken erişimle birlikte raporla.
Mağazaya yayın için ayrıca kullanıcı onayı ve hedef hesap bilgisi gerekir.
