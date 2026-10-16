# Tek hesap, web ve mobil okuma gruplari

16 Ekim 2026. Gelistirme ve test ortami; uretim etkinlestirmesi yapilmadi.

## Davranis

- Kullanici mevcut kullanici adi ve parolasiyla bir kez giris yapar.
- Tek uyelik dogrudan uygulamayi acar. Birden fazla uyelik her yeni giristen
  sonra grup secimi ister. Sonraki uygulama acilisinda oturum ve secim korunur.
- Profildeki Grup degistir komutu secim ekranini acar. Yeni grup tam sayfa
  yuklemesiyle acilir; onceki grubun form, gezinme ve biyometrik model bellegi tasinmaz.
- Grup ici rol, kitaplar, bulusmalar, katilimlar, oylar, fotograflar, favoriler,
  cop kutusu ve kisiye ait gorunum tercihi secilen gruptan gelir.
- Uygulama adi secili grubun `reading_groups.name` kaydidir: masaustu/mobil
  baslik, gezinme izi, ana sayfa ve alt bilgi ayni adi kullanir. Ilk HTML,
  tarayici sekmesi, Apple web uygulamasi metaverisi, kurulum manifesti ve
  takvim adi da bu kaynaktan gelir. Yenilemeler grup adi degisikliklerini getirir.
- Grup secilmeden once tarafsiz uygulama adi kullanilir; yalniz grup cerezi
  bulunan bir istege grup adi aciklanmaz. Ozellik kapaliyken eski web adi korunur.
  Kurulu PWA kisayolunun adi isletim sistemi/tarayici tarafindan onbelleklenebilir;
  aninda yeniden adlandirilmasi garanti edilmez. Native baslatici adi uygulama
  kimligidir, grup degistirildiginde degismez.
- Web ve mobil ayni sunucuya baglanir. Islemler ayni kalici kayitlara yazilir;
  odak/uygulamaya donus ve 30 saniyelik bos zaman yenilemesi diger cihazdaki
  degisiklikleri getirir. Kaydedilmemis formlar otomatik yenilemeyle ezilmez.
  Cevrimdisi yazma kuyrugu veya gercek zamanli push senkronizasyonu yoktur.

## Veri ve yetki siniri

Mevcut `DB` kanonik hesaplari, parola hashlerini ve oturum surumlerini tutar.
`0008_reading_groups.sql` bu DB'ye grup ve uyelik kayitlarini ekler; var olan
uyeleri `default` grubuna baglar. Eski kitap, uye ve bulusma numaralari degismez.

Her ek grubun ayri bir D1 binding'i ve mevcut domain semasi vardir. Kanonik
hesap bir gruptaki yerel uye numarasina baglanir. Yerel uye numarasinin kanonik
hesap numarasiyla ayni olmasi gerekmez. Roller ilgili DB'deki `members` kaydindan
her istekte okunur; hesap rolunden veya istemci payload'undan alinmaz.
Ek grup DB'sinde hesap/parola olusturulmaz; auth her zaman kanonik DB'yi kullanir.
Uyelik iptalinde kaydi silmek yerine `is_active=0` kullanilir. Bu hesap o grupta
oturum acamaz; eski katilim ve yorumlarda yerel uye adi korunur. Kanonik DB'de
yalniz kimligi bulunan, varsayilan gruba hic uye olmamis hesaplar varsayilan
grubun uye listesine veya uye hedefleyen yonetim komutlarina sizmaz.

`READING_GROUPS_ENABLED=true` acikca ayarlanmadikca eski tek grup davranisi
surmekte, eski gorunum tercihleri tarayicida saklanmaktadir. Etkinlestirildiginde
tercihler hesap+grup uyeliginde saklanir. Eski cihaz tercihlerinin hangi hesaba
ait oldugu bilinemediginden SQL bunlari tahmin ederek tasimaz; baslangic
`notebook/system`, kullanicinin sonraki secimi sunucuda kalicidir.

Ek D1 binding adlari `READING_GROUP_DB_BINDINGS` JSON dizisinde acikca izinli
olmalidir. Kayit olup binding/uyelik/sema eksikse kontrollu hata doner; baska
gruba sessiz donus yoktur. Yetkisiz grup `403`, secim gereksinimi veya eski
sekme grubu `409`, hazir olmayan altyapi `503` olur.
Bayrak kapatildiginda ek grup kimlikli URL veya API basligi da `503 GROUP_DISABLED`
alir; ayni numarali kaydi varsayilan DB'de acmaz veya degistirmez. Eski, grup
kimligi olmayan istekler ve `default` baglantilari calismaya devam eder.
Registry kurulmus bir DB'de bayrak kapali olsa bile aktif `default` uyeligi
zorunludur. Yalniz ek gruba uye hesap eski web uzerinden varsayilan gruba giremez.
Registry kurulmadan onceki tek grup DB'si eski davranisini korur; tablo yaratma
veya otomatik migration yapilmaz.

Oturum ve grup secimi HttpOnly, SameSite=Lax cerezlerdir; HTTPS'te Secure'dur.
API yazmalarinda ayni origin ve `X-Reading-Group` eslesmesi zorunludur.
Medya, takvim ve paylasilan bulusma baglantilari grup kimligini de tasir.
Eski bir sekmedeki `meeting=1` yeni grubun `meeting=1` kaydina yazamaz.
AsyncLocalStorage yalniz istek suresince dogrulanmis DB baglamini tasir.

