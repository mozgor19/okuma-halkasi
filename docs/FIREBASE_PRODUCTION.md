# Koru Üretim Firebase Hazırlığı

20 Ekim 2026. Mustafa ayrı ücretsiz üretim projesini oluşturdu; Spark ve
Email/Password Enabled durumlarını panelden teyit etti. Proje `koru-951bf`,
web uygulaması `1:605673770248:web:7ccfda11ed8fed8273b0bd`, hedef `birkoru.com`.
Bu belge uygulamanın canlı Firebase kullandığı anlamına gelmez.

## Son Yayın Kontrolü

20 Ekim: Mustafa kontrollerin bitirilmesini, coauthor olmadan çalışma dalına
commit/push ve ardından canlı dağıtımı açıkça istedi. Main'e push, ücretli
plan, staging taşıma veya daha önce reddettiği ek uzak test kaynakları bu
isteğe dahil değildir. Eksik kanıt başarılı gösterilmez.

Gerçek yerel workerd testinde önemli bir hata bulundu ve düzeltildi:
Workers `fetch` için `redirect: "error"` kabul etmiyor. Firebase REST ve JWKS
artık `manual` kullanıyor; 3xx yanıtlar tüketilmeden reddediliyor, yabancı
adrese kimlik bilgisi iletilmiyor. JWKS yanıtı da boyut/MIME kontrolünden geçer.
Üç yeni test gerçek yerel D1, RS256/JWKS, şifreli oturum, parola değişimi,
yanlış proje, silinmiş/kapalı hesap, kesinti ve yönlendirme reddini birlikte
sınar. Sağlayıcı yalnız sentetik taşıma taklididir; gerçek hesap/posta yoktur.

İlk tam regresyon: `outputs/release-tests/web-final-20261020-2/suite-report.json`,
21/21 adım geçti; 211 görsel/yerleşim, 35 grup markası, 22 self-service,
59 PWA, 27+8 deneyim ve dört güncelleme kontrolü. Bu rapor commit öncesi kirli
çalışma ağacına aittir; temiz commit için yeni rapor gereklidir. Bağımlılık
taraması web high/critical bulmadı; ertelenen mobil bağımlılık uyarıları sürüyor.

Üretim önkontrolü artık hedef `https://birkoru.com`, `koru-951bf`, yalnız
eski hash doğrulama ve Firebase-yönetimli yeni parolaları doğrular. Eski
Gmail/test/emülatör/bootstrap sırlarının taşınmasını kabul etmez. Bu politika
değişikliği runtime ayarı veya canlı dağıtım değildir.

Cloudflare: zone aktif ve Free, asıl Worker hâlâ tek eski D1'e bağlı; alan
henüz hiçbir Worker'a bağlı değil. Turnstile API okuması 403 verdi; operatör
panelde widget oluşturdu, kamusal Site Key'i iletti ve
`TURNSTILE_SECRET_KEY` Secret'ını asıl Worker'a yüklediğini bildirdi.
Secret değeri istenmedi/okunmadı. Bu tek başına kayıt veya yeni sürüm açmaz.

## 20 Ekim Uygulama Kararı

Mustafa gereken işleri tamamlayıp canlıya geçilmesini yeniden açıkça istedi.
Ücretli plan yok; eski canlı kanonik D1 ve tüm grup içerikleri korunacak,
staging taşınmayacak. Eksik kanıt başarılı gösterilmeyecek.

Üretim mimarisi: mevcut Koru formları ve same-origin REST; yalnız sabit resmi
Firebase endpoint'lerine sunucudan erişim, JOSE/RS256 ve anlık sağlayıcı durum
kontrolü; şifreli sunucu oturumları. Tarayıcı SDK/Analytics/token depolama yok.
`firebase-local` ve imzasız emülatör yolu üretimden ayrı kalır. Mevcut eski
hesaplar geçiş süresince kendi eski doğrulamasıyla erişebilir, parola özeti
sessizce değiştirilmez. Yeni hesaplar yalnız Firebase'de parola tutar.

Eski hesabı bağlama: oturum + mevcut eski parola + yeni güçlü parola ile
yalnız yeni oluşturulan Firebase UID checkpoint'i; postada doğrulama ve yeni
parolalı girişten sonra tekil, version-CAS korumalı D1 bağlama. E-posta veya
ad eşitliğiyle hesap sahiplenme yok. Aynı hesabın üyelik/rol/ID'leri değişmez.
Başarılı bağlama eski oturumları iptal eder; yarım bağlama eski hesabı silmez.

