import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FromMaterialView from "@/components/from-material/FromMaterialView";

const TeacherFromMaterial = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <SiteHeader />
    <main className="flex-1 py-6">
      <FromMaterialView role="teacher" />
    </main>
    <SiteFooter />
  </div>
);

export default TeacherFromMaterial;
