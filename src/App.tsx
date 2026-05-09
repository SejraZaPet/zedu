import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import HelpPage from "./pages/HelpPage";
import HelpDetailPage from "./pages/HelpDetailPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SubjectPage from "./pages/SubjectPage";
import TopicPage from "./pages/TopicPage";
import LessonPage from "./pages/LessonPage";
import PodcastDetailPage from "./pages/PodcastDetailPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
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
import LiveTeacherScreen from "./pages/LiveTeacherScreen";
import LiveProjectorScreen from "./pages/LiveProjectorScreen";
import PresenterRemote from "./pages/PresenterRemote";
import TeacherAssignments from "./pages/TeacherAssignments";
import StudentAssignments from "./pages/StudentAssignments";
import StudentLeaderboard from "./pages/StudentLeaderboard";
import StudentAssignmentPlayer from "./pages/StudentAssignmentPlayer";
import TeacherClasses from "./pages/TeacherClasses";
import TeacherClassDetail from "./pages/TeacherClassDetail";
import TeacherResults from "./pages/TeacherResults";
import ParentDashboard from "./pages/ParentDashboard";
import ParentMessages from "./pages/ParentMessages";
import TeacherParentMessages from "./pages/TeacherParentMessages";
import GdprPage from "./pages/GdprPage";
import TodoPage from "./pages/TodoPage";
import StudentCalendar from "./pages/StudentCalendar";
import StudentSubjectClass from "./pages/StudentSubjectClass";
import StudentSchedule from "./pages/StudentSchedule";
import TeacherCalendar from "./pages/TeacherCalendar";
import NotificationsPage from "./pages/NotificationsPage";
import TeacherWorksheets from "./pages/TeacherWorksheets";
import WorksheetEditor from "./pages/WorksheetEditor";
import StudentWorksheetView from "./pages/StudentWorksheetView";
import TeacherNotifications from "./pages/TeacherNotifications";
import TeacherLessonPlans from "./pages/TeacherLessonPlans";
import TeacherLessonPlanEditor from "./pages/TeacherLessonPlanEditor";
import TeacherSchedule from "./pages/TeacherSchedule";
import TeacherMediaLibrary from "./pages/TeacherMediaLibrary";
import TeacherSubjectClass from "./pages/TeacherSubjectClass";
import TeacherSubjects from "./pages/TeacherSubjects";
import TeacherMethods from "./pages/TeacherMethods";
import StudentMethods from "./pages/StudentMethods";
import StudentPractice from "./pages/StudentPractice";
import SchoolAdmin from "./pages/SchoolAdmin";
import ViewAsBanner from "./components/ViewAsBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ViewAsBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/skola" element={<ProtectedRoute><SchoolAdmin /></ProtectedRoute>} />
            <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/ucitel" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/rodic" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
            <Route path="/rodic/zpravy" element={<ProtectedRoute><ParentMessages /></ProtectedRoute>} />
            <Route path="/ucitel/zpravy-rodicu" element={<ProtectedRoute><TeacherParentMessages /></ProtectedRoute>} />
            <Route path="/ucitel/tridy" element={<ProtectedRoute><TeacherClasses /></ProtectedRoute>} />
            <Route path="/ucitel/tridy/:id" element={<ProtectedRoute><TeacherClassDetail /></ProtectedRoute>} />
            <Route path="/ucitel/vysledky" element={<ProtectedRoute><TeacherResults /></ProtectedRoute>} />
            <Route path="/profil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/podcast/:episodeId" element={<PodcastDetailPage />} />
            <Route path="/ucebnice" element={<ProtectedRoute><TextbooksPage /></ProtectedRoute>} />
            <Route path="/ucebnice/:subjectId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
            <Route path="/ucebnice/:subjectId/:grade/:topicSlug" element={<ProtectedRoute><TopicPage /></ProtectedRoute>} />
            <Route path="/ucebnice/:subjectId/:grade/:topicSlug/:lessonSlug" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
            <Route path="/ucitel/ucebnice" element={<ProtectedRoute><TeacherTextbooks /></ProtectedRoute>} />
            <Route path="/ucitel/ucebnice/:textbookId" element={<ProtectedRoute><TeacherTextbooks /></ProtectedRoute>} />
            <Route path="/ucitel/ucebnice/:textbookId/lekce" element={<ProtectedRoute><TeacherLessons /></ProtectedRoute>} />
            <Route path="/ucitel/ulohy" element={<ProtectedRoute><TeacherAssignments /></ProtectedRoute>} />
            <Route path="/student/ucebnice" element={<ProtectedRoute><StudentTextbooks /></ProtectedRoute>} />
            <Route path="/student/ucebnice/:textbookId" element={<ProtectedRoute><StudentTextbookDetail /></ProtectedRoute>} />
            <Route path="/student/ulohy" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
            <Route path="/student/zebricek" element={<ProtectedRoute><StudentLeaderboard /></ProtectedRoute>} />
            <Route path="/student/ulohy/:assignmentId" element={<ProtectedRoute><StudentAssignmentPlayer /></ProtectedRoute>} />
            <Route path="/aktivity" element={<ActivitiesPage />} />
            <Route path="/hra/ucitel/:sessionId" element={<ProtectedRoute><TeacherGameScreen /></ProtectedRoute>} />
            <Route path="/hra/pripojit" element={<StudentGameJoin />} />
            <Route path="/hra/hrac/:sessionId" element={<StudentGamePlay />} />
            <Route path="/ucitel/hry" element={<ProtectedRoute><TeacherGames /></ProtectedRoute>} />
            <Route path="/live/ucitel/:sessionId" element={<ProtectedRoute><LiveTeacherScreen /></ProtectedRoute>} />
            <Route path="/live/projektor/:sessionId" element={<LiveProjectorScreen />} />
            <Route path="/prezentace/ovladani/:sessionId" element={<ProtectedRoute><PresenterRemote /></ProtectedRoute>} />
            <Route path="/live/pripojit" element={<StudentGameJoin />} />
            <Route path="/live/student/:sessionId" element={<StudentGamePlay />} />
            <Route path="/napoveda" element={<HelpPage />} />
            <Route path="/napoveda/:guideId" element={<HelpDetailPage />} />
            <Route path="/gdpr" element={<GdprPage />} />
            <Route path="/todo" element={<ProtectedRoute><TodoPage /></ProtectedRoute>} />
            <Route path="/student/kalendar" element={<ProtectedRoute><StudentCalendar /></ProtectedRoute>} />
            <Route path="/student/rozvrh" element={<ProtectedRoute><StudentSchedule /></ProtectedRoute>} />
            <Route path="/student/predmet/:subjectId/trida/:classId" element={<ProtectedRoute><StudentSubjectClass /></ProtectedRoute>} />
            <Route path="/ucitel/kalendar" element={<ProtectedRoute><TeacherCalendar /></ProtectedRoute>} />
            <Route path="/notifikace" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/ucitel/pracovni-listy" element={<ProtectedRoute><TeacherWorksheets /></ProtectedRoute>} />
            <Route path="/ucitel/pracovni-listy/:id" element={<ProtectedRoute><WorksheetEditor /></ProtectedRoute>} />
            <Route path="/student/pracovni-list/:id" element={<ProtectedRoute><StudentWorksheetView /></ProtectedRoute>} />
            <Route path="/ucitel/notifikace" element={<ProtectedRoute><TeacherNotifications /></ProtectedRoute>} />
            <Route path="/ucitel/plany-hodin" element={<ProtectedRoute><TeacherLessonPlans /></ProtectedRoute>} />
            <Route path="/ucitel/plany-hodin/:id" element={<ProtectedRoute><TeacherLessonPlanEditor /></ProtectedRoute>} />
            <Route path="/ucitel/rozvrh" element={<ProtectedRoute><TeacherSchedule /></ProtectedRoute>} />
            <Route path="/ucitel/media" element={<ProtectedRoute><TeacherMediaLibrary /></ProtectedRoute>} />
            <Route path="/ucitel/predmety" element={<ProtectedRoute><TeacherSubjects /></ProtectedRoute>} />
            <Route path="/ucitel/predmet/:subjectId/trida/:classId" element={<ProtectedRoute><TeacherSubjectClass /></ProtectedRoute>} />
            <Route path="/ucitel/metody" element={<ProtectedRoute><TeacherMethods /></ProtectedRoute>} />
            <Route path="/student/metody" element={<ProtectedRoute><StudentMethods /></ProtectedRoute>} />
            <Route path="/student/metody/:slug/procviceni" element={<ProtectedRoute><StudentPractice /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
