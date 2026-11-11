import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from '../features/auth/Guards'
import { Layout } from '../components/Layout'
import { PageSkeleton } from '../components/ui'

const Login = lazy(() => import('../features/auth/Login'))
const YearInReview = lazy(() => import('../features/review/YearInReview'))
const Register = lazy(() => import('../features/auth/Register'))
const VerifyEmail = lazy(() => import('../features/auth/VerifyEmail'))
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('../features/auth/ResetPassword'))
const Onboarding = lazy(() => import('../features/account/Onboarding'))
const Dashboard = lazy(() => import('../features/analytics/Dashboard'))
const Insights = lazy(() => import('../features/analytics/Insights'))
const Methodology = lazy(() => import('../features/analytics/Methodology'))
const ActivityLog = lazy(() => import('../features/activities/ActivityLog'))
const ActivityForm = lazy(() => import('../features/activities/ActivityForm'))
const Templates = lazy(() => import('../features/planning/Templates'))
const Baseline = lazy(() => import('../features/planning/Baseline'))
const Settings = lazy(() => import('../features/account/Settings'))
const Notifications = lazy(() => import('../features/notifications/Notifications'))
const Household = lazy(() => import('../features/household/Household'))
const TodayPlan = lazy(() => import('../features/plan/TodayPlan'))
const Calculator = lazy(() => import('../features/calculator/Calculator'))
const Nexus = lazy(() => import('../features/nexus/Nexus'))
const AdminFactors = lazy(() => import('../features/admin/AdminFactors'))

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/onboarding" element={<RequireAuth allowIncompleteOnboarding><Onboarding /></RequireAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="/plan" element={<TodayPlan />} />
          <Route path="/nexus" element={<Nexus />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/log" element={<ActivityLog />} />
          <Route path="/log/new" element={<ActivityForm />} />
          <Route path="/log/:id/edit" element={<ActivityForm />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/baseline" element={<Baseline />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/review" element={<YearInReview />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/household" element={<Household />} />
          <Route path="/admin/factors" element={<AdminFactors />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
