import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SubjectPage from "./pages/SubjectPage";
import TopicPage from "./pages/TopicPage";
import LessonPage from "./pages/LessonPage";
import PodcastDetailPage from "./pages/PodcastDetailPage";
import StudentDashboard from "./pages/StudentDashboard";
import TextbooksPage from "./pages/TextbooksPage";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentDashboard from "./pages/StudentDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
          <Route path="/podcast/:episodeId" element={<PodcastDetailPage />} />
          <Route path="/ucebnice" element={<ProtectedRoute><TextbooksPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId/:grade/:topicSlug" element={<ProtectedRoute><TopicPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId/:grade/:topicSlug/:lessonSlug" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
