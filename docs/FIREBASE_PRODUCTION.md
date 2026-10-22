# Koru Üretim Firebase Hazırlığı

## E-posta Doğrulama Takibi: Yerel Düzeltme

22 Ekim: Firebase'in varsayılan doğrulama sayfası yalnız sağlayıcı kaydını
doğrular. Eski Koru hesabıyla eşleştirme, mevcut kullanıcı adı ve bağlama
sırasında seçilen **yeni hesap şifresiyle** girişte tamamlanır. Eski kayıtlı
şifreyle giriş eski oturumu koruyabilir; yalnız bağlantıyı açmak Koru profilini
doğrulanmış yapmıyordu. Mevcut canlı kullanıcı yeni hesap şifresiyle tekrar
giriş yaparak bu son adımı tamamlayabilir. Parola veya bağlantı istemeyin.

Yerel düzeltme: `/auth/email` geçerli koddan dönen sağlayıcı UID/e-postasını
checkpoint ve hesap sürümüyle eşleştirip provision işlemini de yapar. Varsayılan
Firebase sayfası için dönüş `/account` olur; bekleyen eski hesabın tamamlama
formu yalnız doğrulanmış Firebase şifresi kabul eden giriş yolunu kullanır.
Eski şifreye fallback yoktur. Roller/gruplar/kimlik ve oturum iptali korunur;
veritabanı migration'ı gerekmez. **Bu bölüm yeni canlı dağıtım kaydı değildir.**
Gerçek hesap/posta, sağlayıcı ayarı veya üretim verisi değiştirilmedi.

### Konuda Neden Proje Kimliği Görünüyor?

Varsayılan şablondaki `%APP_NAME%`, Firebase'in **Public-facing name** değeridir.
Sender name ve Reply to alanları bunu değiştirmez. İç Project name, Project ID
ve web uygulaması takma adı da bu ayarın yerine geçmez.