Bu surumde herkese acik kayit, otomatik grup olusturma/davet ve hesap birlestirme
yoktur. Uyeligi kontrollu olarak provizyonlayan yonetim sureci gerekir.
Iki mevcut hesabı ada veya parola benzerligine gore otomatik birlestirme.

## Grup API'si

| Yol | Sozlesme |
| --- | --- |
| `GET /api/groups` | Etkinlik, aktif uyelikler ve secili grup; binding veya parola dondurmez |
| `POST /api/groups` | `{ groupId }`, ayni origin ve eslesen `X-Reading-Group`; HttpOnly secim cerezi |
| `PATCH /api/groups/appearance` | `{ scheme?, mode? }`; secili aktif uyeligin gorunumunu kaydeder |
| `GET /api/manifest` | Dogrulanmis secili grubun adi veya tarafsiz uygulama adi; `private, no-store` |

Auth ve parola degisimi kanonik hesaba aittir. Diger domain API'leri dogrulanmis
yerel uye/DB baglaminda calisir. Uyelik pasiflestirme bu surumde kontrollu
sunucu yonetim islemidir; istemci kendisine uyelik veya rol veremez.

## Yerel calistirma

Node 24 ve pnpm ile repo kokunde:

```bash
nvm use 24
corepack pnpm install
corepack pnpm groups:setup
corepack pnpm groups:dev
```

Adres: http://127.0.0.1:5174. `demo.multi` iki grup, `demo.single` tek grup,
`demo.none` ise uyeligi olmayan ornek hesaptir. Yerel rastgele parola yalniz
Git disindaki `.sites-runtime/groups-development.json` dosyasinin `password`
alanindadir. Bu dosyayi veya cerezleri rapor/commit'e ekleme.

Yerel veriler `.wrangler/groups-development` altindadir. Kurulum yalniz
`--local` ve sabit sentetik DB kimlikleriyle calisir; var olan veriyi silmez.
Kurulum yarim kalirsa script guvenli bicimde durur. Once yerel durumu incele;
bilmeden SQL'leri tekrar uygulama. Gelistirme profiliyle build/deploy engellenir.

Eski davranisi ayni sentetik DB uzerinde, ozellik kapali olarak kontrol etmek icin:

```bash
corepack pnpm groups:dev:legacy
corepack pnpm groups:test:legacy
corepack pnpm groups:test:memberships
```

Bu sunucu http://127.0.0.1:5175 uzerinde calisir. Gunluk kullanim icin gerekli degildir.

## Kontroller

```bash
corepack pnpm groups:test:unit
corepack pnpm groups:test
corepack pnpm exec playwright install chromium
corepack pnpm groups:test:ui
corepack pnpm groups:test:branding
corepack pnpm --dir mobile test
corepack pnpm mobile:typecheck
corepack pnpm exec tsc --noEmit
corepack pnpm check:ui
corepack pnpm lint
corepack pnpm build
```

API/UI testleri yalniz loopback hedeflere izin verir; sentetik hesaplari kullanir.
Paylasilan ornek hesaplari degistiren testleri sirayla calistir.
API senaryosu parola degistirme testinin sonunda ornek parolayi geri getirir;
test sirasinda ayni hesapla manuel calisma yapma. Goruntuler ve raporlar
Git disindaki `outputs/groups-ui/` altindadir. Native sonuclar
[mobil kabul listesinde](MOBILE_ACCEPTANCE.md) ayrica izlenir.
Grup adi testleri gercek grup gecisini, ilk HTML/metaveriyi, anonim ad gizliligini
ve dort semanin acik/koyu, 390/1440px gorunumlerinde uzun ve HTML benzeri adlari
kontrol eder. Bu testlerin ciktilari `outputs/group-branding/` altindadir.

## Canliya gecis

1. Once ayri staging Worker ve D1'lerde test et. Tum `0000`-`0007` tablo/alanlarini
   hedef ortamda sorgulayarak dogrula; journal veya yerel basari yeterli degildir.
2. Kanonik DB yedegini al; mevcut uye/hesap ve iliski sayilarini kaydet. `0008`
   yalniz kanonik DB'ye bir kez uygulanir. Ek grup DB'sine registry migration'i
   ve uretim hesaplarini kopyalama; gerekli domain semasi ve yerel uye kayitlarini hazirla.
3. Uyelikleri dogru kanonik ve yerel uye numaralariyla esle; her gruptaki rolleri
   ve misafir ayrimini incele. Binding allowlist'ini Worker'da tanimla.
   Erisimi kaldirmak icin uyeligi pasiflestir; gecmisi olan uyelik kaydini silme.
4. Bayrak kapaliyken eski web smoke testini; staging'de bayrak acikken tum
   entegrasyon/rol/medya/oturum testlerini calistir. iOS ve Android fiziksel
   cihaz testlerini, imzalamayi ve HTTPS uygulama adresini ayri dogrula.
5. Hedef ortam ve yedek dogrulanmadan uretimde SQL calistirma. Etkinlestirmeyi
   kontrollu yap. Bayragi kapatmak eski webi acar; ek grup verilerini silmez.
   Mobil release ve magaza dagitimi ayri asamadir.
   Yeni global hesaplar acildiktan sonra grup yetkisini bilmeyen eski kodu
   yayinlayarak geri alma yapma. Bayrak kapatma, bu surumun uyelik denetimleri
   korunarak uygulanmalidir; eski kod bu guvenlik sozlesmesini uygulamaz.

Kaynaklar: [Cloudflare AsyncLocalStorage](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/),
[D1 binding'leri](https://developers.cloudflare.com/d1/worker-api/).
