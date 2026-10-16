import { useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FromMaterialView from "@/components/from-material/FromMaterialView";

const StudentFromMaterial = () => {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 py-6">
        {notice && (
          <p role="status" className="max-w-4xl mx-auto px-4 mb-2 text-sm rounded-lg border border-primary/30 bg-primary/5 p-3 text-foreground">
            {notice}
          </p>
        )}
        <FromMaterialView role="student" />
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentFromMaterial;