1. [Üretim proje ayarlarını](https://console.firebase.google.com/project/koru-951bf/settings/general) aç.
2. **General > Public settings > Public-facing name** alanını `Koru` yap ve kaydet.
3. **Project ID** `koru-951bf` olarak kalmalı. Spark, Email/Password ve gönderici
   ayarları değişmemeli; yeni sağlayıcı, ücretli plan veya yeni proje açma.
4. Bu alan panelinde görünmüyorsa Firebase Support'a yalnız alanın görünmediğini
   bildir; şablon kısıtını API ile aşmaya çalışma. Ekran düzeni hesapta ayrıca
   doğrulanmadı. Eski postaların konusu değişmez; yeni postada kontrol edilir.

Kaynak: [Firebase şablon yer tutucuları](https://support.google.com/firebase/answer/7000714?hl=en),
[public-facing name](https://support.google.com/firebase/answer/9137752?hl=en).
Bu ayar bu çalışmada değiştirilmedi ve yeni gerçek test postası gönderilmedi.

## Son Yayın: 22 Ekim Bildirim ve PWA

21:32TRT, kaynak `370c0d0`, Worker `3de95dfd-8c5e-46da-963a-efadab32fc38`
%100; birkoru.com açık, bakım kapalı. Yalnız doğrulama bildirimi/mobil kurulum
teklifi ve zorunlu Next16.4.1 güvenlik düzeltmesi yayımlandı. Hesap/parola
backend'i, Firebase/Turnstile, Secret'lar, üç DB/ortak okuyucular, diğer
Worker'lar, mail OFF ve main korundu. Mevcut `/account` yeniden kullanılır;
yeni otomatik posta veya gerçek test hesabı yok. Üç şifreli yedek/offline
restore ve birebir veri kontrolü geçti. Üçüncü export durduğunda özgün kayıt
korunarak aynı sahipliği doğrulanan bakım sürümünden devam edildi. SQL yok;
0015/16/17/18'i tekrarlama. Yeni akış13+13/form WebKit18/audit geçti;
uygulaması değişmeyen851660c çekirdek/üretim kanıtı doğrulanmış devamla
korundu. Tam paket/13 manuel/gerçek cihaz kabulü bekliyor. Canlı anonim altı
sağlık kontrolü ve dosya kimliği geçti. Kaynak coauthorsuz çalışma dalına
push edildi; yeni onay tüketildi, belge commit'i yeni yayın değildir.
Kanıt: `outputs/web-acceptance/370c0d0/` ve SESSION_MEMORY.md.

## Önceki Yayın: 22 Ekim Buluşma Formu

09:48TRT, kaynak `26e6f90`, Worker `93ce9f97-2cf2-43d9-ab0d-9584a17c7562`
%100; birkoru.com açık, bakım kapalı. Yalnız mobil buluşma düzenleme formuna
genişlik/yatay kaydırma sınırı eklendi. Firebase, hesap/posta, backend,
Secret'lar, üç DB/ortak okuyucular, diğer Worker'lar ve main değişmedi.
Üç taze şifreli yedek/offline restore/birebir eski veri karşılaştırması geçti;
SQL/migration yok. Kaynak coauthorsuz çalışma dalına push edilerek yayımlandı.
Güncel audit, tip/lint/derleme, gerçek üretim WebKit18/Chromium6 ve anonim
canlı dosya kimliği kontrolleri geçti. Yeni talep yalnız kritik kontrollere
özeldi; tam paket ve13 manuel başlık/gerçek iPhone hâlâ bekliyor, geçmiş sayılmaz.
Yetki tüketildi. Kanıt: `outputs/web-acceptance/26e6f90/`; sonraki belge
commit'i yeni uygulama yayını değildir.0015/16/17/18'i yeniden çalıştırma.

## Önceki Yayın: 22 Ekim Mobil Form Takibi

22 Ekim00:49TRT: `https://birkoru.com`, kaynak `6762dc8`, Worker
`25afe82b-b410-4184-ace0-58e44a6f7865` (%100), bakım kapalı.
Gerçek üretim CSS'inde yeniden üretilen çift kaydırma düzeltildi:
mobil Koru formlarında `%50` translate utility'si üretilmiyor. Masaüstü,
eski web, renk/marka ve hesap/veri işlemleri korunur. [Kapsam](MOBILE_DIALOG_HOTFIX.md).

Mustafa geniş testleri durdurup doğrudan yayın istedi.14 otomatik adım ve
minify edilmiş üretim paketinde Chromium32/WebKit32 form yerleşimi geçti;
tam23 adım geçmedi. İptal edilen legacy ve sonraki8 otomatik kontrol ile
13 manuel kategori/gerçek iPhone klavyesi bekliyor; geçmiş sayılmadı.
Standart kapı geçilmedi; bu sürüme özel yeni talep tüketildi, genel yetki değildir.

Üç DB'nin taze şifreli yedeği, diskten çözme/offline restore ve eski şema,
tipli satır, medya/sayaç karşılaştırması geçti. SQL/migration YOK;
0015/16/17/18'i tekrarlama. Firebase/oturum/Turnstile Secret'ları, paylaşılan
okuyucular, üç DB, domainler, staging/public-info ve mail OFF korundu.
Temiz kaynak coauthor olmadan çalışma dalına push edildi; main değişmedi.
Kanıt: `outputs/web-acceptance/6762dc8/production-outcome.json`,
`outputs/release-tests/mobile-stable-release-20261022-r5/`, ayrı üretim
WebKit raporu. Rollout `71670020-61ab-4629-be60-f51bf93557d2` yeniden çalıştırılmaz.
Sonraki belge commit'i yeni uygulama dağıtımı değildir.

## Önceki Yayın: Acil Mobil Form Düzeltmesi

21 Ekim 2026,23:44TRT: `https://birkoru.com`, uygulama kaynağı
`aa6df77e14772cca67efc8ba61e437061edc0eec`, Worker sürümü
`e6d97ef8-d8c7-4803-af9c-693b3be0ebe0` (%100); bakım kapalı.
Mustafa'nın gerçek iPhone görüntüleriyle bildirdiği acil portal form sorunu
için yeni, yalnız bu kaynağa bağlı yayın talebi uygulandı.

Ürün değişikliği yalnız form CSS'i ve PwaLifecycle'ın form içi odak kaydırması:
mobil girdiler16px, tarih/dosya/metin alanları genişlik sınırında, uzun form
kendi içinde kaydırılabilir, aktif alt alan klavyenin üstünde tutulur. Sayfa
veya odak zorla değiştirilmez. Renk, marka, font dosyası, hesap/grup iş kuralları,
backend, bağımlılıklar ve native kod değişmedi. [Kapsam](MOBILE_DIALOG_HOTFIX.md).

Aynı temiz kaynakta23 aşama geçti. Port çakışması ve sonraki tarayıcı zaman
aşımlarının başarısız raporları korundu; kaynak/veri değişmeden12 başarılı
adım özgün rapor SHA'sıyla doğrulanarak devam edildi, başarısız görsel adım
ve kalan bütün adımlar yeniden çalıştırıldı.211 mevcut ekran,22 hesap akışı,
59PWA,43+8 deneyim; son refinements12 kontrol/327 görüntü,128 yeni form
yerleşimi dahil. Ayrı temiz kaynaklı WebKit128 yerleşim/96 görüntü başarılı.
Güncel audit'te yüksek/kritik web bulgusu yok; eski düşük/orta ve ertelenen
native bulgular sürüyor. Bunlar gerçek iPhone klavyesi kabulü değildir.

Üç DB'nin taze şifreli yedeği, diskten çözme/çevrimdışı restore ve tüm eski
şema/tipli satır/medya/sayaç karşılaştırması geçti. **SQL yazımı veya migration
YOK;0015/0016/0017/0018'i yeniden çalıştırma.** Mevcut üç DB/ortak okuyucular,
Secret'lar, alan adları, staging/public-info ve `MEETING_MAIL_ENABLED=false`
korundu. Firebase hesap postaları değişmedi. Main veya ücretli plan değişmedi.

Yayın sonrası15 anonim gerçek HTTPS/PWA kontrolü ve16 açık/koyu mobil/masaüstü
görüntü geçti; yeni JS/CSS test edilen paketle birebir. Gerçek hesap veya posta
oluşturulmadı. Kaynak coauthor olmadan çalışma dalına push edilerek yayımlandı.
13 manuel başlık hâlâ bekliyor; standart manuel kapı geçilmedi. Bu acil talep
tüketildi, sonraki dağıtıma genel yetki değildir.

Git dışı kanıt: `outputs/release-tests/mobile-dialog-release-aa6df77-r2/suite-report-continued.json`,
`outputs/release-tests/mobile-dialog-hotfix-20261021-a/mobile-dialogs-webkit/report.json`,
`outputs/web-acceptance/aa6df77/{production-outcome,production-smoke}.json`.
Özel rollout `dd734285-af9c-466c-89b2-54a4767a9196`; şifreli yedekler ve
ayrı anahtarlar Git dışı. Sonraki belge commit'i uygulama dağıtımı değildir.

## Önceki Yayın: Yerleşim, İlk Grup Turu ve Grup Görseli

21 Ekim 2026,17:03TRT: `https://birkoru.com`, uygulama kaynağı
`86225c25216b2e74f7a6a00d2119ed8aeaf2e8ee`, Worker sürümü
`bcdd561c-bae2-44fc-b349-d1faf74940f8` (%100); bakım kapalı.
Masaüstü galeri aralıkları, ilk başarılı grup kurma/katılma sonrası tur,
son adımda dört görünüm ve renk modu seçimi, hesap varsayılanı, koyu boş durum
karşıtlığı ve Defter'de gerçek grup görselinin gösterilmesi yayında.
Açık paletler, logo/fontlar ve önceki hesapların tur durumu korundu.

Üç üretim DB'sinin taze AES-256-GCM yedeği, diskten çözme ve çevrimdışı
geri yüklemesi doğrulandı. Yalnız kanonik DB'ye `0018_account_appearance`
uygulandı; yeni tablo boş, mevcut tercih ve tur satırları değiştirilmedi.
Eski şema, tipli kayıtlar, medya ve kimlik sayaçları işlemden önce/sonra
birebir eşleşti. **0015/0016/0017/0018'i tekrar çalıştırma.** Dedicated DB'lere
hesap tablosu ekleme; ortak okuyucular ve üç mevcut bağlantı korunur.

Coauthor içermeyen temiz kaynak dağıtımdan önce çalışma dalına push edildi;
main değişmedi. Tam paket23/23 geçti; taze web audit'te high/critical web
bulgusu yok (düşük/orta ve ertelenen mobil bulgular sürüyor). İlk6922193
koşumundaki eski tur beklentisi testte düzeltildi; başarısız rapor korundu,
86225c2 için23 adımın tamamı yeniden çalıştırıldı. Son adım11 kontrol/231
görüntü,80 galeri,48 boş durum ve gerçek dosya seçici/piksel denetimli32
grup görseli yerleşimini içeriyor.

Canlı15/15 anonim HTTPS kontrolü geçti: gerçek JS/CSS dosyaları derlemeyle
birebir, güvenlik/yetki ve yönlendirmeler doğru, dört görünüm açık/koyu
390/1440px'de taşmıyor, PWA çevrimdışı/yeniden bağlanma çalışıyor. Sistem
DNS'i ve normal TLS kullanıldı; hesap açılmadı veya posta gönderilmedi.
Firebase/Turnstile/oturum Secret'ları, staging/public-info ayarları, alan adı
bağlantıları ve ücretli planlar değiştirilmedi. Buluşma postası hâlâ
`MEETING_MAIL_ENABLED=false`; Firebase hesap postaları değişmedi.

13 manuel kabul başlığı BEKLİYOR. Fiziksel Android/iPhone, gerçek sağlayıcı
postası/hesap işlemleri ve ayrıcalıklı silme bu kontrollerle tamamlanmış
sayılmaz. Mustafa'nın bu sürüme özel yeni yayın talebi tüketildi; standart
manuel kapı geçti veya sonraki yayına genel yetki var denemez.

Kanıtlar (Git dışı): `outputs/release-tests/web-layout-release-86225c2-r1/suite-report.json`,
`outputs/web-acceptance/86225c2/production-outcome.json`, `production-smoke.json`.
Özel rollout: `ef080773-0572-40bb-a2a0-1f7398af2141`; şifreli yedekler ve
ayrı anahtarlar Git dışındadır. Rollout'u yeniden çalıştırma, tabloları silme
veya yeni yazmaların üzerine yedek dökme. Sorunda yeni şemayı ve ortak
okuyucuları koruyarak düzelt; sonraki belge commit'i uygulama dağıtımı değildir.

## Önceki Yayın: Web İyileştirmeleri

21 Ekim 2026,10:06TRT: `https://birkoru.com`, uygulama kaynağı
`77a69c50d58d55113b6a9ae2b1faeccdac5db713`, Worker sürümü
`70d23f67-3946-4213-8755-548bbaf4d5a7` (%100); bakım kapalı.
Tur, çevrim içi/yüz yüze buluşma, grup görseli, yazı/aralık ve dört koyu palet
iyileştirmeleri yayında. Açık renkler, logo ve mevcut kullanıcı verileri korundu.

Üç üretim DB'sinin ayrı şifreli yedeği, diskten çözme/yerel geri yükleme ve
eklemeli SQL provası geçti. `0016` üç DB'ye, `0017` yalnız kanonik DB'ye uygulandı;
eski şema, tipli kayıtlar, medya ve kimlik sayaçları birebir karşılaştırıldı.
**Bu migration'ları yeniden çalıştırma.** Ortak grup okuyucuları, mevcut
dedicated bağlantıları ve Firebase/Turnstile/oturum Secret'ları korunuyor.

Temiz ve push edilmiş kaynağın23 aşamalı paketi ile güncel web bağımlılık
taraması geçti; yeni üretim paketi oluşturuldu. Yayın sonrası15 anonim gerçek
HTTPS kontrolü: güvenlik/yetki, gerçek JS/CSS eşleşmesi, dört görünümün açık/koyu
390/1440 ekranları ve PWA offline/online dönüşü geçti. Testte kullanıcı
oluşturulmadı veya posta gönderilmedi. Main, staging, DNS ve ücretli plan değişmedi.

**Buluşma değişikliği postası henüz kapalı:** `MEETING_MAIL_ENABLED=false`.
[Gönderici kurulumu](MEETING_MAIL.md) tamamlanmalı; Firebase doğrulama ve şifre
postaları bundan ayrı ve değiştirilmedi. Gerçek posta/cihaz/harici takvim
teslimi bu anonim testlerle onaylanmış sayılmaz. Mustafa'nın bu yayına özel
talebi kaydedildi;13 manuel kabul başlığı hâlâ bekliyor, standart manuel kapı
geçmedi. Önceki yayın istisnaları tekrar kullanılmadı, bu talep de gelecek
yayınlar için genel yetki değildir.

Kanıtlar (Git dışı): `outputs/release-tests/web-refinements-r7-20261021/`,
`outputs/web-acceptance/77a69c5/production-outcome.json`, `production-smoke.json`;
özel rollout `fdc40b90-f81e-428a-8feb-6f4496a4da84`. Şifreli yedekler ve ayrı
anahtarları Git dışındadır. Yeni verilerin üzerine yedek dökme, yeni tabloları
silme veya çevrim içi buluşmaları okumayan eski kodu geri getirme; sorun olursa
yazmaları durdurup mevcut yeni şemayla düzelt. Sonraki doküman commit'i yeni
uygulama dağıtımı değildir.

## Önceki Yayın: Ortak Grup Depolaması

20 Ekim 2026, 23:18 TRT: `https://birkoru.com`, kaynak
`d6a1c4d720317c29c0fd366afb7582ab32f07ebf`, Cloudflare sürümü
`fc31de5a-5c8f-4e7b-9645-81f151453374` (%100).
[Ortak grup depolaması](SHARED_GROUP_STORAGE.md) etkin: yeni gruplar kanonik
D1'de `group_id` ile ayrılır; toplam üç grup darboğazı kaldırıldı. Hesap başına
üç grup kurma ve yirmi üyelik sınırı ile ücretsiz hizmet kotaları devam ediyor.

Yalnız ekleyici `0015` uygulandı. Mevcut grupların depoları, kimlikleri, rolleri
ve medyası taşınmadı. Taze şifreli yedek, çevrimdışı geri yükleme/0015 provası
ve eski şema/tipli satır/medya/sıra değerlerinin birebir karşılaştırması geçti.
Üç DB bağlantısı korunuyor; 14 yeni ortak grup tablosu yalnız kanonik DB'de.
`SHARED_GROUPS_ENABLED=true`, `SELF_SERVICE_GROUP_BINDINGS=[]`, bakım kapalı.

İlk deneme, eski yedek aracının tek bağlantı varsayımında SQL uygulanmadan
durdu; bakım kapatıldı, kontrol düzeltildi ve temiz yeni kaynakta testler
yenilendi. Son sürüm21/21 yayın adımını (269 kök birim testi dahil), güncel
web bağımlılık taramasını ve gerçek HTTPS üzerinde14 anonim tarayıcı/PWA
kontrolünü geçti. Son smoke normal sistem DNS'i ve TLS doğrulaması kullandı.
Staging aktarılmadı, DB sıfırlanmadı, ücretli hizmet/ek test hesabı/posta açılmadı.
Kaynak coauthor olmadan çalışma dalına gönderildi; main değişmedi.

Bu güncellemeye özel açık risk kabulü kullanıldı ve tüketildi. 13 manuel
kabul başlığı hâlâ bekliyor; fiziksel telefon, gerçek üretim postası/hesap
ve ayrıcalıklı silme/çoklu-DB felaket kurtarma başarılı gösterilmedi.
Sonraki yayınlar için bu karar tekrar kullanılamaz. `0015` tekrar uygulanmaz;
geri adımda ortak okuyucular korunur, gerekirse yalnız yeni grup kurma durdurulur.

Kanıtlar (Git dışı): `outputs/release-tests/shared-groups-clean-d6a1c4d/suite-report.json`,
`outputs/web-acceptance/d6a1c4d/production-outcome.json`, `production-smoke.json`;
özel rollout `838d658f-46c7-4fe5-8f42-ff773d4233e8`, taze yedek
`cdfc3f87-d1b1-49c8-8609-abf4c11c1725`. Kullanıcı verisi/anahtarlar Git dışındadır.

## İlk Genel Yayın Kaydı: 20 Ekim 2026

`https://birkoru.com` genel erişime açıldı; `www` ve eski workers.dev adresi
aynı HTTPS adrese yönleniyor. İlk açılışta yayınlanan kaynak commit'i
`1c1b235d75e0162a1c1bd3b6387bb07ce5eececf`, Cloudflare sürümü
`7a93d173-3973-45e3-a05b-0691abad4c6e` (%100). Main'e dokunulmadı; kaynak
coauthor olmadan çalışma dalına commit/push edildikten sonra dağıtıldı.

Kanonik D1 değişmedi. Taze şifreli yedekten çevrimdışı geri yükleme/prova,
atomik 0008-0014 güncellemesi ve eski/yeni satırların tip/değer/medya/sıra
karşılaştırması tamamlandı: altı eski hesap, 13 eski tablo ve 75 satır
korundu, 21 yeni tablo eklendi. İki KALICI boş üretim grup D1'i hazırlandı;
staging aktarılmadı/değişmedi. Hesaplar Firebase'e otomatik ithal edilmedi;
eski hesap kanıtı ve doğrulanmış yeni UID ile sahiplik akışı geçerli.

Üretim Firebase/Turnstile/işletim Secret'ları ve güvenli bayrakları yerinde;
eski bootstrap kaldırıldı, SESSION_SECRET korundu. Biyometri kapalı.
Üç D1 için salt okunur üretim önkontrolü sıfır engel bildirdi. Ücretli plan,
ek uzak test hesabı, geçici test veritabanı veya test postası oluşturulmadı.

Temiz kaynak regresyonu21/21 ve güncel web bağımlılık taraması geçti;
web high/critical bulgusu yok, düşük/orta bulgular ve ertelenen mobil uyarılar
sürüyor. Gerçek HTTPS üzerinde anonim Chromium smoke14/14: sayfalar, nonce
CSP/no-store, yetkisiz erişim reddi, onaylı C simge/paylaşım görselinin birebir
eşleşmesi, 390/1440 açık/koyu görünüm, anonim önbellek ve offline/online dönüşü.
DNS100117 çakışmasında operatör yalnız eski A/www kayıtlarını sildi; DNS
API403 kısıtı aşılmadı. Genel DNS yeni Cloudflare NS/IP'lerini doğruladı.
Sistem önbellekleri eski/NXDOMAIN verdiğinden son tarayıcı testinde güncel
genel DNS kullanıldı; normal hostname/TLS doğrulaması kapatılmadı. Bu durum
raporda açık, ilk sistem-DNS hata raporu da tutuluyor.

**Bu standart yayın kapısı geçti demek değildir.** Mustafa ilk açılışı altı
hesapla sınırlamak yerine kamuya açık istedi; ayrı, sürüme bağlı risk kararı
kaydedildi. 13 elle kabul başlığı beklemede kaldı. Gerçek üretim hesabı/parolası,
doğrulama/reset postası, fiziksel Android/iPhone kurulumu, ayrıcalıklı Firebase
silme, tam çoklu-DB geri dönüş, sürekli kapasite izleme ve bağımsız hukuki/
güvenlik değerlendirmesi başarılı gösterilmedi. Sonraki sürümler standart
yayın kapısını kullanmalı. Varsayılan Firebase e-posta Action URL'si korunur;
yeni özel eylem URL'si/posta teslimi ayrıca kabul gerektirir.

Kanıtlar (Git dışı): `outputs/release-tests/web-launch-1c1b235/suite-report.json`,
`outputs/web-acceptance/9d83690/production-smoke.json`,
`.sites-runtime/koru-production/cutover.json`, `preflight.json`.
Taze yedek kimliği `774e0dff-cc70-42e7-958e-5afc6f8648cb`; anahtar ve kullanıcı
verisi Git'e girmez. Aşağıdaki bölümler önceki hazırlık sürecinin tarihçesidir.

## Önceki Hazırlık Kaydı

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
