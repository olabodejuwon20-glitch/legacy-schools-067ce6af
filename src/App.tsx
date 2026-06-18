import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SchoolProvider, useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { RequireAuth, RequireSchool, RoleGate } from "@/components/Guards";
import AppLayout from "./layouts/AppLayout";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import AnalyticsTracker from "./components/AnalyticsTracker";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import SchoolHome from "./pages/SchoolHome";
import SchoolLogin from "./pages/SchoolLogin";
import SchoolAdminLogin from "./pages/SchoolAdminLogin";
import Join from "./pages/Join";
import ChangePin from "./pages/ChangePin";
import Bio from "./pages/Bio";
import ProfilePage from "./pages/Profile";
import VerifyResult from "./pages/VerifyResult";
import Privacy from "./pages/Privacy";
import Refer from "./pages/Refer";
import Terms from "./pages/Terms";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminStudents from "./pages/admin/Students";
import AdminTeachers from "./pages/admin/Teachers";
import AdminClasses from "./pages/admin/Classes";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminInvites from "./pages/admin/Invites";
import AdminBulkUpload from "./pages/admin/BulkUpload";
import AdminHostel from "./pages/admin/Hostel";
import AdminTransport from "./pages/admin/Transport";
import AdminTimetable from "./pages/admin/Timetable";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminFees from "./pages/admin/Fees";
import AdminQuestionBank from "./pages/admin/QuestionBank";
import AdminProctoring from "./pages/admin/Proctoring";
import AdminLessonNotes from "./pages/admin/LessonNotes";
import AdminModules from "./pages/admin/Modules";
import AdminEnrollments from "./pages/admin/Enrollments";
import AdminOnboarding from "./pages/admin/Onboarding";
import AdminParentAlerts from "./pages/admin/ParentAlerts";
import AdminAIActivity from "./pages/admin/AIActivity";
import AdminAISettings from "./pages/admin/AISettings";
import AdminCopilot from "./pages/admin/Copilot";
import AdminKnowledge from "./pages/admin/Knowledge";
import AdminSubscription from "./pages/admin/Subscription";
import AdminParents from "./pages/admin/Parents";
import AdminAttendance from "./pages/admin/Attendance";
import AdminRoles from "./pages/admin/Roles";
import AdminTradExams from "./pages/admin/TradExams";
import AdminTradExamSession from "./pages/admin/TradExamSession";
import AdminTradExamPaper from "./pages/admin/TradExamPaper";
import AdminTradExamApprovals from "./pages/admin/TradExamApprovals";
import AdminTradExamResults from "./pages/admin/TradExamResults";
import AdminTradScratchCards from "./pages/admin/TradScratchCards";
import TradUnlockResult from "./pages/shared/TradUnlockResult";
import SubscriptionCallback from "./pages/SubscriptionCallback";
import HelpPage from "./pages/Help";
import LibraryManager from "./pages/shared/LibraryManager";
import Inbox from "./pages/shared/Inbox";
import CommsHub from "./pages/comms/Hub";
import CommsInbox from "./pages/comms/views/InboxView";
import CommsDM from "./pages/comms/views/DMView";
import CommsChannels from "./pages/comms/views/ChannelsView";
import CommsAnnouncements from "./pages/comms/views/AnnouncementsView";
import CommsBroadcasts from "./pages/comms/views/BroadcastsView";
import CommsTickets from "./pages/comms/views/TicketsView";
import CommsTemplates from "./pages/comms/views/TemplatesView";
import CommsScheduled from "./pages/comms/views/ScheduledView";
import CommsNotifications from "./pages/comms/views/NotificationsView";
import CommsAnalytics from "./pages/comms/views/AnalyticsView";
import CommsParentAlerts from "./pages/comms/views/ParentAlertsView";