Posta: Firebase'in doğrudan Türkçe doğrulama/reset iletileri, uygulamanın
`/auth/email` eylem ekranı. GET kod tüketmez, kod yönlendirmeye/loga konmaz,
parola kuralı hem Koru'da hem sağlayıcıda uygulanır. Parola değişimi için
kalıcı mutasyon kilidi, belirsiz sonuçta erişim reddi ve kanıtlı yeniden
doğrulama ile uzlaştırma gerekir. Bu karar henüz tamamlanmış kabul değildir.

## Yapılandırma

Operatörün gönderdiği web nesnesinden yalnız `apiKey`, `authDomain`,
`projectId`, `appId` alındı. Dosya Git dışı, 0600 izinli
`.sites-runtime/koru-production/firebase-web-config.json` içindedir. Servis
hesabı/private key değildir; OAuth JSON'u veya parola içermemelidir.
`<script>` bloğu çalıştırılmaz; uzak SDK/Analytics/Storage/Hosting eklenmedi.
Üretim için opt-in giriş kodu yerelde uygulandı; hiçbir uzak Worker'a
Firebase bayrağı/Secret yüklenmedi veya SQL uygulanmadı.

```bash
nvm use 24
corepack pnpm web:auth:preflight
```

Bu araç yalnız sabit Google yapılandırma endpoint'ine GET yapar. Proje,
uygulama ve varsayılan auth domain eşleşmesini kontrol eder; yanlış test
projesi, emülatör/privilegeli kimlik ortamı, yönlendirme ve bozuk/çok büyük
yanıtta kapanır. Anahtar/sağlayıcı hata metni yazdırmaz. Eksik `birkoru.com`
yetkisi çıkış kodu 2 ve `configuration-required` verir; başarı uydurulmaz.

İlk gerçek kontrolde alan eksikti. Operatörün panel adımından sonra
`2026-10-20T07:26:08.524Z` kontrolü **passed**: doğru proje/uygulama ve
`birkoru.com` yetkisi doğrulandı. Özel rapor:
`.sites-runtime/koru-production/firebase-preflight-85c4fc85-c7f7-4552-9c7c-cf9555b1f3ed.json`.
Sıfır hesap, posta, import veya Cloudflare değişikliği.
Spark, parola politikası, API key kısıtları ve sağlayıcı yöntemleri bu kamusal
API'den doğrulanamaz. Yedi sentetik güvenlik testi bu kontrol aracını kapsar.

## Canlı Entegrasyonun Açık İşleri

Yerel kod ilerlemesi: ayrı `firebase` dalı, sabit resmi REST endpoint'leri,
JOSE 6.2.12 imzalı RS256 + güncel sağlayıcı durumu, şifreli `fb2` oturumları,
doğrulanmış UID ile eski hesap bağlama ve `/auth/email` ekranı eklendi.
`0013_firebase_auth.sql` aday migration olarak yalnız çevrimdışı prova planına
ve Drizzle model envanterine eklendi; canlıya uygulanmadı. On iki SQLite hesap
işlemi testi ve sekiz imzalı/taşıma/politika testi sentetik verilerle sınandı.
Kayıt/reset hesap sorguları ve sağlayıcı çağrıları `after()` içinde yürür;
kamusal yanıt sağlayıcı gecikmesi/hatasıyla hesap varlığını açıklamaz. Belirsiz
hesap oluşturma veya posta işlemi otomatik tekrarlanmaz; özel hata bilgisi
loglanmaz. Bu gerçek Firebase projesine bağlı Koru veya uzak Workers kabulü değildir.

**Şablon geçiş sırası:** Sender name `Koru`, Reply to destek adresi,
Türkçe konular ayarlanabilir; From `noreply` ve mesaj yer tutucuları korunur.
`https://birkoru.com/auth/email` gerçek HTTPS kabulünden ÖNCE Firebase'in
Action URL'si değiştirilmez. Önceki erken panel talimatı bu sırayla düzeltildi.
Aşağıdaki maddeler bu nedenle hâlâ tamamlanmış yayın kabulü değildir.

