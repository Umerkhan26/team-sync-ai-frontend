import { apiGet, apiPost } from './api'

export type BillingStatus = {
  configured: boolean
  publishableKey: string | null
  plan: string
  billingSeats: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  hasSubscription: boolean
  storage?: {
    plan: string
    usedBytes: number
    limitBytes: number | null
    remainingBytes: number | null
  }
}

export type BillingInvoice = {
  id: string
  date: string
  amount: string
  status: string
  pdfUrl: string | null
  hostedUrl: string | null
}

export const billingApi = {
  status() {
    return apiGet<{ billing: BillingStatus }>('/billing').then((r) => r.data.billing)
  },
  invoices() {
    return apiGet<{ items: BillingInvoice[] }>('/billing/invoices').then((r) => r.data.items)
  },
  checkout(seats: number) {
    return apiPost<{ url: string | null; sessionId: string }>('/billing/checkout', { seats })
  },
  portal() {
    return apiPost<{ url: string | null }>('/billing/portal')
  },
}
