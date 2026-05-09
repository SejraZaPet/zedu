import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import NotificationComposer from "@/components/notifications/NotificationComposer";
import BroadcastHistory from "@/components/notifications/BroadcastHistory";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const TeacherNotifications = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (role !== "teacher" && role !== "admin") {
      navigate("/");
    }
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">Moje notifikace</h1>
          <p className="text-muted-foreground mt-1">
            Posílejte zprávy a připomenutí svým třídám nebo konkrétním žákům.
          </p>
        </div>

        <div className="space-y-6">
          <NotificationComposer mode="teacher" onSent={() => setRefreshKey((k) => k + 1)} />
          <div key={refreshKey}>
            <BroadcastHistory scope="own" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherNotifications;
