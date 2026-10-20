# Koru C Logo Önerisi

19 Ekim 2026 taslağı, **20 Ekim'de uygulama entegrasyonu onaylandı**.
Mustafa “logo işlerini seçtiğimiz gibi güncelle” talimatını verdi.
Güncel sözleşme `BRAND_IDENTITY.md` sürüm 1.2; tek geometri kaynağı
`lib/brand-identity.ts`. Aşağıdaki 19 Ekim önizleme çıktıları tarihsel taslaktır;
eski raporlar yeni uygulama veya canlı yayın kabulü olarak kullanılmaz.

## Karar ve Önizleme

Mustafa ağaç + kitap / koru temalı seçenekleri görmek istedi. A/B/C panosu
yerleşik `image_gen` aracıyla yalnız kavramsal önizleme olarak üretildi.
Operatör **C: sade sayfa ve yaprak** yönünü geliştirme için seçti. Seçim,
staging/canlı dağıtım veya kalıcı marka değişikliği onayı değildir.

C, mevcut geometrinin bir kopyası gibi gösterilmeden ayrı bir vektör öneri
olarak yeniden çizildi: altta kitap sayfaları, üstte üç yaprak ve ortada
kitap sırtı/gövdeyi taşıyan negatif alan. Her kullanım aynı beş path'i
kullanır. Yazı, mevcut yerel Bricolage Grotesque 700'dür; yeni font yoktur.
Mürekkep, kâğıt, sarı ve koyu zemin mevcut marka paletindendir.

```bash
nvm use 24
node scripts/preview-logo-proposal.mjs
```

Çıktılar yalnız Git dışındaki `outputs/brand-proposals/koru-c-v1/` içindedir:

- `preview.html`: internet veya sunucu gerektirmeyen, fontu gömülü inceleme sayfası.
- `koru-c-proposal.svg`: onaylanmamış, tek renk `currentColor` vektör.
- `preview-320.png`, `preview-390.png`, `preview-1440.png`: gerçek yerel render.
- `report.json`: son çalışmanın durum ve kapsamı; başarısız/yarım koşu geçer sayılmaz.

19 Ekim kontrolü: üç genişlikte taşma, font yüklenmesi, JavaScript hatası ve
24/32/48/64 CSS px işaret ölçüleri kontrol edildi. Altı 24px açık/koyu piksel
kontrolü geçti; PNG'ler gözle incelendi. Bu, dört uygulama şemasının kabulü,
fiziksel cihaz/PWA testi, marka benzersizliği veya tescil incelemesi değildir.

## Onay Geçmişi

1. Operatör vektör önizlemesini inceler; gerekirse oran/kitap çağrışımı düzeltilir.
2. **Yerel entegrasyon ve kurumsal kimlik güncellemesi 20 Ekim'de onaylandı.**
3. Ancak bundan sonra tek geometri kaynağı; web logosu, favicon, Apple/maskable
   simgeler, bildirim ve sürümlü paylaşım görseline birlikte taşınır.
4. Dört görünüm, açık/koyu, mobil/masaüstü kontrolleri tekrarlanır. Bu yalnız
   değişen görsel kapsamıdır; genel yayın kabulünü kendiliğinden sağlamaz.
5. Operatör 20 Ekim'de canlıya geçmeyi de istedi. Bu talimat güvenlik,
   kimlik/veri geçişi ve gerçek cihaz kabulü eksiklerini geçmiş saydırmaz.

## Kavramsal Panonun Üretim İstemi

Araç: yerleşik `image_gen`; CLI/API fallback kullanılmadı. Pano üretim
dosyası değildir; vektör fontu/geometrisi elle ve deterministik kaynaktan
oluşturuldu. Kullanılan özgün istem:

```text
Use case: logo-brand. Create ONE beautifully art-directed, flat logo concept comparison sheet for the existing Turkish reading-community app Koru. This is preview-only, NOT an approved replacement or a production brand guide. The product name must remain exactly 'Koru'. Design three genuinely distinct sophisticated custom symbols merging an OPEN BOOK and TREE / GROVE imagery, with the originality and restraint of a contemporary independent literary publisher. Left concept A: one quiet elegant tree whose trunk grows seamlessly out of the center fold of an open book, canopy is a small number of bold leaf / page shapes. Middle concept B: an intimate grove of three abstract trees emerging from a shared open-book base, simple coherent silhouette, no fussy branches. Right concept C: folded book pages transforming into two or three upward leaves around a central spine, compact clever negative space. Neither generic clipart nor a library tool icon; distinctive but simple enough to ultimately reproduce faithfully as an SVG and recognize at 24px. Do not use the existing angular K initial or vertical barcode-like strokes. No hands, human figures, badges, seals, ornamental illustration, mockups, shadows, gradients, 3D, photographic textures or environmental scenes. Keep all three symbol designs EXACTLY consistent across their large mark, reversed mark and small app-icon example. Landscape comparison sheet, three equal generously spaced columns with very fine neutral dividers; simple labels A, B, C only. Each column: large standalone dark-ink symbol with 'Koru' in a warm contemporary humanist grotesk bold wordmark (Bricolage Grotesque-like, normal letter spacing); beneath it a dark rectangular area with the same symbol and wordmark reversed in warm white; bottom row shows two small solid yellow rounded-square app icon versions using the same dark-ink symbol at clearly different small sizes. All generous intentional whitespace, no other text or slogans. Fixed EXISTING brand palette only: ink #172d45, warm paper #fffdf7, yellow #e2c63f, dark background #15130f. Symbol uses one color, not multicolor; yellow is only app-icon background. Coral is unnecessary. Do not add green or change the product palette. The three concepts must be visibly different and plausibly excellent finished vector logos. Produce a crisp, polished identity exploration board, no watermarks.
```
