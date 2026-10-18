import { useState } from "react";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { classroomTools, ClassroomToolsOverlay, type ClassroomToolRequest } from "@/components/classroom/ClassroomToolsOverlay";

export default function TeacherClassroomTools() {
  const [request, setRequest] = useState<ClassroomToolRequest | null>(null);
  return <div className="min-h-screen flex flex-col bg-background">
    <SiteHeader />
    <main className="container mx-auto max-w-5xl flex-1 px-4 pb-16 pt-32">
      <div className="mb-8 flex items-center gap-4"><Monitor className="h-10 w-10 text-primary" /><h1 className="text-3xl font-heading">Nástroje do hodiny</h1></div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{classroomTools.map(t => <Button key={t.id} variant="outline" className="h-48 flex-col gap-5 rounded-lg border-border bg-card text-xl whitespace-normal" onClick={() => setRequest({ id: t.id })}><t.icon className="!h-12 !w-12 text-primary" />{t.id === "volume" ? "Měřič hlasitosti" : t.name}</Button>)}</div>
    </main>
    <SiteFooter />
    <ClassroomToolsOverlay request={request} onClose={() => setRequest(null)} />
  </div>;
}
