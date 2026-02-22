import { Settings } from "lucide-react";

const AdminButton = () => {
  return (
    <a
      href="/auth"
      className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full bg-card/60 backdrop-blur border border-border/50 flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-all duration-300"
      aria-label="Administrace"
      title="Administrace"
    >
      <Settings className="w-4 h-4" />
    </a>
  );
};

export default AdminButton;
