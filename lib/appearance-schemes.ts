import type { AppearanceScheme } from "@/components/appearance-provider";

export const appearanceSchemes: Array<{ id: AppearanceScheme; name: string; description: string }> = [
  { id: "editorial", name: "Dergi", description: "Edebi, sıcak ve güçlü tipografik hiyerarşi." },
  { id: "catalogue", name: "Katalog", description: "Düzenli, kurumsal ve arşiv odaklı." },
  { id: "notebook", name: "Defter", description: "Canlı, kişisel ve not defteri karakterinde." },
  { id: "minimal", name: "Minimal", description: "Yalnızca işlev, çizgi ve okunabilirlik." },
];
