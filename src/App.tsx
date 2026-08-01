import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import {
  GuestRoute,
  ProtectedRoute,
} from '@/features/auth/components/ProtectedRoute'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { OnboardingPage } from '@/features/organizations/pages/OnboardingPage'
import { AcceptInvitePage } from '@/features/organizations/pages/AcceptInvitePage'
import { DashboardPage } from '@/features/analytics/pages/DashboardPage'
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage'
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage'
import { TasksPage } from '@/features/tasks/pages/TasksPage'
import { ChatPage } from '@/features/chat/pages/ChatPage'
import {
  DocumentEditorPage,
  DocumentsPage,
} from '@/features/documents/pages/DocumentsPage'
import { AiAssistantPage } from '@/features/ai/pages/AiAssistantPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { AdminPage } from '@/features/admin/pages/AdminPage'
import { FilesPage } from '@/features/files/pages/FilesPage'
import { TeamsPage } from '@/features/teams/pages/TeamsPage'
import { MeetingsPage } from '@/features/meetings/pages/MeetingsPage'
import { HelpPage } from '@/features/help/pages/HelpPage'
import { TemplatesPage } from '@/features/templates/pages/TemplatesPage'
import { BillingPage } from '@/features/billing/pages/BillingPage'
import { IntegrationsPage } from '@/features/integrations/pages/IntegrationsPage'
import { MeetingRoomPage } from '@/features/meetings/pages/MeetingRoomPage'
import { PricingPage } from '@/pages/PricingPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="pricing" element={<PricingPage />} />
      </Route>

      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>

      <Route path="verify-email" element={<AuthLayout />}>
        <Route index element={<VerifyEmailPage />} />
      </Route>

      {/* Public: new users activate without an existing session */}
      <Route path="invitations/accept" element={<AcceptInvitePage />} />

      <Route element={<ProtectedRoute requireVerified />}>
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:documentId" element={<DocumentEditorPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="meetings/:meetingId/room" element={<MeetingRoomPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="ai" element={<AiAssistantPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="templates" element={<TemplatesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
