import SlideCanvas from "@/components/admin/SlideCanvas";

const kids = [
  ["e5f6g7", "heading", 4, 4, 44.5, 18.9, "OBLASTI HYGIENY"],
  ["c2", "bullet_list", 4, 24.8, 44.5, 39.8, "Osobní hygiena a čistota rukou"],
  ["c3", "heading", 51.5, 4, 44.5, 18.9, "Provozní hygiena"],
  ["c4", "bullet_list", 51.5, 24.8, 44.5, 32.8, "Úklid a dezinfekce ploch"],
  ["c5", "heading", 51.5, 58.9, 44.5, 16.3, "Skladování"],
  ["c6", "bullet_list", 51.5, 76.8, 44.5, 36.8, "Teploty a oddělené uložení"],
  ["c7", "heading", 4, 67.1, 44.5, 15.1, "Manipulace"],
  ["c8", "bullet_list", 4, 84, 44.5, 29.6, "Zabránit mechanickému znečištění"],
] as const;

const slide = {
  slideId: "qa",
  type: "explain",
  layout: "free",
  projector: { headline: "", body: "" },
  blocks: kids.map(([id, type, x, y, w, h, text]) => ({
    id,
    type,
    visible: true,
    props: { text, html: `<p>${text}</p>` },
    frame: { x, y, w, h },
  })),
};

const QaFreeFit = () => (
  <div className="p-6">
    <div className="mx-auto w-[1000px] aspect-video bg-slate-900">
      <SlideCanvas slide={slide as any} darkMode />
    </div>
  </div>
);

export default QaFreeFit;
