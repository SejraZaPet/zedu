import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AcademyView from "@/components/academy/AcademyView";

const ParentAcademy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <SiteHeader />
    <main className="flex-1">
      <AcademyView audience="parent" title="Bezli Akademie" subtitle="Kurzy a rady pro rodiče." />
    </main>
    <SiteFooter />
  </div>
);

export default ParentAcademy;
