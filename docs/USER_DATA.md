# Kullanici verileri ve isletim plani

17 Ekim 2026. Bu belge kaynak kodun veri envanteridir; yayinlanmis bir gizlilik
politikasi veya hukuki uygunluk onayi degildir. Canli Cloudflare hesabi, D1
bolgesi, kullanim plani, yedekleri ve mevcut migration'lar uzaktan dogrulanmadi.
18 Ekim guncellemesi: canli adres `okuma-halkasi.mustafayapayzeka.workers.dev`,
ayri test adresi `koru-staging.mustafayapayzeka.workers.dev` olarak belirlendi.
Bes test D1'inin kimlikleri ve migration marker'lari dogrulandi; bu canli DB
migration/bolge dogrulamasi degildir. Gmail yalniz staging'e ozel, gonderme
izniyle baglandi; tek deneme postasi Gelen Kutusu'nda operatorce dogrulandi.
Hizmeti sunan Mustafa Ozgor, destek `koru.destek@gmail.com` olarak belirtildi.
Hukuki sayfalar sinirli deneme kapsamindadir; genel yayin uygunlugu degildir.

## Veri nerede durur?

17 Ekim web kayit eklemesi: kanonik `DB` artik dogrulanmis e-posta,
bekleyen kayitlarin gecici parola hashleri, dogrulama/kurtarma/davet ozetleri,
HMAC'li deneme sayaclari ve grup provizyonlama durumlarini da tutar. Yerel
posta kutusu sadece loopback gelistirmede asil e-posta/token govdesi tutar;
uzak ortamda secilen saglayici (staging Gmail/Google, alternatif Resend) ve
alicinin posta saglayicisi yeni veri isleyen taraflardir. Destek yazismalari
Gmail kutusunda tutulur. Gmail yetkisi posta okumayi kapsamaz.
Yeni akis, saklama/silme ve saglayici sozlesmesi incelemesi gerektirir.
[Ayrintilar](WEB_ONBOARDING.md). Hesap silme istegi bu yeni tablolari da kapsamali.

```text
Web tarayicisi / Android WebView
        | HTTPS ve oturum cerezi
        v
Cloudflare Worker: API, oturum ve grup/rol kontrolu
        |                        |
        v                        v
DB: kanonik hesaplar +       GROUP_* D1: ilgili
varsayilan grup verisi      ek grubun domain verisi
```

Google Play uygulama paketini dagitir; kullanici kitap/yorum/fotograf
veritabanini saklayan yer degildir. Kullanici verisi deposu olarak
Firebase/Firestore kullanilmaz; bildirim SDK'lari ayrica incelenmelidir.
Web ve mobil ayni canli HTTPS backend'ine baglandiginda ayni kalici kayitlari
gorur. Uygulamaya/sekme odagina donus ve yaklasik 30 saniyelik bos zaman
yenilemesi diger cihazdaki degisiklikleri getirir; bu anlik push sync veya
cevrimdisi yazma kuyrugu degildir. Staging kesinlikle farkli veritabanina baglanir.

| Veri | Kodda saklandigi yer / erisim |
| --- | --- |
| Kullanici adi, parola hash/salt, kilit/oturum surumu | Kanonik D1 `member_accounts`; istemciye hash/parola dondurulmez |
| Hesap/uye kimligi, ad, roller | D1 `members`; grup ici rol ilgili grubun yerel uye kaydindan okunur |
| Grup listesi ve uye eslemesi | Kanonik `reading_groups`, `reading_group_memberships`; aktiflik ve gruba ait gorunum |
| Kitap, bulusma, katilim, RSVP, yorum/puan, favori, oy | Secili grubun D1 tablolari; varsayilan grup `DB` icinde |
| Fotograf, avatar, kitap kapagi, yuz referansi | Ayni grubun D1 `media.data` BLOB'u; `photos` ve uye kayitlari medya anahtarini tutar |
| Yuz referansi riza isareti | `members.face_recognition_consent`; bu boolean tek basina surumlu hukuki riza kaniti degildir |
| Yuz vektorleri | `lib/face-recognition.ts` bellek haritasi; kalici DB'ye yazilmaz; grup gecisi tam belge yukler |
| Model dosyalari | `/face-models/` kendi origin'inden; TensorFlow agirlik onbellegi cihazda olabilir |
| Oturum ve secili grup | HttpOnly `okuma_session`, `okuma_group`; WebView'in uygulamaya ait cerez depolamasi |
| Tema/gezinme/bildirim tekrar engeli | WebView localStorage/history; grup gorunumu etkin modda sunucuda hesap+gruba baglidir |
| Paylasilan ZIP/ICS | Native uygulamanin gecici cache alani; 5 dakika sonra/sonraki acilista temizlik denenir |
| Cihaz bildirimleri | Isletim sisteminin yerel bildirim merkezi; kitap/bulusma bilgisi kilit ekraninda gorunebilir |

Kaynaklar: `db/schema.ts`, `db/database.ts`, `db/accounts.ts`, `lib/auth.ts`,
`lib/groups.ts`, `app/api/upload/route.ts`, `app/api/media/[key]/route.ts`,
`mobile/src/web-shell.tsx`, `mobile/src/native-share.ts`.

