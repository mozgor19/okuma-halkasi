# Koru Genel Web Yayını

19 Ekim 2026. Uygulama yayına hazırlıktır; üretim uygulaması dağıtılmadı. Native uygulama
ertelidir. `main` değişmez; dal `work/koru-web-pwa-20261019` olarak kalır.

**20 Ekim güncel karar:** Seçilen C sayfa/yaprak logosunun entegrasyonu ve
ardından canlıya geçiş istendi. Üretim için testten ayrı Firebase proje kimliği
`koru-951bf` bildirildi. Aşağıdaki eski taslak-only/DNS-only kayıtları
tarihseldir. Yerel emülatör entegrasyonu gerçek üretim entegrasyonu değildir;
mevcut canlı D1 korunur, staging hesapları/grupları taşınmaz. Ücretli plan ve
kanıtsız yayın kapısı geçişi yoktur.

Operatör sonradan yalnız ayrı kamusal bilgi sayfaları için sınırlı Cloudflare
dağıtımını onayladı. [Kapsam, ayrı hedef ve Google adımları](PUBLIC_INFO_SITE.md).
Bu, genel kayıt veya mevcut uygulamayı güncelleme onayı değildir.

19 Ekim sonraki karar: Mustafa `birkoru.com` alanını Turkticaret.net'ten aldı.
Yalnız DNS/geçiş hazırlığı onaylandı. Aşağıdaki çalışan Workers origin'i ve
kodda bu adrese bağlı kontroller henüz değiştirilmedi. Yeni adresin geçişi
[DOMAIN_TRANSITION.md](DOMAIN_TRANSITION.md) içinde, ayrı uygulama/SQL/dağıtım
onayı gerektiren aşamalarla tutulur. Yeni logo yalnız taslak aşamasındadır.

Son karar: alanı geçici bilgi sayfasına bağlamak yerine **önce uygulama
engelleri** kapatılacak. 19 Ekim izole uzak parola testi 100k'yı çalıştırdı,
200k ve 600k'yı runtime sınırıyla reddetti; test Worker'ı kaldırıldı ve asıl
Worker'ların değişmediği doğrulandı. Bu artık ölçülmüş bir engeldir.
[Yalnız yerel onaylı Firebase planı](FIREBASE_AUTH_PLAN.md) çözüm adayıdır,
canlı entegrasyon değildir. [Yerel veri silme prototipi](ACCOUNT_ERASURE.md)
de eklendi; işletim/restore/hukuki kabul açık.

## Mevcut Çalışan Adres

İlk yayın: https://okuma-halkasi.mustafayapayzeka.workers.dev.
Mustafa önce ücretsiz Workers adresini onayladı; satın alınan özel alan adı
henüz bu uygulamaya bağlanmadı.
Yayın kapısı yalnız bu Workers origin'ini kabul eder; staging/başka Workers
adreslerini etmez. İleride domain değişirse canonical/OG, Turnstile ve posta
birlikte incelenir. Eski origin'in çerezleri otomatik taşınmaz.

## Kodda Hazırlananlar

- Mevcut ortamların 100.000 parola maliyeti varsayılan olarak korunur.
  `PASSWORD_HASH_ITERATIONS=600000` yalnız doğrulanmış çalışma zamanı için
  bir adaydır; yerel üretim testinde açıkça kullanılır, uzakta etkinleştirilmedi.
  Yükseltmede sürüm/hash/salt eşleşmeden yazılmaz; eşzamanlı reset kazanır.
- `node:crypto` yolu yerel workerd'de standart vektörle sınandı. Bu **uzak
  ücretsiz Workers CPU/sınır kabulü değildir**. Uzak kabul olmadan çıkılmaz;
  maliyeti sessizce düşüren fallback yoktur. Genel Koru kaydı eski maliyetle
  açılmaz. Node API de `checkPbkdfLimits` kullanır; üretim PBKDF2 sınırını
  aşan bir yol değildir. Platform/maliyet engeli çözülmeden uzak ayarı
  600000 yapma; ücretli plana geçmek de tek başına çözüm sayılmaz.
- Koru üretim yanıtları nonce + `strict-dynamic`, yasak inline handler ve
  no-store kullanır. Framework/tema scriptleri aynı nonce'i alır; sahte istek
  nonce'i değiştirilir. JavaScript `unsafe-eval` yoktur; dar WebAssembly
  izni ayrıdır. Eski marka/feature-off webin script politikası korunur.
