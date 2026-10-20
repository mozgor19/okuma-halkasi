# Koru Web Yayın Durumu

19 Ekim 2026. Kapsam web ve ana ekrana kurulan PWA. Native Android/iOS
uygulaması ve mağaza yayını sonraya bırakılmıştır. Bu rapor üretim dağıtım
onayı, hukuki uygunluk veya hatasızlık/güvenlik garantisi değildir.

**20 Ekim son karar:** Seçilen C logosunun entegrasyonu ve ardından genel yayın
operatör tarafından istendi; ayrı ücretsiz üretim Firebase proje kimliği
`koru-951bf` bildirildi. Logo, uygulama/kurulum/bildirim/paylaşım yüzeylerinde
sürümlü varlıklara taşınıyor. Bu yetki güvenlik kabulü değildir: gerçek
sağlayıcı entegrasyonu, eski hesapların çift kanıtlı bağlanması, canlı migration,
kalıcı posta/silme ve cihaz/yayın kabulü henüz tamamlanmadı. Son salt okunur
preflight eski canlı Worker'ın tek D1 ve eksik yeni tablolarla kaldığını doğruladı.

Üretim web yapılandırması özel yerel dosyaya alındı; salt okunur Firebase
kontrolünde doğru `koru-951bf` proje/uygulaması ve `birkoru.com` yetkisi geçti.
Operatör Spark/Enabled teyit etti. Bu, gerçek Koru oturum/posta entegrasyonu
değildir. [Güncel kapsam ve açık işler](FIREBASE_PRODUCTION.md).

Sonraki alan adı kararı: Mustafa `birkoru.com` satın aldı; yalnız Free DNS
ve geçiş hazırlığı onaylandı. [Güncel durum](DOMAIN_TRANSITION.md).
Bu, uygulamanın genel yayın engellerini veya ayrı dağıtım onayını kaldırmaz.

Sonraki karar: geçici domain bağlantısı yerine uygulama engelleri önce.
İzole uzak parola ölçümünde 200k/600k reddi doğrulandı; geçici Worker
kaldırıldı. Yalnız [yerel Firebase prototipi/planı](FIREBASE_AUTH_PLAN.md)
onaylandı. [Kanonik 0012 ve yerel silme servisi](ACCOUNT_ERASURE.md) eklendi;
uzak migration/silme yapılmadı. 178 kök birim testi ve 91 backend kontrolü,
20 Firebase sözleşme testi ve 11 emülatör kontrolü geçti. Ayrı emülatör araç
audit'i high bulgularla bloke; bunlar ana web bağımlılıklarına eklenmedi.
Bu sayılar tam sabit-revision yayın paketi veya üretim entegrasyonu değildir.
Operatör sonraki gerçek Spark test projesi aşamasına geçmek yerine şimdilik
yerel prototipte kalmayı seçti. Firebase kurulumu/uzak test beklemede;
parola mimarisi engeli kapanmış veya mevcut politika gevşetilmiş değildir.

**20 Ekim güncellemesi:** Yukarıdaki 19 Ekim prototip durumu ilerledi.
Operatörün ayrı onayıyla Spark test projesindeki tek geçici hesabın gerçek
doğrulama/sıfırlama/iptal/silme deneyi tamamlandı; hesap silindi. Ardından
yalnız [yerel Koru entegrasyonu](FIREBASE_LOCAL_INTEGRATION.md) onaylandı:
mevcut ekranlar/API'ler, sentetik Auth Emulator, UID bağlantısı ve şifreli
oturum köprüsü eklendi. Gerçek sağlayıcıya bağlı Koru/Workers dağıtımı veya
mevcut kullanıcı aktarımı yapılmadı. Yerel bayrak üretimde açılamaz.
Mevcut webin sağlayıcı kapalı 21 adımlık regresyonu geçti; son yerel güvenlik
sıkılaştırmasıyla kök birim testleri 202/202. Tam kanıt ve sınırlar yukarıdaki
entegrasyon belgesindedir; bu, sabit sürüm genel yayın onayı değildir.

