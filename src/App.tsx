import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import HelpPage from "./pages/HelpPage";
import HelpDetailPage from "./pages/HelpDetailPage";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SubjectPage from "./pages/SubjectPage";
import TopicPage from "./pages/TopicPage";
import LessonPage from "./pages/LessonPage";
import PodcastDetailPage from "./pages/PodcastDetailPage";
import StudentDashboard from "./pages/StudentDashboard";
import TextbooksPage from "./pages/TextbooksPage";
import ProfilePage from "./pages/ProfilePage";
import TeacherTextbooks from "./pages/TeacherTextbooks";
import TeacherLessons from "./pages/TeacherLessons";
import StudentTextbooks from "./pages/StudentTextbooks";
import StudentTextbookDetail from "./pages/StudentTextbookDetail";
import ActivitiesPage from "./pages/ActivitiesPage";
import ProtectedRoute from "./components/ProtectedRoute";
import TeacherGameScreen from "./pages/TeacherGameScreen";
import StudentGameJoin from "./pages/StudentGameJoin";
import StudentGamePlay from "./pages/StudentGamePlay";
import TeacherGames from "./pages/TeacherGames";

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
          <Route path="/profil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/podcast/:episodeId" element={<PodcastDetailPage />} />
          <Route path="/ucebnice" element={<ProtectedRoute><TextbooksPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId/:grade/:topicSlug" element={<ProtectedRoute><TopicPage /></ProtectedRoute>} />
          <Route path="/ucebnice/:subjectId/:grade/:topicSlug/:lessonSlug" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
          {/* Teacher routes */}
          <Route path="/ucitel/ucebnice" element={<ProtectedRoute><TeacherTextbooks /></ProtectedRoute>} />
          <Route path="/ucitel/ucebnice/:textbookId/lekce" element={<ProtectedRoute><TeacherLessons /></ProtectedRoute>} />
          {/* Student teacher-textbook routes */}
          <Route path="/student/ucebnice" element={<ProtectedRoute><StudentTextbooks /></ProtectedRoute>} />
          <Route path="/student/ucebnice/:textbookId" element={<ProtectedRoute><StudentTextbookDetail /></ProtectedRoute>} />
          <Route path="/aktivity" element={<ActivitiesPage />} />
          <Route path="/napoveda" element={<HelpPage />} />
          <Route path="/napoveda/:guideId" element={<HelpDetailPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