Su an fotograflar R2/S3'te degil, D1 icindedir. Bu kucuk gruplar icin basit
olsa da buyuyen galeri DB boyutu, row limiti ve yedek suresini etkiler.
R2'ye gecilecekse ayri tasarim/migration ve korumali medya testleri gerekir;
mevcut veriyi sessizce farkli depoya tasima. D1 plan/kota durumunu izle.

## Guvenlik siniri

Parolalar kaynakta duz metin tutulmaz; rastgele salt ile PBKDF2-SHA256 hash'i
kullanilir. `SESSION_SECRET` yalniz sunucudadir. `MEMBER_CREDENTIALS` eski
hesaplari ilk kez gecirmek icin gecici bootstrap sirridir; butun hesaplar
gecince kaldirilmalidir. Sir, hash, cerez veya upload keystore'u Git'e, CI
artifact'ina ya da `EXPO_PUBLIC_*` degiskenine koyma. Parola degisiminde eski
oturum surumleri gecersiz olur; hatali giris kilidi vardir.

API'ler oturum, grup uyeligi ve rol denetler. Yazmalar ayni origin ve
`X-Reading-Group` eslesmesi ister. Korumali medya `private, no-store` doner;
yuz referansini kendisi veya yetkili yonetici okuyabilir. Veri guvenligi
yalniz UI'de dugme gizlemek degildir. Cloudflare panelinde DB'ye yetkili
yonetici ise ilgili veriyi okuyabilir; bu sistem uctan uca sifreleme sunmaz.

