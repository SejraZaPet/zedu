import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ClassesManager from "@/components/admin/ClassesManager";

const TeacherClasses = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <ClassesManager />
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherClasses;
