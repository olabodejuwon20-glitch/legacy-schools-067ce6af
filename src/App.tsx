import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SchoolProvider, useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { RequireAuth, RequireSchool, RoleGate } from "@/components/Guards";
import { OnboardingGate } from "@/components/admin/OnboardingGate";
import { PremiumGate } from "@/components/pilot/PremiumGate";
import AppLayout from "./layouts/AppLayout";
const NotFound = lazy(() => import("./pages/NotFound"));
const Landing = lazy(() => import("./pages/Landing"));
import AnalyticsTracker from "./components/AnalyticsTracker";
import TenantHead from "./components/TenantHead";
import ImpersonationBanner from "./components/ImpersonationBanner";
const Register = lazy(() => import("./pages/Register"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SchoolHome = lazy(() => import("./pages/SchoolHome"));
const SchoolLogin = lazy(() => import("./pages/SchoolLogin"));
const SchoolAdminLogin = lazy(() => import("./pages/SchoolAdminLogin"));
const Join = lazy(() => import("./pages/Join"));
const ChangePin = lazy(() => import("./pages/ChangePin"));
const Bio = lazy(() => import("./pages/Bio"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const VerifyResult = lazy(() => import("./pages/VerifyResult"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refer = lazy(() => import("./pages/Refer"));
const Terms = lazy(() => import("./pages/Terms"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminTeachers = lazy(() => import("./pages/admin/Teachers"));
const AdminClasses = lazy(() => import("./pages/admin/Classes"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminInvites = lazy(() => import("./pages/admin/Invites"));
const AdminBulkUpload = lazy(() => import("./pages/admin/BulkUpload"));
const AdminHostel = lazy(() => import("./pages/admin/Hostel"));
const AdminTransport = lazy(() => import("./pages/admin/Transport"));
const DriverTrip = lazy(() => import("./pages/driver/DriverTrip"));
const ParentBusTracking = lazy(() => import("./pages/parent/BusTracking"));
const StudentBusTracking = lazy(() => import("./pages/student/BusTracking"));
const AdminTimetable = lazy(() => import("./pages/admin/Timetable"));
const AdminAnnouncements = lazy(() => import("./pages/admin/Announcements"));
const AdminFees = lazy(() => import("./pages/admin/Fees"));
const AdminQuestionBank = lazy(() => import("./pages/admin/QuestionBank"));
const AdminProctoring = lazy(() => import("./pages/admin/Proctoring"));
const AdminLessonNotes = lazy(() => import("./pages/admin/LessonNotes"));
const AdminModules = lazy(() => import("./pages/admin/Modules"));
const AdminEnrollments = lazy(() => import("./pages/admin/Enrollments"));
const AdminOnboarding = lazy(() => import("./pages/admin/Onboarding"));
const AdminParentAlerts = lazy(() => import("./pages/admin/ParentAlerts"));
const AdminAIActivity = lazy(() => import("./pages/admin/AIActivity"));
const AdminAISettings = lazy(() => import("./pages/admin/AISettings"));
const AdminCopilot = lazy(() => import("./pages/admin/Copilot"));
const AdminKnowledge = lazy(() => import("./pages/admin/Knowledge"));
const AdminSubscription = lazy(() => import("./pages/admin/Subscription"));
const AdminParents = lazy(() => import("./pages/admin/Parents"));
const AdminAttendance = lazy(() => import("./pages/admin/Attendance"));
const AdminRoles = lazy(() => import("./pages/admin/Roles"));
const AdminAcademic = lazy(() => import("./pages/admin/academic/Academic"));
const AdminTradExams = lazy(() => import("./pages/admin/TradExams"));
const AdminExamCommittee = lazy(() => import("./pages/admin/ExamCommittee"));
const AdminTradExamSession = lazy(() => import("./pages/admin/TradExamSession"));
const AdminTradExamPaper = lazy(() => import("./pages/admin/TradExamPaper"));
const AdminTradExamApprovals = lazy(() => import("./pages/admin/TradExamApprovals"));
const AdminTradExamResults = lazy(() => import("./pages/admin/TradExamResults"));
const AdminExamResultsRelease = lazy(() => import("./pages/admin/ExamResultsRelease"));
const AdminTradScratchCards = lazy(() => import("./pages/admin/TradScratchCards"));
const AdminAcademicSetup = lazy(() => import("./pages/admin/AcademicSetup"));
const AdminExamAppeals = lazy(() => import("./pages/admin/ExamAppeals"));
const AdminAdmissionHub = lazy(() => import("./pages/admin/AdmissionHub"));
const AdminAssessmentsHub = lazy(() => import("./pages/admin/AssessmentsHub"));
const AdminAssessmentApprovals = lazy(() => import("./pages/admin/AssessmentApprovals"));
const AdminAIOpsHub = lazy(() => import("./pages/admin/AIOpsHub"));
const AdminWorkspace = lazy(() => import("./pages/admin/Workspace"));
const AdminOnboardingCenter = lazy(() => import("./pages/admin/OnboardingCenter"));
const TradUnlockResult = lazy(() => import("./pages/shared/TradUnlockResult"));
const SubscriptionCallback = lazy(() => import("./pages/SubscriptionCallback"));
const HelpPage = lazy(() => import("./pages/Help"));
const LibraryManager = lazy(() => import("./pages/shared/LibraryManager"));
const Inbox = lazy(() => import("./pages/shared/Inbox"));
const CommsHub = lazy(() => import("./pages/comms/Hub"));
const CommsInbox = lazy(() => import("./pages/comms/views/InboxView"));
const CommsDM = lazy(() => import("./pages/comms/views/DMView"));
const CommsChannels = lazy(() => import("./pages/comms/views/ChannelsView"));
const CommsAnnouncements = lazy(() => import("./pages/comms/views/AnnouncementsView"));
const CommsBroadcasts = lazy(() => import("./pages/comms/views/BroadcastsView"));
const CommsTickets = lazy(() => import("./pages/comms/views/TicketsView"));
const CommsTemplates = lazy(() => import("./pages/comms/views/TemplatesView"));
const CommsScheduled = lazy(() => import("./pages/comms/views/ScheduledView"));
const CommsNotifications = lazy(() => import("./pages/comms/views/NotificationsView"));
const CommsAnalytics = lazy(() => import("./pages/comms/views/AnalyticsView"));
const CommsParentAlerts = lazy(() => import("./pages/comms/views/ParentAlertsView"));

const TeacherDashboard = lazy(() => import("./pages/teacher/Dashboard"));
const TeacherClasses = lazy(() => import("./pages/teacher/Classes"));
const TeacherAttendance = lazy(() => import("./pages/teacher/Attendance"));
const TestBuilder = lazy(() => import("./pages/teacher/TestBuilder"));
const Grading = lazy(() => import("./pages/teacher/Grading"));
const TeacherStudents = lazy(() => import("./pages/teacher/Students"));
const TeacherParents = lazy(() => import("./pages/teacher/Parents"));
const TeacherCalendar = lazy(() => import("./pages/teacher/Calendar"));
const TeacherMessages = lazy(() => import("./pages/teacher/Messages"));
const TeacherResources = lazy(() => import("./pages/teacher/Resources"));
const TeacherReports = lazy(() => import("./pages/teacher/Reports"));
const TeacherLessonPlan = lazy(() => import("./pages/teacher/LessonPlan"));
const TeacherLessonNotes = lazy(() => import("./pages/teacher/LessonNotes"));
const TeacherAssignments = lazy(() => import("./pages/teacher/Assignments"));
const TeacherGradebook = lazy(() => import("./pages/teacher/Gradebook"));
const TeacherBehavior = lazy(() => import("./pages/teacher/Behavior"));
const TeacherParentComms = lazy(() => import("./pages/teacher/ParentComms"));
const TeacherAssessments = lazy(() => import("./pages/teacher/Assessments"));
const TeacherTradExams = lazy(() => import("./pages/teacher/TradExams"));
const TeacherTradExamGrading = lazy(() => import("./pages/teacher/TradExamGrading"));

const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentClasses = lazy(() => import("./pages/student/Classes"));
const ExamInterface = lazy(() => import("./pages/student/ExamInterface"));
const StudentResults = lazy(() => import("./pages/student/Results"));
const Library = lazy(() => import("./pages/student/Library"));
const AITutor = lazy(() => import("./pages/student/AITutor"));
const StudentExamReview = lazy(() => import("./pages/student/ExamReview"));
const TeacherAITutor = lazy(() => import("./pages/teacher/AITutor"));
const TeacherAIMarking = lazy(() => import("./pages/teacher/AIMarking"));
const StudentCalendar = lazy(() => import("./pages/student/Calendar"));
const StudentLessonNotes = lazy(() => import("./pages/student/LessonNotes"));
const StudentAssignments = lazy(() => import("./pages/student/Assignments"));
const StudentMessages = lazy(() => import("./pages/student/Messages"));
const StudentFees = lazy(() => import("./pages/student/Fees"));
const StudentBehavior = lazy(() => import("./pages/student/Behavior"));
const StudentGradebook = lazy(() => import("./pages/student/Gradebook"));
const MockPicker = lazy(() => import("./pages/student/MockPicker"));
const MockRunner = lazy(() => import("./pages/student/MockRunner"));
const MockResult = lazy(() => import("./pages/student/MockResult"));
const Practice = lazy(() => import("./pages/student/Practice"));
const StudentRegisterSubjects = lazy(() => import("./pages/student/RegisterSubjects"));
const StudentMyAssessments = lazy(() => import("./pages/student/MyAssessments"));
const StudentAttendance = lazy(() => import("./pages/student/Attendance"));
const StudentTradExams = lazy(() => import("./pages/student/TradExams"));
const StudentTradExamRunner = lazy(() => import("./pages/student/TradExamRunner"));
const StudentTradExamResult = lazy(() => import("./pages/student/TradExamResult"));
const StudentAppealForm = lazy(() => import("./pages/student/AppealForm"));

const ParentDashboard = lazy(() => import("./pages/parent/Dashboard"));
const ParentChildren = lazy(() => import("./pages/parent/Children"));
const ParentResults = lazy(() => import("./pages/parent/Results"));
const ParentAttendance = lazy(() => import("./pages/parent/Attendance"));
const ParentActivity = lazy(() => import("./pages/parent/Activity"));
const ParentFees = lazy(() => import("./pages/parent/Fees"));
const ParentMessages = lazy(() => import("./pages/parent/Messages"));
const ParentCalendar = lazy(() => import("./pages/parent/Calendar"));
const ParentBehavior = lazy(() => import("./pages/parent/Behavior"));
const ParentTeacherComms = lazy(() => import("./pages/parent/TeacherComms"));

const SuperLayout = lazy(() => import("./layouts/SuperLayout"));
const SuperDashboard = lazy(() => import("./pages/super/Dashboard"));
const SuperClaim = lazy(() => import("./pages/super/Claim"));
const SuperSchools = lazy(() => import("./pages/super/Schools"));
const SuperSchoolDetail = lazy(() => import("./pages/super/SchoolDetail"));
const SuperPilots = lazy(() => import("./pages/super/Pilots"));
const SuperModules = lazy(() => import("./pages/super/Modules"));
const SuperMarketplace = lazy(() => import("./pages/super/Marketplace"));
const SuperAnalytics = lazy(() => import("./pages/super/Analytics"));
const SuperTenantConfig = lazy(() => import("./pages/super/TenantConfig"));
const SuperLicensing = lazy(() => import("./pages/super/Licensing"));
const SuperSubscriptions = lazy(() => import("./pages/super/Subscriptions"));
const SuperBilling = lazy(() => import("./pages/super/Billing"));
const SuperUsers = lazy(() => import("./pages/super/Users"));
const SuperAnnouncements = lazy(() => import("./pages/super/Announcements"));
const SuperTickets = lazy(() => import("./pages/super/Tickets"));
const SuperSecurity = lazy(() => import("./pages/super/Security"));
const SuperLogs = lazy(() => import("./pages/super/Logs"));
const SuperErrors = lazy(() => import("./pages/super/Errors"));
const SuperQuotas = lazy(() => import("./pages/super/Quotas"));
const SuperFeatureFlags = lazy(() => import("./pages/super/FeatureFlags"));
const SuperSettings = lazy(() => import("./pages/super/Settings"));
const SuperAcademicDefaults = lazy(() => import("./pages/super/AcademicDefaults"));
const SuperProducts = lazy(() => import("./pages/super/Products"));
const SuperBusiness = lazy(() => import("./pages/super/Business"));
const ComingSoon = lazy(() => import("./pages/super/_ComingSoon"));

const queryClient = new QueryClient();

function AppRoot() {
  const { activeRole, school } = useSchool();
  return <Navigate to={schoolPath(school?.slug, `/app/${activeRole}`)} replace />;
}

function TenantOnboardingRedirect() {
  const { school } = useSchool();
  return <Navigate to={schoolPath(school?.slug, "/onboarding")} replace />;
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
          <TenantHead />
          <ImpersonationBanner />
          <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>}><Routes>
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
            <Route path="products" element={<SuperProducts />} />
            <Route path="modules" element={<Navigate to="/super/products?tab=modules" replace />} />
            <Route path="licensing" element={<Navigate to="/super/products?tab=licensing" replace />} />
            <Route path="configurations" element={<SuperTenantConfig />} />
            <Route path="marketplace" element={<Navigate to="/super/products?tab=marketplace" replace />} />
            <Route path="business" element={<SuperBusiness />} />
            <Route path="subscriptions" element={<SuperSubscriptions />} />
            <Route path="billing" element={<Navigate to="/super/business?tab=invoices" replace />} />
            <Route path="pilots" element={<Navigate to="/super/business?tab=pilots" replace />} />
            <Route path="announcements" element={<SuperAnnouncements />} />
            <Route path="tickets" element={<SuperTickets />} />
            <Route path="security" element={<SuperSecurity />} />
            <Route path="logs" element={<SuperLogs />} />
            <Route path="errors" element={<SuperErrors />} />
            <Route path="quotas" element={<SuperQuotas />} />
            <Route path="feature-flags" element={<Navigate to="/super/products?tab=flags" replace />} />
            <Route path="settings" element={<SuperSettings />} />
            <Route path="academic-defaults" element={<SuperAcademicDefaults />} />
          </Route>

            {/* School-scoped routes: /:slug/... */}
            <Route path="/:slug" element={<SchoolHome />} />
            <Route path="/:slug/signin" element={<SchoolLogin />} />
            <Route path="/:slug/admin" element={<SchoolAdminLogin />} />
            <Route path="/:slug/join" element={<Join />} />
            <Route path="/:slug/change-pin" element={<RequireAuth><ChangePin /></RequireAuth>} />
            <Route path="/:slug/bio" element={<RequireAuth><Bio /></RequireAuth>} />
            <Route path="/:slug/onboarding" element={<RequireSchool><RoleGate allow="admin"><AdminOnboarding /></RoleGate></RequireSchool>} />
            <Route path="/:slug/app" element={<RequireSchool><OnboardingGate><AppLayout /></OnboardingGate></RequireSchool>}>
              <Route index element={<AppRoot />} />

              <Route path="admin" element={<RoleGate allow="admin"><AdminDashboard /></RoleGate>} />
              <Route path="admin/students" element={<RoleGate allow="admin"><AdminStudents /></RoleGate>} />
              <Route path="admin/teachers" element={<RoleGate allow="admin"><AdminTeachers /></RoleGate>} />
              <Route path="admin/parents" element={<RoleGate allow="admin"><AdminParents /></RoleGate>} />
              <Route path="admin/attendance" element={<RoleGate allow="admin"><AdminAttendance /></RoleGate>} />
              <Route path="admin/classes" element={<RoleGate allow="admin"><AdminClasses /></RoleGate>} />
              <Route path="admin/enrollments" element={<RoleGate allow="admin"><AdminEnrollments /></RoleGate>} />
              <Route path="admin/reports" element={<RoleGate allow="admin"><PremiumGate feature="Advanced Reports & Analytics" description="Whole-school performance dashboards, custom drilldowns and bulk result slips."><AdminReports /></PremiumGate></RoleGate>} />
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
              <Route path="admin/proctoring" element={<RoleGate allow="admin"><PremiumGate feature="CBT Pro · Proctoring" description="Live exam proctoring, lockdown mode, and violation analytics."><AdminProctoring /></PremiumGate></RoleGate>} />
              <Route path="admin/modules" element={<RoleGate allow="admin"><AdminModules /></RoleGate>} />
              <Route path="admin/inbox" element={<RoleGate allow="admin"><Inbox /></RoleGate>} />
              <Route path="admin/settings" element={<RoleGate allow="admin"><AdminSettings /></RoleGate>} />
              <Route path="admin/onboarding" element={<RoleGate allow="admin"><TenantOnboardingRedirect /></RoleGate>} />
              <Route path="admin/parent-alerts" element={<RoleGate allow="admin"><AdminParentAlerts /></RoleGate>} />
              <Route path="admin/ai-activity" element={<RoleGate allow="admin"><AdminAIActivity /></RoleGate>} />
              <Route path="admin/ai-settings" element={<RoleGate allow="admin"><AdminAISettings /></RoleGate>} />
              <Route path="admin/copilot" element={<RoleGate allow="admin"><PremiumGate feature="Principal AI Copilot" description="Ask anything about your school — attendance, fees, weak topics. Unlocked with any paid plan."><AdminCopilot /></PremiumGate></RoleGate>} />
              <Route path="admin/knowledge" element={<RoleGate allow="admin"><AdminKnowledge /></RoleGate>} />
              <Route path="admin/subscription" element={<RoleGate allow="admin"><AdminSubscription /></RoleGate>} />
              <Route path="admin/billing" element={<RoleGate allow="admin"><AdminSubscription initialTab="invoices" /></RoleGate>} />
              <Route path="admin/academic" element={<RoleGate allow="admin"><AdminAcademic /></RoleGate>} />
              <Route path="admin/roles" element={<RoleGate allow="admin"><AdminRoles /></RoleGate>} />
              <Route path="admin/trad-exams" element={<RoleGate allow="admin"><AdminTradExams /></RoleGate>} />
              <Route path="admin/exam-committee" element={<RoleGate allow="admin"><AdminExamCommittee /></RoleGate>} />
              <Route path="admin/trad-exams/paper/:examId" element={<RoleGate allow="admin"><AdminTradExamPaper /></RoleGate>} />
              <Route path="admin/trad-exams/:sessionId" element={<RoleGate allow="admin"><AdminTradExamSession /></RoleGate>} />
              <Route path="admin/trad-exams-approvals" element={<RoleGate allow="admin"><AdminTradExamApprovals /></RoleGate>} />
              <Route path="admin/trad-exams-results" element={<RoleGate allow="admin"><AdminTradExamResults /></RoleGate>} />
              <Route path="admin/exam-results-release" element={<RoleGate allow="admin"><AdminExamResultsRelease /></RoleGate>} />
              <Route path="admin/trad-cards" element={<RoleGate allow="admin"><AdminTradScratchCards /></RoleGate>} />
              <Route path="admin/academic-setup" element={<RoleGate allow="admin"><AdminAcademicSetup /></RoleGate>} />
              <Route path="admin/exam-appeals" element={<RoleGate allow="admin"><AdminExamAppeals /></RoleGate>} />
              <Route path="admin/admission" element={<RoleGate allow="admin"><AdminAdmissionHub /></RoleGate>} />
              <Route path="admin/assessments" element={<RoleGate allow="admin"><AdminAssessmentsHub /></RoleGate>} />
              <Route path="admin/assessment-approvals" element={<RoleGate allow="admin"><AdminAssessmentApprovals /></RoleGate>} />
              <Route path="admin/ai-ops" element={<RoleGate allow="admin"><AdminAIOpsHub /></RoleGate>} />
              <Route path="admin/workspace" element={<RoleGate allow="admin"><AdminWorkspace /></RoleGate>} />
              <Route path="admin/onboarding-center" element={<RoleGate allow="admin"><AdminOnboardingCenter /></RoleGate>} />
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
                  <Route path="broadcasts" element={<PremiumGate feature="Broadcasts" description="Multi-channel SMS/Email/Push broadcasts with templates and scheduling." soft><CommsBroadcasts /></PremiumGate>} />
                  <Route path="parent-alerts" element={<PremiumGate feature="AI Parent Alerts" description="AI-drafted alerts for absence, low scores and behaviour." soft><CommsParentAlerts /></PremiumGate>} />
                  <Route path="tickets" element={<CommsTickets />} />
                  <Route path="templates" element={<CommsTemplates />} />
                  <Route path="scheduled" element={<CommsScheduled />} />
                  <Route path="notifications" element={<CommsNotifications />} />
                  <Route path="analytics" element={<PremiumGate feature="Communications Analytics" soft><CommsAnalytics /></PremiumGate>} />
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
              <Route path="teacher/ai-tutor" element={<RoleGate allow="teacher"><PremiumGate feature="AI Tutor"><TeacherAITutor /></PremiumGate></RoleGate>} />
              <Route path="teacher/ai-marking" element={<RoleGate allow="teacher"><PremiumGate feature="AI Marking" description="Auto-mark theory answers with AI feedback."><TeacherAIMarking /></PremiumGate></RoleGate>} />
              <Route path="teacher/copilot" element={<RoleGate allow="teacher"><PremiumGate feature="Teaching Copilot"><AdminCopilot /></PremiumGate></RoleGate>} />

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
              <Route path="student/ai-tutor" element={<RoleGate allow="student"><PremiumGate feature="AI Tutor"><AITutor /></PremiumGate></RoleGate>} />
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
              <Route path="student/exam-appeal/:attemptId" element={<RoleGate allow="student"><StudentAppealForm /></RoleGate>} />
              <Route path="student/inbox" element={<RoleGate allow="student"><Inbox /></RoleGate>} />
              <Route path="student/copilot" element={<RoleGate allow="student"><PremiumGate feature="Study Copilot"><AdminCopilot /></PremiumGate></RoleGate>} />

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
              <Route path="parent/copilot" element={<RoleGate allow="parent"><PremiumGate feature="Parent Copilot"><AdminCopilot /></PremiumGate></RoleGate>} />
              <Route path="parent/transport" element={<RoleGate allow="parent"><ParentBusTracking /></RoleGate>} />
              <Route path="student/transport" element={<RoleGate allow="student"><StudentBusTracking /></RoleGate>} />
              <Route path="driver/trip" element={<DriverTrip />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes></Suspense>
        </BrowserRouter>
      </SchoolProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
