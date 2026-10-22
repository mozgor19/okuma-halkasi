# Cloudflare D1 Envanteri

22 Ekim 2026, 23:04-23:06 TRT salt okunur inceleme. Bu belge silme, taşıma,
bağlantı değiştirme veya canlı dağıtım onayı değildir. Bulgular o ana aittir;
her değişiklikten önce güncel bağlantı ve içerik tekrar kontrol edilmelidir.

## Sonuç

Hesapta **8 D1** var: canlı Worker'a bağlı 3 ve staging Worker'a bağlı 5.
`koru-public-info` hiçbir D1 kullanmıyor. Pages proje listesi boş. İncelenen
üç Worker servisinin yalnız varsayılan `production` ortamı var; staging
Worker'ının bu teknik ortam adı onun gerçek kullanıcı ortamı olduğunu göstermez.

Bağımsız, bağlantısız bir test veya unutulmuş geri-yükleme DB'si bulunmadı.
API envanterindeki `version: production` staging DB'lerde de var: bu alan,
uygulamanın staging/canlı ayrımı değildir. DB listesi `num_tables: 0` döndürse
de ayrıntı endpoint'i gerçek tabloları gösterdi; boşluk kararı bu değere göre
değil, sabit SELECT sorgularıyla grup referansları ve içerik sayaçlarına göre verildi.

## Veritabanları

| D1 Adı | Worker / Bağlantı | Güncel Görev ve Bulgu | Öneri |
| --- | --- | --- | --- |
| `okuma-halkasi-db` | `okuma-halkasi` / `DB` | Canlı hesap/grup merkezi, eski ana grubun içerikleri ve yeni ortak modelde kurulan gruplar. | Kesinlikle koru. |
| `koru-production-group-1` | `okuma-halkasi` / `GROUP_CREATE_ONE` | Eski ayrı-DB modelinde kurulmuş bir canlı grup hâlâ buraya yönleniyor. Üye, hesap eşleştirmesi ve DB sahiplik kaydı var. Kitap/buluşma olmaması boş veya gereksiz olduğu anlamına gelmez. | Kesinlikle koru; taşımadan silinemez. |
| `koru-production-group-2` | `okuma-halkasi` / `GROUP_CREATE_TWO` | Canlı Worker'a bağlı eski boş grup havuzu. Grup referansı/sahiplik/üye/kitap/buluşma/medya yok; yalnız fabrika ayarı mevcut. | Sadeleştirme adayı, şu an silme. |
| `koru-staging-main` | `koru-staging` / `DB` | Staging hesapları, grup kaydı, üyelikler ve davet işlemlerinin merkezi. | Test ortamı için koru. |
| `koru-staging-group-1` | `koru-staging` / `GROUP_POOL_ONE` | İlk staging grubunun üye, kitap, buluşma ve plan kayıtları. | Test ortamı için koru. |
| `koru-staging-group-2` | `koru-staging` / `GROUP_POOL_TWO` | İkinci staging grubunun üye, kitap, buluşma ve plan kayıtları; gruplar arası izolasyon denemeleri. | Test ortamı için koru. |
| `koru-staging-create-1` | `koru-staging` / `GROUP_CREATE_ONE` | Önceden boş yaratma havuzuydu; artık oluşturulmuş staging grubu, üyeler ve hesap eşleştirmeleri var. | Boş sanıp silme. |
| `koru-staging-create-2` | `koru-staging` / `GROUP_CREATE_TWO` | Oluşturulmuş staging grubu; üye/hesap eşleştirmesi, kitap ve plan kaydı var. | Boş sanıp silme. |

Canlı kayıt defterinde kontrol anında 3 grup var: `DB` üzerinde 1 eski ana
grup, `GROUP_CREATE_ONE` üzerinde 1 ayrı-DB grubu, ortak depolama üzerinde
1 grup. **Bu sayı sistem kapasitesi değildir.** Yeni gruplar
`SHARED_GROUPS_ENABLED=true` ile ortak modelde ana D1 içinde açılır;
`SELF_SERVICE_GROUP_BINDINGS=[]`. Yeni her grup için yeni D1 gerekmiyor.
Hesap başına 3 grup kurma / 20 gruba katılma korumaları ayrıdır.

Staging hâlâ beş DB'li eski modelde; canlıdaki ortak-grup bayrağı orada açık
değil. Beş DB'nin her biri staging kayıt defterinde bir gruba karşılık geliyor.
Canlı mimarisiyle eşitleme ayrı, onaylı bir çalışma olmalıdır.

## Onay Gerektiren Seçenekler

1. **Şimdilik hepsini koru:** mevcut kullanıcılar ve staging işlevleri değişmez.
2. **Yalnız boş canlı havuzu kaldır:** `koru-production-group-2` için taze yedek,
   sıfır grup referansı ve içerik kontrolü; ardından deployment/policy,
   yedek/envanter ve binding beklentilerini birlikte güncelle. Sadece panelden
   silmek uygun değildir: mevcut yayın araçları iki ayrı canlı grup binding'ini
   zorunlu tutuyor. Kaynak/bağlantı değişikliği ayrıca yayımlanıp doğrulanmadan
   fiziksel DB silme yapılmaz. Eski sürümlere dönüş planı da güncellenmelidir.
3. **Daha kapsamlı sadeleştirme:** staging'i ortak modele geçirmek ve eski canlı
   ayrı grubu üyelik/rol/ayar/kimlikleri koruyarak taşımak. Böylece teorik olarak
   canlı ve staging için birer D1 yeterli olabilir; bu mevcut durum veya
   kayıpsızlığı kanıtlanmış bir geçiş değildir. Veri taşıma, test ve ayrı onay gerekir.

Hiçbir seçenek bu inceleme sırasında uygulanmadı. Varsayılan karar **koru**.
Yedekler, sırf DB sayısını azaltmak amacıyla silinmez.

## Kanıt ve Sınırlar

- Cloudflare D1 liste/ayrıntı, üç Worker'ın güncel settings/deployment kayıtları,
  servis ortamları ve Pages proje listesi okundu.
- DB'lerde yalnız sabit `SELECT` katalog/sayaç sorguları çalıştırıldı. İsim,
  e-posta, parola, oturum/eylem kodu, kitap içeriği veya medya gövdesi alınmadı.
- `INSERT`, `UPDATE`, `DELETE`, DDL, export/import, migration, kaynak silme,
  Secret/ayar/binding değişikliği veya dağıtım yapılmadı. Ücretli hizmet açılmadı.
- İlk API isteği eski oturumla 401 döndü. Wrangler'ın salt okunur liste komutu
  oturumu yeniledi; sonraki okuma başarılı oldu. Pages'in parametreli liste
  isteği 400 döndü; parametresiz resmi liste isteği başarılı ve boştu.
- Eski bütün Worker sürümlerinin binding'leri, harici servislerin bağlantıları,
  yedek saklama politikası veya geri dönüş kabulü bu denetimle tamamlanmış değildir.
  Bu nedenle envanter tek başına silmenin güvenli olduğunun kanıtı değildir.
- Kişisel satır veya Secret içermeyen özel yerel çıktılar:
  `.sites-runtime/koru-production/db-inventory-20261022.json` ve
  `.sites-runtime/koru-production/db-counts-20261022.json`.

Genel API davranışı: [D1 API](https://developers.cloudflare.com/api/resources/d1/subresources/database/),
[Worker bağlantıları](https://developers.cloudflare.com/api/resources/workers/).
