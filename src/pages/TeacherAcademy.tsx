import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AcademyView from "@/components/academy/AcademyView";

const TeacherAcademy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <SiteHeader />
    <main className="flex-1">
      <AcademyView audience="teacher" title="Bezli Akademie" subtitle="Kurzy a webináře pro učitele." />
    </main>
    <SiteFooter />
  </div>
);

export default TeacherAcademy;