## Karar

19 Ekim sonraki onaylı adım tamamlandı: **mevcut canlı tek D1'in şifreli
yedeği ve ayrı, hiçbir Worker'a bağlı olmayan uzak D1'e geri yükleme provası
geçti**. 13 tablo ve 17 medya kaydı bayt/değer düzeyinde eşleşti; geçici DB
kaldırıldı, önceki altı DB ve Worker ayar/dağıtımları korundu.
[Kanıt ve kapsam](BACKUP_RESTORE.md). Bu, migration veya genel yayın onayı değildir.

**Kod Git'e teslim edilebilir; genel kullanıma canlı yayın henüz hazır değil.**
Commit/push, D1 migration'ı uygulamak veya üretime dağıtmakla aynı işlem
değildir. Geçmiş testler yalnız çalıştırıldıkları kaynak sürümünü doğrular.

## Tamamlanan Temel İşler

19 Ekim genel yayın hazırlığı: ücretsiz origin onayı, opt-in 600.000
parola adayı (eski uzak varsayılan korunur), Koru nonce CSP, ilk sunucu verisi, üretim posta
desteği ve biyometrik kapatma. [Güncel adımlar](WEB_PUBLIC_LAUNCH.md).
Uzak/işletim engelleri kendiliğinden kapanmaz. Üretim uygulamasına SQL/Secret/deploy yok.
Sonradan yalnız ayrı kamusal tanıtım/politika Worker'ı için sınırlı dağıtım
onayı alındı; [kapsam ve sonuç raporu](PUBLIC_INFO_SITE.md). Genel kayıt kapalı kalır.

- Tek hesap, e-posta doğrulamalı kayıt/kurtarma, davet, grup kurma/seçme ve
  hesapla gruplar arası veri/rol/görünüm ayrımı için web altyapısı mevcut.
- Seçili grubun adı arayüzde değişir; genel ürün, kurulum ve paylaşım kimliği
  Koru olarak kalır. Özel grup verisi genel paylaşım kartına taşınmaz.
- Logo, yerel lisanslı Türkçe fontlar, renk/tipografi kuralları ve dört
  görünümün açık/koyu sözleşmesi `BRAND_IDENTITY.md` içinde kalıcıdır.
- Ayrı HTTPS staging, korunan gerçek operatör hesapları ve sentetik test
  hesapları vardır. Staging verisi topluca silinebilecek demo veri değildir.
- PWA manifest/simgeleri, genel offline ekran, formu zorla yenilemeyen
  güncelleme, bağlantı göstergesi ve otomatik yazma tekrarı yapmama eklendi.
- Sürümlü ilk kullanım turu ve şifreyle yeniden doğrulanan silme talebi/iptali
  yerelde uygulandı. **Silme talebi, kalıcı veri silme değildir.**
- Üretim bağımlılığı taraması ve kaynak/kanıt bağlı web yayın kontrolü mevcut.
  Eksik kabul kanıtı yayına hazır sayılmaz.

## Kanıtın Kapsamı

| Kanıt | Sonuç / Sınır |
| --- | --- |
| 18 Ekim yerel tam paket | 16 adım geçti; 19 Ekim eklerini veya gelecekteki commit'i onaylamaz |
| 18 Ekim HTTPS staging | 58 kontrol, 146 görüntü; yeni 0011 araçlarının HTTPS kabulü değildir |
| 19 Ekim odaklı deneyim | 27 + 7 + 4 yeni kontrol; tur/veri talebi ekranları dört şema × açık/koyu × 390/1440 px |
| Ek grupsuz hesap kontrolü | Hesabım sayfası ve veri talebi formu ayrı yerel UI kontrolünde geçti; sonraki otomatik koşuya eklendi |
| Tip, UI sözleşmesi, derleme | Geçti; mevcut lint uyarıları ve büyük chunk uyarısı tamamen giderilmiş değildir |
| Gerçek kurulu telefon / sosyal uygulama | Bu kaynak sürümü için kabul henüz yok |