- Ana ekranın ilk verisi aynı yetkili `/api/state` handler'ından sunucuda
  alınır; alternatif yetkilendirme/iç HTTP çağrısı yoktur. Özel HTML
  no-store'dur ve SW'ye kaydedilmez. Medya ilk render'da da gruba bağlıdır.
  Paylaşılan buluşma linki mevcut akışı korur. Profil/diyaloglar gerektiğinde
  yüklenir; arama kısayolu ve kayıtlı katılımcı önizlemesi korunur.
- Genel yayın politikası `FACE_RECOGNITION_ENABLED=false` ister. Yüz
  yükleme/okuma/eşleştirme API'leri de kapanır. Albüm, normal fotoğraf ve
  elle katılım korunur; mevcut kendi yüz verisini silme kullanılabilir.
  Anahtar eski veriyi kendiliğinden silmez. Ayrı biyometrik onay beklenir.
- Tam test paketine workerd parola vektörü ve gerçek üretim paketiyle
  CSP/SSR/grup izolasyonu/biyometri kontrolleri eklendi. Dört görünümün
  390/1440 açık/koyu kabulü bu paketin parçasıdır.

## Canlı Envanter

`corepack pnpm web:preflight` yalnız Worker ayarlarını ve tablo şemasını
okur. SQL yazmaz, hesap içeriği/sır okumaz, deploy yapmaz. Özel rapor:
`.sites-runtime/koru-production/preflight.json`; Git'e eklenmez.

19 Ekim okumasında canlı Worker tek DB'ye bağlıydı. Yeni hesap/grup
yapılandırması, posta/Turnstile ve `0008`-`0011` tabloları hazır değildi.
Tablo varlığı migration onayı değildir; sütun/indeks/ilişkiler ve mevcut
verinin korunduğu ayrıca incelenir. Staging başarısını canlı başarısı diye
sunma. Mevcut eski canlı web korundu.

## Google Ekranındaki Adım

Operatör Gmail uygulamasının hâlâ **Testing** olduğunu bildirdi.

1. Google Cloud'da Gmail API'yi açtığın doğru projeyi seç. Mevcut staging
   OAuth istemcisiyle eşleşen proje kimliği `koru-mail` olarak doğrulandı.
