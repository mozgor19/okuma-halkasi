# Koru Web Yayın Durumu

19 Ekim 2026. Kapsam web ve ana ekrana kurulan PWA. Native Android/iOS
uygulaması ve mağaza yayını sonraya bırakılmıştır. Bu rapor üretim dağıtım
onayı, hukuki uygunluk veya hatasızlık/güvenlik garantisi değildir.

## Karar

**Kod Git'e teslim edilebilir; genel kullanıma canlı yayın henüz hazır değil.**
Commit/push, D1 migration'ı uygulamak veya üretime dağıtmakla aynı işlem
değildir. Geçmiş testler yalnız çalıştırıldıkları kaynak sürümünü doğrular.

## Tamamlanan Temel İşler

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
| Kritik | Canlı şema ve veri güvenliği | Salt okunur migration envanteri, yedek, ayrı DB'ye restore provası, geriye uyum ve rollback planı; ayrı SQL/dağıtım onayı |
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
iyileştirilmelidir. Bu süreler canlı sunucu veya fiziksel telefon ölçümü değildir.

### E-posta ve Ücret Konusu

`koru.destek@gmail.com` destek adresi kuruldu ve staging gönderimi doğrulandı;
bu, geçici OAuth düzeninin genel yayın için kalıcı olduğu anlamına gelmez.
Tarih korumasını uzatarak eksik yetkiyi gizlemek kabul edilmez. Kalıcı çözüm
ayrı değerlendirilir; bu rapor ücretli hizmet açılması talimatı değildir.

Özel alan adı marka/kalıcı adres kararıdır; Workers adresinde HTTPS olması
alan adı satın almaya bağlı değildir. Mevcut yayın kontrolü özel HTTPS alan
adı ister. Bütçe, yenileme fiyatı ve bu ürün kararı netleşmeden satın alma
yapılmaz. Önce [alan adı seçeneklerini](DOMAIN_OPTIONS.md) değerlendir.

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