Cloudflare D1 diskte ve ag aktariminda kendi yonettigi sifrelemeyi uygular;
bu, uygulama seviyesinde anonimlik veya KVKK uygunlugu garantisi degildir.
[D1 guvenlik belgesi](https://developers.cloudflare.com/d1/reference/data-security/).
Gercek verinin hangi ulkede tutuldugu yalniz bu repodan bilinemez. D1'in
konum/jurisdiction ve varsa replica ayarlari panel/API uzerinden incelenmeli;
bir konum ipucu zorunlu ulke siniri olarak yorumlanmamali.
[D1 konum belgesi](https://developers.cloudflare.com/d1/configuration/data-location/).

Uygulamayi silmek sunucudaki hesabi veya kayitlari silmez. Cikis yapmak da
silme degildir. Paylasim alicisina verilen dosyalar artik alici uygulamada
kalabilir; cache temizligi o kopyayi geri alamaz. Uygulama cerezleri cihazda
korunur, baska tarayiciyla paylasilmaz; Android app backup kapalidir.

## Dis taraflar ve Play Data safety

Bu envanter beyan hazirlamak icindir, Console'da isaretlenmis/onaylanmis degildir:

- Cloudflare: Worker ve D1 veri isleyicisi; istek IP/log/telemetri saklamasi
  gercek hesapta incelenmeli. "Analitik eklemedik" demek altyapinin log
  tutmadigini veya hic veri toplanmadigini kanitlamaz.
- Open Library: kullanicinin kitap arama sorgusu backend tarafindan katalog
  hizmetine iletilebilir. Kapak URL'leri harici sunucudan yuklenebilir.
- Dis harita/kitap linkleri: kullanici actiginda ilgili site/uygulamaya gider;
  secilen bulusma/konum ve ag bilgileri ilgili hizmete ulasabilir.
- Sistem paylasimi: kullanici istediginde baglanti/fotograf albumu/takvim
  bilgisi sectigi uygulamaya aktarilir; bunu beyan kapsaminda degerlendir.
- Human/TensorFlow yuz islemi cihazdadir, harici AI servisine foto/vektor
  gonderen bir akis yoktur. Referans fotografinin D1'e yuklenmesi yine veri
  toplamadir; "her sey cihazda" diye beyan etme.
- Native bildirimler yereldir; kodda FCM/APNs token kaydi veya sunucudan yeni
  olay push altyapisi yoktur. SDK'larin gercek release manifesti/ag davranisi
  ayrica incelenmeli; gereksiz izinler ve reklam kimligi engellenir.

Data safety formu web icerigi ve SDK'lar dahil gercek akislarla doldurulmalidir:
ad/kullanici kimligi, fotograflar, kullanici icerigi/yorumlar, uygulama
etkilesimleri ve biyometrik amac tek tek degerlendirilir. "Veri toplamiyoruz"
secenegi bu kodun sunucu kayitlariyla uyusmaz. Veri isleyicisine aktarim ve
kullanici tarafindan baslatilan paylasimin Google'daki istisna tanimlarini
okumadan tumunu "paylasilmiyor" diye varsayma.
[Resmi Data safety rehberi](https://support.google.com/googleplay/android-developer/answer/10787469).

## Yayin oncesi tamamlanacak veri haklari

19 Ekim eklemesi: `0011_account_experience.sql` yalniz kanonik DB'ye iki
tablo ekler. `account_experience` tur surumu/tamamla-ertele tercihini;
`account_deletion_requests` hesap kimligi, rastgele basvuru numarasi,
durum ve zamanlari tutar. Parola veya yeni bir e-posta kopyasi saklanmaz.
Silme istegi mevcut sifreyle yeniden dogrulanir, ayni origin/oturum ve
kalici deneme limiti ister; tekrar ayni aktif talebi dondurur. Inceleme
baslamadan ayni dogrulamayla iptal edilebilir. API hesap kimligini URL,
grup veya govdeden almaz. Posta saglayicisinin calismasina bagli degildir.
Yeni SQL yalniz izole yerel fixture'larda uygulanmistir. Eksik tabloda
eski giris/grup akisina dokunulmaz; destek e-postasi basvuru yolu kalir.

Bu bir **talep kaydi**, otomatik kalici silme degildir. Destek kuyrugunun
izlenmesi, sureli yanit/saklama politikasi ve asagidaki coklu-D1 silme
islemi tamamlanmadan genel yayin acilmaz. Talep olusmasi destek adresine
otomatik e-posta gonderildigi anlamina da gelmez. Isletici bekleyen
`requested` kayitlarini takip edecek korumali operasyon akisina ihtiyac duyar.

1. Veri sorumlusunun gercek adi, iletisim/destek ve guvenlik sorumlusu belirlenmeli.
2. Gizlilik ve kullanim kosullari herkese acik HTTPS sayfasinda ve uygulama icinde
   bulunmali; taslak dokuman gizlilik sayfasi yerine gecmez.
3. Her veri turunun amaci, hukuki dayanak, erisebilen roller, hizmet saglayicilar,
   saklama suresi ve yurt disi aktarim degerlendirmesi yazilmali.
4. Hesap/veri silme talebi icin kimlik dogrulama ve sureli yanit mekanizmasi
   uygulanmali. Tum aktif/pasif grup eslemeleri bulunmali; yorum/oy/favori/RSVP,
   yuz referansi/medya, profil ve kanonik hesabin silme/anonimlestirme plani
   iliski butunluguyle test edilmeli. Ucuncu kisilerin grup fotograflari da
   hak talepleri acisindan degerlendirilmeli. Sirf `is_active=0` yeterli degildir.
5. Yuz tanima istege bagli olmali. Eslesme amaci, referans saklama ve rizanin
   geri cekilmesi anlasilir anlatilmali; riza metni surumu/zamaniyla kanitlanmali.
   Tek checkbox veya modelin yerelde calismasi butun yukumlulukleri karsilamaz.
   Pozitif eslestirme yalniz rizali yetiskinlerle ve guvenli test verisiyle yapilmali.
6. Biyometrik isleme ve uluslararasi veri aktarimi icin yetkin KVKK/hukuk
   incelemesi alinmali. Siradan her fotograf otomatik biyometrik degildir;
   kisiyi benzersiz tanimlamak icin teknik isleme tabi tutulmasi onemlidir.
   [KVKK biyometrik veri rehberi](https://www.kvkk.gov.tr/Icerik/7047/Biyometrik-Verilerin-Islenmesinde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Rehber).
7. Grup ici yorum/fotograf icin icerik kurallari, sikayet/inceleme ve gerekirse
   engelleme sureci kurulup kullaniciya ulasilabilir olmali.

Bunlar henuz tamamlanmis ozellikler degildir; yayin kapisinda acik engeldir.

## Yedek, silme ve operasyon

- Her kanonik/ek grup DB'sinin sahibini, planini, bolgesini ve yedek envanterini
  kaydet. Yonetim erisimlerini en az yetki ve 2FA ile sinirla.
- SQL/migration oncesi geri donus noktasi al; staging'de geri yukleme provasi yap.
  Cloudflare D1 Time Travel penceresi plana gore Free'de 7, Paid'de 30 gundur;
  gercek plan ve uygunlugu dogrula. [D1 limitleri](https://developers.cloudflare.com/d1/platform/limits/).
- Daha uzun yedek gerekiyorsa sifreli ve erisimi sinirli ayri depolama/saklama
  politikasi kur. DB export'u parola hash'i ve fotograflar icerebilir; Git veya
  genel CI artifact deposuna koyma. Restore her grubu ve hesap eslemelerini kapsasin.
- Silinen kullaniciyi eski yedek geri yuklemesiyle yanlislikla geri getirmemek
  icin silme kaydi/tekrar uygulama plani belirle; yedek saklama sinirini acikla.
- Worker hata orani, giris kilitleri, D1 kota/boyut, medya hatalari ve Android
  vitals icin alarm kur. Gunluklerde parola, cerez, goruntu veya yuz vektoru tutma.
- Guvenlik olayi ve veri talebi icin kim kime ne zaman haber verecek belirle.
  Saklama sureleri ve olay bildirim yukumlulukleri hukuki incelemeyle netlessin.

Bir sonraki somut adim: sahip hesaplarini ve ayri HTTPS staging ortam bilgisini
belirlemek; ardindan bu eksik urun/politika akislarini staging'de tamamlamak.
Canli hesabin/sirlarin yerine sahte deger koyup yayin kapisini gecmis gosterme.
