import { apiGet, apiPatch, apiPost } from './api'
import type { AuthTokens, NotificationPreferences, User } from '@/types'

const NOTIFICATION_PREFS_KEY = 'teamsync_notification_prefs'

export const authApi = {
  register(input: { email: string; password: string; name: string }) {
    return apiPost<AuthTokens & { verificationCode?: string }>('/auth/register', input)
  },
  login(input: { email: string; password: string }) {
    return apiPost<AuthTokens>('/auth/login', input)
  },
  logout(refreshToken?: string | null) {
    return apiPost<{ loggedOut: boolean }>('/auth/logout', {
      refreshToken: refreshToken || undefined,
    })
  },
  me() {
    return apiGet<{ user: User }>('/auth/me').then((r) => r.data.user)
  },
  updateMe(input: {
    name?: string
    avatarUrl?: string | null
    notificationPreferences?: Partial<NotificationPreferences>
  }) {
    // NOTE: backend `notificationPreferences` support may land slightly later — callers
    // should fall back to setLocalNotificationPreferences() if this rejects.
    return apiPatch<{ user: User }>('/auth/me', input).then((r) => r.user)
  },
  getLocalNotificationPreferences(): Partial<NotificationPreferences> | null {
    try {
      const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY)
      return raw ? (JSON.parse(raw) as Partial<NotificationPreferences>) : null
    } catch {
      return null
    }
  },
  setLocalNotificationPreferences(prefs: Partial<NotificationPreferences>) {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs))
  },
  verifyEmail(input: { code: string; email?: string }) {
    return apiPost<{ user: User }>('/auth/verify-email', input)
  },
  resendVerification() {
    return apiPost<{ sent: boolean; verificationCode?: string }>('/auth/resend-verification', {})
  },
  forgotPassword(email: string) {
    return apiPost<{ sent: boolean }>('/auth/forgot-password', { email })
  },
  resetPassword(code: string, password: string) {
    return apiPost<{ user: User }>('/auth/reset-password', { code, password })
  },
}