Dosya yolları ve ölçüm koşulları [deneyim kabul planındadır](WEB_EXPERIENCE_ACCEPTANCE.md).
Bu teslimin sabit commit'ine bağlı tam paket, güncel audit ve uzak CI sonucu
ayrıca doğrulanmalıdır. Daha önceki başarılar yeni sürümün yerine konulmaz.

## Yayın Öncesi Engeller

| Öncelik | Açık İş | Kapanış Ölçütü |
| --- | --- | --- |
| Kritik | Kalıcı posta yetkisi | Test OAuth/süre korumasına dayanmayan yetki, teslim ve hata/kota takibi; doğrulama/kurtarma çalışmalı |
| Kritik | Hesap/veri yaşam döngüsü | Talep kuyruğunun izlenmesi, yanıt/saklama takvimi, çoklu-D1 silme/anonimleştirme, son yönetici devri ve geri yüklemede silmenin tekrar uygulanması |
| Kritik | Güvenlik incelemesi | Parola saklama maliyeti ve güvenli geçiş kararı; oturum/CSRF/XSS/medya/rol incelemesi, script CSP ve yeni kaynak için bağımlılık taraması |
| Kritik | Canlı şema ve veri güvenliği | Mevcut tek DB yedek/izole uzak restore provası geçti. Taze migration öncesi yedek, geriye uyum/rollback, ileride çoklu-D1/silme tekrarı ve ayrı SQL/dağıtım onayı hâlâ gerekiyor |
| Kritik | Yeni grup kapasitesi | Sonlu DB havuzu için canlı kapasite ve kota planı. Staging'in iki oluşturma yuvası dolu; dolu havuzlar sıfırlanmaz |
| Kritik | Gizlilik ve yüz verileri | Genel kullanıma uygun politika/sağlayıcı/saklama incelemesi; biyometrik işleme ve sürümlü rıza çözülmeli veya özellik yayımlanmadan kapatılmalı |
| Yüksek | İlk açılış performansı | Aynı yavaş mobil koşullarda iyileştirilmiş soğuk açılış, kabul edilen bütçe ve sonuç kanıtı |
| Yüksek | Gerçek PWA kabulü | Android Chrome ve iPhone Safari'de kurulum, klavye, safe-area, oturum/grup koruma, offline ve sürüm güncelleme |
| Yüksek | Görsel/erişilebilirlik kabulü | Son sürümde dört görünüm, açık/koyu, mobil/masaüstü; 200% büyütme, odak, ekran okuyucu ve karşıtlık son incelemesi |
| Yüksek | Paylaşım ve kalıcı adres | Gerçek WhatsApp/Telegram vb. URL önizlemeleri; seçilen origin, yönlendirme, Turnstile ve e-posta bağlantıları tutarlı olmalı |
| Kritik | Yayın kapısı ve işletim | Test/audit/manuel kanıtı geçmeden üretim dağıtımını engelleyen bağlantı; hata/kota alarmları, destek ve güvenlik olayı sorumlusu |

Native uygulamaların ertelenmesi, telefondaki **web/PWA** kabulünü ertelemez.
Bu aşamada APK/AAB, Play Console veya App Store gerekmez.

### Performansın Açık Sonucu

Yerel üretim paketi, Chromium 390×844, 1.6 Mbps / 150 ms / CPU ×4;
her durum üç örneğin ortancası:

| Ekran | Soğuk Etkileşime Hazır | Sıcak Etkileşime Hazır |
| --- | --- | --- |
| Giriş | 3.682 sn | 1.005 sn |
| Oturumlu ana ekran | 4.710 sn | 1.422 sn |

