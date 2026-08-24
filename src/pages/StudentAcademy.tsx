import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AcademyView from "@/components/academy/AcademyView";

const StudentAcademy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <SiteHeader />
    <main className="flex-1">
      <AcademyView audience="student" title="Bezli Akademie" subtitle="Kurzy a doplňkové vzdělávání pro žáky." />
    </main>
    <SiteFooter />
  </div>
);

export default StudentAcademy;