import TeacherDashboard from "./pages/teacher/Dashboard";
import TeacherClasses from "./pages/teacher/Classes";
import TeacherAttendance from "./pages/teacher/Attendance";
import TestBuilder from "./pages/teacher/TestBuilder";
import Grading from "./pages/teacher/Grading";
import TeacherStudents from "./pages/teacher/Students";
import TeacherParents from "./pages/teacher/Parents";
import TeacherCalendar from "./pages/teacher/Calendar";
import TeacherMessages from "./pages/teacher/Messages";
import TeacherResources from "./pages/teacher/Resources";
import TeacherReports from "./pages/teacher/Reports";
import TeacherLessonPlan from "./pages/teacher/LessonPlan";
import TeacherLessonNotes from "./pages/teacher/LessonNotes";
import TeacherAssignments from "./pages/teacher/Assignments";
import TeacherGradebook from "./pages/teacher/Gradebook";
import TeacherBehavior from "./pages/teacher/Behavior";
import TeacherParentComms from "./pages/teacher/ParentComms";
import TeacherAssessments from "./pages/teacher/Assessments";
import TeacherTradExams from "./pages/teacher/TradExams";
import TeacherTradExamGrading from "./pages/teacher/TradExamGrading";

import StudentDashboard from "./pages/student/Dashboard";
import StudentClasses from "./pages/student/Classes";
import ExamInterface from "./pages/student/ExamInterface";
import StudentResults from "./pages/student/Results";
import Library from "./pages/student/Library";
import AITutor from "./pages/student/AITutor";
import StudentExamReview from "./pages/student/ExamReview";
import TeacherAITutor from "./pages/teacher/AITutor";
import TeacherAIMarking from "./pages/teacher/AIMarking";
import StudentCalendar from "./pages/student/Calendar";
import StudentLessonNotes from "./pages/student/LessonNotes";
import StudentAssignments from "./pages/student/Assignments";
import StudentMessages from "./pages/student/Messages";
import StudentFees from "./pages/student/Fees";
import StudentBehavior from "./pages/student/Behavior";
import StudentGradebook from "./pages/student/Gradebook";
import MockPicker from "./pages/student/MockPicker";
import MockRunner from "./pages/student/MockRunner";
import MockResult from "./pages/student/MockResult";
import Practice from "./pages/student/Practice";
import StudentRegisterSubjects from "./pages/student/RegisterSubjects";
import StudentMyAssessments from "./pages/student/MyAssessments";
import StudentAttendance from "./pages/student/Attendance";
import StudentTradExams from "./pages/student/TradExams";
import StudentTradExamRunner from "./pages/student/TradExamRunner";
import StudentTradExamResult from "./pages/student/TradExamResult";

import ParentDashboard from "./pages/parent/Dashboard";
import ParentChildren from "./pages/parent/Children";
import ParentResults from "./pages/parent/Results";
import ParentAttendance from "./pages/parent/Attendance";
import ParentActivity from "./pages/parent/Activity";
import ParentFees from "./pages/parent/Fees";
import ParentMessages from "./pages/parent/Messages";
import ParentCalendar from "./pages/parent/Calendar";
import ParentBehavior from "./pages/parent/Behavior";
import ParentTeacherComms from "./pages/parent/TeacherComms";

import SuperLayout from "./layouts/SuperLayout";
import SuperDashboard from "./pages/super/Dashboard";
import SuperClaim from "./pages/super/Claim";
import SuperSchools from "./pages/super/Schools";
import SuperSchoolDetail from "./pages/super/SchoolDetail";
import SuperModules from "./pages/super/Modules";
import SuperMarketplace from "./pages/super/Marketplace";
import SuperAnalytics from "./pages/super/Analytics";
import SuperTenantConfig from "./pages/super/TenantConfig";
import SuperLicensing from "./pages/super/Licensing";
import SuperSubscriptions from "./pages/super/Subscriptions";
import SuperBilling from "./pages/super/Billing";
import SuperUsers from "./pages/super/Users";
import SuperAnnouncements from "./pages/super/Announcements";
import SuperTickets from "./pages/super/Tickets";
import SuperSecurity from "./pages/super/Security";
import SuperLogs from "./pages/super/Logs";
import SuperSettings from "./pages/super/Settings";
import ComingSoon from "./pages/super/_ComingSoon";

const queryClient = new QueryClient();

function AppRoot() {
  const { activeRole, school } = useSchool();
  return <Navigate to={schoolPath(school?.slug, `/app/${activeRole}`)} replace />;
}