2. [Bu projenin Audience ekranına](https://console.cloud.google.com/auth/audience?project=koru-mail)
   gir: **Google Auth Platform > Audience / Hedef kitle**.
3. **Publishing status > Publish app / Uygulamayı yayınla** adımını incele.
   Bu Cloudflare/web sitesini yayımlamaz; OAuth projesinin durumudur.
4. Google ek doğrulama istiyorsa atlama. Yalnız Gmail gönderme izni
   kullanılır; ziyaretçilerden Google hesabına bağlanması istenmez.
5. Durum **In production** olduğunda bildir. JSON içeriği, anahtar veya
   doğrulama bağlantısı paylaşma.

Operatör ekranında durum **Testing** olarak doğrulandı. `Publish app`
düğmesi Branding eksikliği nedeniyle pasif; tanıtım/gizlilik/koşullar
bağlantıları boştu. Üretim durumu doğrulanmış değildir.
`In production` veya `Back to testing` görünüyorsa Test'e geri dönme.
Bölüm görünmüyorsa yalnız durum kartının ekran görüntüsüyle doğru proje,
hesap ve erişim durumu incelenir; düğmenin yokluğundan yayın yapıldığı
sonucu çıkarılmaz. [Google durum açıklaması](https://support.google.com/cloud/answer/15549945?hl=en).

Test durumundaki Gmail yenileme yetkisi yedi günlük sınıra tabidir. Eski
yetkinin tarihini veya ortam adını düzenleyerek üretim yetkisine dönüştürme.
Durum ve politika gereklilikleri doğrulandıktan sonra AYRI yetki alınır:

```bash
nvm use 24
node scripts/gmail-oauth.mjs /home/mustafa/Downloads --production --confirm-google-production
```

Komut yerel tarayıcı onayı ister, staging yetkisini değiştirmez ve kendisi
Cloudflare'a Secret yüklemez. Dosya yalnız
`.sites-runtime/koru-production/gmail-authorization.json` içinde 0600 izniyle
tutulur. Onay bayrağı operatör beyanıdır; araç Google Console durumunu API
ile doğrulayamaz. Durum kanıtı, gerçek teslim/reset testi ve hata/kota
izlemesi ayrıca gerekir. İki ortam birbirinin yetkisini kabul etmez.

[Google OAuth durumları](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview),
[hassas kapsam değerlendirmesi](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
Üretim durumu doğrulama yükümlülüğünü kendiliğinden kaldırmaz ve token'ın
asla iptal olmayacağı garantisini vermez.

## Açık Yayın İşleri

1. **Posta:** Ayrı üretim yetkisi/Secret, gerçek doğrulama-reset teslimi ve
   arıza takibi. Gmail kutusunu açmak tek başına kalıcı gönderim değildir.
2. **Veri güvenliği:** Mevcut tek üretim D1'inin şifreli yedeği ve izole uzak
   restore provası 19 Ekim'de geçti; [kanıt/sınırlar](BACKUP_RESTORE.md).
   Yeni migration öncesi taze yedek, geri dönüş/saklama planı ve yalnız gereken
   SQL için açık onay hâlâ gerekir. Üretim yedeği test/staging kullanıcılarına
   açılmaz; dolu DB'ler sıfırlanmaz.
3. **Kapasite:** Boş, migration'ı doğrulanmış üretim grup DB'si bağlanmalı.
   Staging'in iki oluşturma yuvası gerçek deneme gruplarıyla dolu. Bir grup
   bir DB kullanır; ücretsiz plan sınırsız grup/medya demek değildir.
4. **Veri hakları:** Silme talebi gerçek silme değildir. Kuyruk/sorumlu,
   yanıt/saklama takvimi, son yönetici devri, aktif/pasif üyeliklerde çoklu-D1
   silme/anonimleştirme ve restore sonrası tekrar silme tamamlanmalı.
   Gizlilik/koşullar sınırlı deneme metnidir; genel kullanım için hukuki,
   sağlayıcı/aktarım ve saklama incelemesi yapılmalı. Biyometri kapalı kalır.
5. **Kabul:** Uzak ücretsiz Workers parola/yük sınırı; gerçek Android Chrome
   ve iPhone Safari PWA/klavye/offline/güncelleme; sosyal önizleme;
   performans/erişilebilirlik ve bağımsız güvenlik incelemesi.
6. **İşletim:** Workers Builds dal tetikleyicisi panelde doğrulanmalı. Test,
   audit ve manuel kanıt olmadan main/panel deploy'u yapılmaz. Kota, destek,
   güvenlik olayı ve geri dönüş sorumlusu belirlenir; dağıtım ayrıca onaylanır.

[Workers sınırları](https://developers.cloudflare.com/workers/platform/limits/),
[OWASP parola saklama](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
[Cloudflare Node PBKDF2 uygulaması](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/node/crypto.c%2B%2B),
[üretim sınırı kaydı](https://github.com/cloudflare/workerd/issues/1346).
Yerel duvar saati CPU kanıtı değildir. Ücretli plan/hizmet açılmadı;
ücretsiz koşullarda başarısız mimari yayına zorlanmaz.

## Sabit Sürüm Kontrolü

```bash
corepack pnpm test:release
node scripts/security-audit.mjs
corepack pnpm web:preflight
corepack pnpm web:release:check --suite=outputs/release-tests/TEST_ID/suite-report.json --evidence=.sites-runtime/web-release-evidence.json
```

Raporlar aynı commit/sourceDigest'e ait ve kaynak temiz olmalı. Eksik
fiziksel/hukuki/işletim kanıtını araçlar üretmez. Doğrudan
`dist/server/wrangler.json` ile deploy etme: üretim DB binding'i içerir.
Bu çalışma üretim deploy otomasyonunu kurulmuş saymaz.

`public-release-20261019-candidate` tam koşusu PWA testinde başarısız oldu:
ilk giriş turu hesap menüsünü kapatıyordu. Turun kullanıcı gibi ertelenmesi,
hesaplar arası durumun başlangıç kaydıyla kıyaslanması ve geliştirme ortamına
gereksiz nonce taşınmaması düzeltildi. Bu koşu geçer rapor sayılmaz.
Bu düzeltmeler sonrası tam paket raporu için planlanan ad:
`outputs/release-tests/public-release-20261019-verified/suite-report.json`.
Yalnız dosyanın gerçek `status` alanı başarıyı gösterir; yoksa/farklı
kaynaktaysa geçmiş raporla ikame edilmez. Hız ölçümleri:
`outputs/release-tests/public-web-20261019/web-performance/report.json`.
Üç örnek/durum, yerel üretim paketi ve yavaş mobil ağ/CPU koşullarıdır;
gerçek telefon/internet kabulü değildir.