Görsel 2,126,335 bayttan 170,602 bayta indirildi; bu bütün performans işinin
bittiği anlamına gelmez. Soğuk ana ekranın kritik JS/hydration/state zinciri
iyileştirilmelidir. Bu tablo önceki ölçümdür. Yeni hazırlıkta state isteği
zinciri kaldırıldı; yeni rapor yolu `WEB_PUBLIC_LAUNCH.md` içindedir.
Süreler canlı sunucu veya fiziksel telefon ölçümü değildir; kabul ayrıdır.

### E-posta ve Ücret Konusu

`koru.destek@gmail.com` destek adresi kuruldu ve staging gönderimi doğrulandı;
bu, geçici OAuth düzeninin genel yayın için kalıcı olduğu anlamına gelmez.
Tarih korumasını uzatarak eksik yetkiyi gizlemek kabul edilmez. Kalıcı çözüm
ayrı değerlendirilir; bu rapor ücretli hizmet açılması talimatı değildir.

Özel alan adı marka/kalıcı adres kararıdır; Workers adresinde HTTPS olması
alan adı satın almaya bağlı değildir. Operatör ücretsiz üretim Workers
origin'ini onayladı; kapı bu adresi kabul eder, staging'i etmez. İleride
[alan adı seçeneklerini](DOMAIN_OPTIONS.md) ve yenileme ücretini yeniden
değerlendir. Bu paragrafın ilk araştırma durumu, yukarıdaki satın alınmış
`birkoru.com` kararıyla güncellenmiştir; aktif origin henüz değişmedi.

## Commit/Push ve Dağıtım Ayrımı

- Repo içindeki GitHub Actions web/Android regresyonlarını çalıştırır; burada
  üretim deploy komutu bulunmaz. Mevcut Android kontrolü kaldırılmadı, yeni
  native geliştirme veya mağaza yayını yapılmadı.
- Cloudflare'ın repo dışı Workers Builds bağlantısı ayrıca dağıtım
  tetikleyebilir. Bu oturumda Worker metadata'sı okunabildi; build tetikleyici
  ayarlarını okuma isteği **403** döndü. Otomatik deploy durumu doğrulanmadı.
- Bu nedenle `main` push'unu sessizce canlı dağıtım onayı sayma. Dal/dağıtım
  tercihini açıkça netleştir. Ayrı dal da özel bir build komutu varsa kendiliğinden
  güvenli varsayılamaz; ilgili build ayarı ayrıca kontrol edilmelidir.
- Kaynak ve belgeler commit edilir; OAuth JSON'ları, sırlar, özel test
  hesapları, veritabanları, `.sites-runtime/` ve `outputs/` Git'e eklenmez.
- `0011_account_experience.sql` yalnız kanonik DB içindir ve bu teslimde
  uzaktan uygulanmamıştır. Yeni araçlar eksik tabloda kapalı kalır; mevcut
  hesap/grup akışları korunur. Başarı görünümü için uzak şema uydurulmaz.

Cloudflare davranışının teknik kaynağı:
[Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
[Builds API](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).

## Önerilen Sıra

1. Kalıcı posta, parola/güvenlik, veri silme/rıza ve kapasite kararlarını kapat.
2. Soğuk açılışı iyileştir; yayın adayı kodunu sabitle.
3. Yedek/şema planı onayından sonra yalnız gereken staging migration'ını uygula;
   sabit sürümün otomatik ve HTTPS kabul testlerini tamamla.
4. Gerçek telefon PWA, paylaşım ve erişilebilirlik kanıtlarını tamamla.
5. Canlı yedek/restore/rollback planını ve deployment kapısını doğrula.
6. Yayın kontrolü geçince ayrı açık onayla kontrollü üretim dağıtımı yap;
   gerçek HTTPS smoke testi ve izlemeyle doğrula.

Detaylı kontrol ve kanıt sözleşmesi: [WEB_RELEASE.md](WEB_RELEASE.md).