/** If a user lands on /app/... without a school slug, send them through the
 *  current school (when known) or the landing page. */
function SluglessAppRedirect() {
  const { school, loading, schoolLoading, memberships } = useSchool();
  const location = useLocation();
  const slug = school?.slug;
  if (loading || schoolLoading || (!slug && memberships.length > 0)) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (slug) {
    return <Navigate to={`/${slug}${location.pathname}${location.search}`} replace />;
  }
  return <Navigate to="/" replace />;
}

function SluglessAdminRedirect() {
  const { school, loading, schoolLoading, memberships } = useSchool();
  const location = useLocation();
  const slug = school?.slug;
  if (loading || schoolLoading || (!slug && memberships.length > 0)) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (slug) {
    return <Navigate to={`/${slug}/app${location.pathname}${location.search}`} replace />;
  }
  return <Navigate to="/" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <SchoolProvider>
        <BrowserRouter>
          <AnalyticsTracker />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/verify/:id" element={<VerifyResult />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refer" element={<Refer />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/subscription/callback" element={<SubscriptionCallback />} />

            {/* Helpful redirect: slug-less /app/* → tenant /:slug/app/* using last known school */}
            <Route path="/app/*" element={<SluglessAppRedirect />} />
            <Route path="/admin/*" element={<SluglessAdminRedirect />} />

          {/* Super Admin OS */}
          <Route path="/super/claim" element={<SuperClaim />} />
          <Route path="/super" element={<SuperLayout />}>
            <Route index element={<SuperDashboard />} />
            <Route path="schools" element={<SuperSchools />} />
            <Route path="schools/:id" element={<SuperSchoolDetail />} />
            <Route path="analytics" element={<SuperAnalytics />} />
            <Route path="users" element={<SuperUsers />} />
            <Route path="modules" element={<SuperModules />} />
            <Route path="licensing" element={<SuperLicensing />} />
            <Route path="configurations" element={<SuperTenantConfig />} />
            <Route path="marketplace" element={<SuperMarketplace />} />
            <Route path="subscriptions" element={<SuperSubscriptions />} />
            <Route path="billing" element={<SuperBilling />} />
            <Route path="announcements" element={<SuperAnnouncements />} />
            <Route path="tickets" element={<SuperTickets />} />
            <Route path="security" element={<SuperSecurity />} />
            <Route path="logs" element={<SuperLogs />} />
            <Route path="settings" element={<SuperSettings />} />
          </Route>

            {/* School-scoped routes: /:slug/... */}
            <Route path="/:slug" element={<SchoolHome />} />
            <Route path="/:slug/signin" element={<SchoolLogin />} />
            <Route path="/:slug/admin" element={<SchoolAdminLogin />} />
            <Route path="/:slug/join" element={<Join />} />
            <Route path="/:slug/change-pin" element={<RequireAuth><ChangePin /></RequireAuth>} />
            <Route path="/:slug/bio" element={<RequireAuth><Bio /></RequireAuth>} />
            <Route path="/:slug/app" element={<RequireSchool><AppLayout /></RequireSchool>}>
              <Route index element={<AppRoot />} />

              <Route path="admin" element={<RoleGate allow="admin"><AdminDashboard /></RoleGate>} />
              <Route path="admin/students" element={<RoleGate allow="admin"><AdminStudents /></RoleGate>} />
              <Route path="admin/teachers" element={<RoleGate allow="admin"><AdminTeachers /></RoleGate>} />
              <Route path="admin/parents" element={<RoleGate allow="admin"><AdminParents /></RoleGate>} />
              <Route path="admin/attendance" element={<RoleGate allow="admin"><AdminAttendance /></RoleGate>} />
              <Route path="admin/classes" element={<RoleGate allow="admin"><AdminClasses /></RoleGate>} />
              <Route path="admin/enrollments" element={<RoleGate allow="admin"><AdminEnrollments /></RoleGate>} />
              <Route path="admin/reports" element={<RoleGate allow="admin"><AdminReports /></RoleGate>} />
              <Route path="admin/invites" element={<RoleGate allow="admin"><AdminInvites /></RoleGate>} />
              <Route path="admin/bulk" element={<RoleGate allow="admin"><AdminBulkUpload /></RoleGate>} />
              <Route path="admin/timetable" element={<RoleGate allow="admin"><AdminTimetable /></RoleGate>} />
              <Route path="admin/hostel" element={<RoleGate allow="admin"><AdminHostel /></RoleGate>} />
              <Route path="admin/transport" element={<RoleGate allow="admin"><AdminTransport /></RoleGate>} />
              <Route path="admin/announcements" element={<RoleGate allow="admin"><AdminAnnouncements /></RoleGate>} />
              <Route path="admin/fees" element={<RoleGate allow="admin"><AdminFees /></RoleGate>} />
              <Route path="admin/library" element={<RoleGate allow="admin"><LibraryManager /></RoleGate>} />
              <Route path="admin/lesson-notes" element={<RoleGate allow="admin"><AdminLessonNotes /></RoleGate>} />
              <Route path="admin/question-bank" element={<RoleGate allow="admin"><AdminQuestionBank /></RoleGate>} />
              <Route path="admin/proctoring" element={<RoleGate allow="admin"><AdminProctoring /></RoleGate>} />
              <Route path="admin/modules" element={<RoleGate allow="admin"><AdminModules /></RoleGate>} />
              <Route path="admin/inbox" element={<RoleGate allow="admin"><Inbox /></RoleGate>} />
              <Route path="admin/settings" element={<RoleGate allow="admin"><AdminSettings /></RoleGate>} />
              <Route path="admin/onboarding" element={<RoleGate allow="admin"><AdminOnboarding /></RoleGate>} />
              <Route path="admin/parent-alerts" element={<RoleGate allow="admin"><AdminParentAlerts /></RoleGate>} />
              <Route path="admin/ai-activity" element={<RoleGate allow="admin"><AdminAIActivity /></RoleGate>} />
              <Route path="admin/ai-settings" element={<RoleGate allow="admin"><AdminAISettings /></RoleGate>} />
              <Route path="admin/copilot" element={<RoleGate allow="admin"><AdminCopilot /></RoleGate>} />
              <Route path="admin/knowledge" element={<RoleGate allow="admin"><AdminKnowledge /></RoleGate>} />
              <Route path="admin/subscription" element={<RoleGate allow="admin"><AdminSubscription /></RoleGate>} />
              <Route path="admin/roles" element={<RoleGate allow="admin"><AdminRoles /></RoleGate>} />
              <Route path="admin/trad-exams" element={<RoleGate allow="admin"><AdminTradExams /></RoleGate>} />
              <Route path="admin/trad-exams/paper/:examId" element={<RoleGate allow="admin"><AdminTradExamPaper /></RoleGate>} />
              <Route path="admin/trad-exams/:sessionId" element={<RoleGate allow="admin"><AdminTradExamSession /></RoleGate>} />
              <Route path="admin/trad-exams-approvals" element={<RoleGate allow="admin"><AdminTradExamApprovals /></RoleGate>} />
              <Route path="admin/trad-exams-results" element={<RoleGate allow="admin"><AdminTradExamResults /></RoleGate>} />
              <Route path="admin/trad-cards" element={<RoleGate allow="admin"><AdminTradScratchCards /></RoleGate>} />
              <Route path="trad-unlock/:resultId" element={<TradUnlockResult />} />
              <Route path="help" element={<HelpPage />} />

              {/* ===== Communication Hub (unified for all roles) ===== */}
              {(["admin", "teacher", "student", "parent"] as const).map((r) => (
                <Route key={r} path={`${r}/communication`} element={<RoleGate allow={r}><CommsHub /></RoleGate>}>
                  <Route index element={<Navigate to="inbox" replace />} />
                  <Route path="inbox" element={<CommsInbox />} />
                  <Route path="dm" element={<CommsDM />} />
                  <Route path="dm/:convId" element={<CommsDM />} />
                  <Route path="channels" element={<CommsChannels />} />
                  <Route path="channels/:channelId" element={<CommsChannels />} />
                  <Route path="announcements" element={<CommsAnnouncements />} />
                  <Route path="broadcasts" element={<CommsBroadcasts />} />
                  <Route path="parent-alerts" element={<CommsParentAlerts />} />
                  <Route path="tickets" element={<CommsTickets />} />
                  <Route path="templates" element={<CommsTemplates />} />
                  <Route path="scheduled" element={<CommsScheduled />} />
                  <Route path="notifications" element={<CommsNotifications />} />
                  <Route path="analytics" element={<CommsAnalytics />} />
                </Route>
              ))}

              {/* Legacy redirects → unified hub (zero breakage) */}
              <Route path="admin/inbox-legacy" element={<RoleGate allow="admin"><Inbox /></RoleGate>} />
              <Route path="teacher/inbox-legacy" element={<RoleGate allow="teacher"><Inbox /></RoleGate>} />
              <Route path="student/inbox-legacy" element={<RoleGate allow="student"><Inbox /></RoleGate>} />
              <Route path="parent/inbox-legacy" element={<RoleGate allow="parent"><Inbox /></RoleGate>} />

              <Route path="teacher" element={<RoleGate allow="teacher"><TeacherDashboard /></RoleGate>} />
              <Route path="teacher/classes" element={<RoleGate allow="teacher"><TeacherClasses /></RoleGate>} />
              <Route path="teacher/attendance" element={<RoleGate allow="teacher"><TeacherAttendance /></RoleGate>} />
              <Route path="teacher/tests" element={<RoleGate allow="teacher"><TestBuilder /></RoleGate>} />
              <Route path="teacher/assessments" element={<RoleGate allow="teacher"><TeacherAssessments /></RoleGate>} />
              <Route path="teacher/trad-exams" element={<RoleGate allow="teacher"><TeacherTradExams /></RoleGate>} />
              <Route path="teacher/trad-exams/paper/:examId" element={<RoleGate allow="teacher"><AdminTradExamPaper /></RoleGate>} />
              <Route path="teacher/trad-exams-grading" element={<RoleGate allow="teacher"><TeacherTradExamGrading /></RoleGate>} />
              <Route path="teacher/grading" element={<RoleGate allow="teacher"><Grading /></RoleGate>} />
              <Route path="teacher/students" element={<RoleGate allow="teacher"><TeacherStudents /></RoleGate>} />
              <Route path="teacher/parents" element={<RoleGate allow="teacher"><TeacherParents /></RoleGate>} />
              <Route path="teacher/calendar" element={<RoleGate allow="teacher"><TeacherCalendar /></RoleGate>} />
              <Route path="teacher/lesson-plan" element={<RoleGate allow="teacher"><TeacherLessonPlan /></RoleGate>} />
              <Route path="teacher/lesson-notes" element={<RoleGate allow="teacher"><TeacherLessonNotes /></RoleGate>} />
              <Route path="teacher/library" element={<RoleGate allow="teacher"><LibraryManager /></RoleGate>} />
              <Route path="teacher/resources" element={<RoleGate allow="teacher"><TeacherResources /></RoleGate>} />
              <Route path="teacher/reports" element={<RoleGate allow="teacher"><TeacherReports /></RoleGate>} />
              <Route path="teacher/messages" element={<RoleGate allow="teacher"><TeacherMessages /></RoleGate>} />
              <Route path="teacher/assignments" element={<RoleGate allow="teacher"><TeacherAssignments /></RoleGate>} />
              <Route path="teacher/gradebook" element={<RoleGate allow="teacher"><TeacherGradebook /></RoleGate>} />
              <Route path="teacher/behavior" element={<RoleGate allow="teacher"><TeacherBehavior /></RoleGate>} />
              <Route path="teacher/parent-comms" element={<RoleGate allow="teacher"><TeacherParentComms /></RoleGate>} />
              <Route path="teacher/inbox" element={<RoleGate allow="teacher"><Inbox /></RoleGate>} />
              <Route path="teacher/ai-tutor" element={<RoleGate allow="teacher"><TeacherAITutor /></RoleGate>} />
              <Route path="teacher/ai-marking" element={<RoleGate allow="teacher"><TeacherAIMarking /></RoleGate>} />
              <Route path="teacher/copilot" element={<RoleGate allow="teacher"><AdminCopilot /></RoleGate>} />

              <Route path="student" element={<RoleGate allow="student"><StudentDashboard /></RoleGate>} />
              <Route path="student/classes" element={<RoleGate allow="student"><StudentClasses /></RoleGate>} />
              <Route path="student/register-subjects" element={<RoleGate allow="student"><StudentRegisterSubjects /></RoleGate>} />
              <Route path="student/exams" element={<RoleGate allow="student"><ExamInterface /></RoleGate>} />
              <Route path="student/assessments" element={<RoleGate allow="student"><StudentMyAssessments /></RoleGate>} />
              <Route path="student/mock" element={<RoleGate allow="student"><MockPicker /></RoleGate>} />
              <Route path="student/mock/:sessionId" element={<RoleGate allow="student"><MockRunner /></RoleGate>} />
              <Route path="student/mock/:sessionId/result" element={<RoleGate allow="student"><MockResult /></RoleGate>} />
              <Route path="student/practice" element={<RoleGate allow="student"><Practice /></RoleGate>} />
              <Route path="student/results" element={<RoleGate allow="student"><StudentResults /></RoleGate>} />
              <Route path="student/library" element={<RoleGate allow="student"><Library /></RoleGate>} />
              <Route path="student/lesson-notes" element={<RoleGate allow="student"><StudentLessonNotes /></RoleGate>} />
              <Route path="student/ai-tutor" element={<RoleGate allow="student"><AITutor /></RoleGate>} />
              <Route path="student/review" element={<RoleGate allow="student"><StudentExamReview /></RoleGate>} />
              <Route path="student/calendar" element={<RoleGate allow="student"><StudentCalendar /></RoleGate>} />
              <Route path="student/assignments" element={<RoleGate allow="student"><StudentAssignments /></RoleGate>} />
              <Route path="student/gradebook" element={<RoleGate allow="student"><StudentGradebook /></RoleGate>} />
              <Route path="student/behavior" element={<RoleGate allow="student"><StudentBehavior /></RoleGate>} />
              <Route path="student/fees" element={<RoleGate allow="student"><StudentFees /></RoleGate>} />
              <Route path="student/messages" element={<RoleGate allow="student"><StudentMessages /></RoleGate>} />
              <Route path="student/attendance" element={<RoleGate allow="student"><StudentAttendance /></RoleGate>} />
              <Route path="student/trad-exams" element={<RoleGate allow="student"><StudentTradExams /></RoleGate>} />
              <Route path="student/trad-exams/:examId" element={<RoleGate allow="student"><StudentTradExamRunner /></RoleGate>} />
              <Route path="student/trad-exams/:attemptId/result" element={<RoleGate allow="student"><StudentTradExamResult /></RoleGate>} />
              <Route path="student/inbox" element={<RoleGate allow="student"><Inbox /></RoleGate>} />
              <Route path="student/copilot" element={<RoleGate allow="student"><AdminCopilot /></RoleGate>} />

              <Route path="parent" element={<RoleGate allow="parent"><ParentDashboard /></RoleGate>} />
              <Route path="parent/children" element={<RoleGate allow="parent"><ParentChildren /></RoleGate>} />
              <Route path="parent/results" element={<RoleGate allow="parent"><ParentResults /></RoleGate>} />
              <Route path="parent/attendance" element={<RoleGate allow="parent"><ParentAttendance /></RoleGate>} />
              <Route path="parent/activity" element={<RoleGate allow="parent"><ParentActivity /></RoleGate>} />
              <Route path="parent/fees" element={<RoleGate allow="parent"><ParentFees /></RoleGate>} />
              <Route path="parent/messages" element={<RoleGate allow="parent"><ParentMessages /></RoleGate>} />
              <Route path="parent/calendar" element={<RoleGate allow="parent"><ParentCalendar /></RoleGate>} />
              <Route path="parent/behavior" element={<RoleGate allow="parent"><ParentBehavior /></RoleGate>} />
              <Route path="parent/teacher-comms" element={<RoleGate allow="parent"><ParentTeacherComms /></RoleGate>} />
              <Route path="parent/inbox" element={<RoleGate allow="parent"><Inbox /></RoleGate>} />
              <Route path="parent/copilot" element={<RoleGate allow="parent"><AdminCopilot /></RoleGate>} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SchoolProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