**20 Ekim şablon durumu:** Operatör önce düzenlemede “Email template updates are
currently unavailable for this project” uyarısını bildirdi. Firebase Support'a
yönlendiriyor; kesin neden ve e-posta gönderiminin etkilenip etkilenmediği
doğrulanmadı. Bunu Spark/ücret, yeni proje yaşı, genel kesinti veya gönderim
yasağı diye açıklamayın. Plan yükseltme, proje yeniden oluşturma, API ile
şablon kısıtını aşma veya canlı kayıt açma çözüm olarak uygulanmaz.

Sonrasında operatör **Sender name ve Reply to alanlarını kaydettiğini**,
Subject alanını değiştiremediğini bildirdi. Varsayılan konu korunur; sırf konu
özelleştirmesi için ücretli plan, yeni proje veya kısıt aşma gerekli kabul
edilmez. Bu bildirim posta teslim testi değildir. Operatör ayrıca minimum 12
karakter ve harf/rakam parola politikasını kaydettiğini doğruladı; bu panel
teyididir, uygulamanın üretimde test edildiği anlamına gelmez.

**Yetki sınırı:** Operatör ayrı geçici Worker/D1, üretim Firebase projesinde
geçici hesap ve doğrulama/reset test postası teklifini **reddetti**. Bu
kaynaklar/hesap/posta oluşturulmayacak; isim veya yöntem değiştirilerek
tekrarlanmayacak. Yerel sentetik testler ve çevrimdışı veri koruma provası
sürdürüldü; uzak Koru/Firebase kabulü yapılmış gösterilemez.

Mevcut şablon ve Firebase Action URL korunur; bu yeni üretim projesinde
varsayılan doğrulama/reset teslimi ve Koru oturum iptali ayrıca sınanmalıdır.
Önceki `koru-auth-test` posta başarısı bu projenin kanıtı değildir.
Resmî destek başvurusu yalnız proje kimliği, hata, hangi şablon/alan ve
tekrar adımlarını içerir; anahtar, OAuth JSON, parola veya eylem kodu içermez.
[Destek](https://firebase.google.com/support/troubleshooter/auth/email/help?hl=en-US),
[varsayılan eylem sayfası](https://firebase.google.com/docs/auth/custom-email-handler).

1. Üretim için imzalı kimlik ve anlık sağlayıcı durum kontrolü; mevcut Koru
   formları/HttpOnly oturumları, yenileme ve kesintide güvenli ret. Mevcut
   `firebase-local` bayrağı veya imzasız emülatör doğrulaması ASLA kullanılmaz.
2. Firebase'in gerçek doğrulama/reset postalarının Türkçe şablonu, eylem
   bağlantısı, teslimi, tekrar deneme ve Koru oturum iptali. Yerel posta
   kutusundaki OOB kod okuma köprüsü üretim API'sinde yoktur.
3. Hata anında parola mutasyonu uzlaştırma ve Firebase + çoklu D1 silme
   iş akışı. Yerel freeze bayrağı elle temizlenerek üretim açılmaz.
   Mevcut D1 silme hizmeti Firebase bağlantısı, oturumu veya bekleyen claim
   saptarsa **hiçbir grup verisini silmeden durur**; sağlayıcıyla kalıcı silme
   koordinasyonu tamamlanmış değildir.
4. Mevcut altı canlı hesabın eski hesap kanıtı + doğrulanmış yeni UID ile
   tekil, yeniden oynatılamayan bağlanması. E-posta/isim benzerliği, ortak
   destek adresi veya test kimlikleriyle otomatik bağlama yapılmaz.
5. Taze yedek, şema doğrulaması, eklemeli migration, yeni boş grup havuzları,
   Turnstile, kapasite/izleme, biyometri kapalı genel yayın politikaları.
6. Sabit sürüm testi/audit, gerçek telefon PWA/paylaşım kabulü ve yayın kapısı
   geçtikten sonra uygulama dağıtımı/Custom Domain ve gerçek HTTPS smoke testi.

Mevcut kanonik D1 kimliği korunur; staging'deki hesap, grup ve fotoğraflar
taşınmaz. Ücretli Blaze, kart veya gereksiz Google hizmeti açılmaz.
[Veri geçişi](PRODUCTION_MIGRATION.md), [yayın kapısı](WEB_RELEASE.md).

Kaynak: [Firebase web yapılandırması](https://firebase.google.com/docs/web/learn-more#config-object),
[API anahtarı sınırları](https://firebase.google.com/docs/projects/api-keys),
[parola doğrulaması](https://firebase.google.com/docs/auth/web/password-auth).
