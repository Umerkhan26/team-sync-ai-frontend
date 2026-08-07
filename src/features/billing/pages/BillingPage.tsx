import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CreditCard, ExternalLink, Minus, Plus, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { billingApi } from '@/services/billingApi'
import { orgApi } from '@/services/orgApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveOrganization } from '@/store/orgSlice'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, getErrorMessage } from '@/utils/cn'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    blurb: 'For small teams getting started.',
    seats: 'Up to 10 seats',
    features: ['Projects & tasks', 'Chat & docs', 'Basic AI assist'],
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    blurb: 'For growing companies that need control.',
    seats: 'Per seat / month',
    features: [
      'Everything in Free',
      'Audit log & custom roles',
      'Priority AI quota',
      'Advanced analytics',
    ],
    icon: Sparkles,
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    blurb: 'Security, SSO, and dedicated support.',
    seats: 'Unlimited seats',
    features: ['SSO / SAML', 'Custom domain', 'SLA & DPA', 'Dedicated success manager'],
    icon: CreditCard,
  },
] as const

const SEAT_CAP = 100

function formatStorage(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const org = useAppSelector((s) => s.org.activeOrganization)
  const membership = useAppSelector((s) => s.org.activeMembership)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const { can, isOwner } = usePermissions()
  const [seats, setSeats] = useState(3)

  const billingQuery = useQuery({
    queryKey: ['billing', org?.id],
    queryFn: () => billingApi.status(),
    enabled: Boolean(org?.id) && (can('org:billing') || isOwner),
  })

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices', org?.id],
    queryFn: () => billingApi.invoices(),
    enabled: Boolean(org?.id) && (can('org:billing') || isOwner),
  })

  const billing = billingQuery.data
  const currentPlan = (billing?.plan || org?.plan || 'free').toLowerCase()
  const configured = billing?.configured ?? false

  useEffect(() => {
    if (billing?.billingSeats) setSeats(billing.billingSeats)
    else if (org?.billingSeats) setSeats(org.billingSeats)
  }, [billing?.billingSeats, org?.billingSeats])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (!checkout || !org?.id) return
    if (checkout === 'success') {
      toast.success('Payment received — refreshing plan…')
      void (async () => {
        await queryClient.invalidateQueries({ queryKey: ['billing', org.id] })
        await queryClient.invalidateQueries({ queryKey: ['billing-invoices', org.id] })
        try {
          const data = await orgApi.get(org.id)
          dispatch(
            setActiveOrganization({
              organization: data.organization,
              membership: membership ?? undefined,
            }),
          )
        } catch {
          /* ignore */
        }
      })()
    } else if (checkout === 'cancel') {
      toast.message('Checkout cancelled')
    }
    searchParams.delete('checkout')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id])

  const checkoutMutation = useMutation({
    mutationFn: () => billingApi.checkout(seats),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url
        return
      }
      toast.error('No checkout URL returned')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const portalMutation = useMutation({
    mutationFn: () => billingApi.portal(),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url
        return
      }
      toast.error('No portal URL returned')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (!can('org:billing') && !isOwner) {
    return (
      <div className="surface-panel max-w-lg p-6">
        <h1 className="app-title text-lg">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the workspace owner can manage billing. Ask them if you need a plan change.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link to="/app">Back home</Link>
        </Button>
      </div>
    )
  }

  const monthlyTotal = currentPlan === 'pro' ? seats * 12 : seats * 12
  const invoices = invoicesQuery.data ?? []

  const startCheckout = () => {
    if (!configured) {
      toast.error('Stripe is not configured on the server')
      return
    }
    checkoutMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan & seats"
        title="Billing"
        description={
          configured
            ? `${org?.name || 'Workspace'} · current plan: ${currentPlan}. Payments run through Stripe Checkout (test mode OK).`
            : `${org?.name || 'Workspace'} · Stripe keys missing on the server.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {configured ? (
              <Badge variant="secondary">Stripe connected</Badge>
            ) : (
              <Badge variant="outline">Stripe offline</Badge>
            )}
            {billing?.hasSubscription ? (
              <Button
                size="sm"
                variant="outline"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Manage subscription
              </Button>
            ) : (
              <Button size="sm" disabled={checkoutMutation.isPending || !configured} onClick={startCheckout}>
                <CreditCard className="h-3.5 w-3.5" />
                {checkoutMutation.isPending ? 'Redirecting…' : 'Upgrade to Pro'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Current plan</p>
            <p className="text-xs text-muted-foreground">
              {currentPlan === 'pro'
                ? `$12 × ${seats} seats = $${seats * 12}/mo`
                : `Select seats below, then upgrade (≈ $${monthlyTotal}/mo).`}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {currentPlan}
          </Badge>
        </div>

        <div className="surface-panel p-4">
          <p className="text-sm font-medium">Storage</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {billing?.storage
              ? billing.storage.limitBytes == null
                ? `${formatStorage(billing.storage.usedBytes)} used · unlimited`
                : `${formatStorage(billing.storage.usedBytes)} / ${formatStorage(billing.storage.limitBytes)}`
              : 'Loading…'}
          </p>
          {billing?.storage?.limitBytes != null ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (billing.storage.usedBytes / billing.storage.limitBytes) * 100,
                  )}%`,
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="surface-panel p-4 lg:col-span-2">
          <p className="text-sm font-medium">Seats</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentPlan === 'pro'
              ? 'Change seats in Stripe Customer Portal.'
              : 'Quantity charged at checkout ($12 / seat / month).'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPlan === 'pro' || seats <= 1}
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[4.5rem] text-center text-lg font-semibold tabular-nums">
              {seats}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPlan === 'pro' || seats >= SEAT_CAP}
              onClick={() => setSeats((s) => Math.min(SEAT_CAP, s + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="app-title text-sm">Invoices</h2>
        {invoicesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <p className="surface-panel p-4 text-sm text-muted-foreground">
            No Stripe invoices yet. After a successful test checkout they appear here.
          </p>
        ) : (
          <ul className="surface-panel divide-y divide-border overflow-hidden">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{inv.id}</p>
                  <p className="text-xs text-muted-foreground">{inv.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{inv.amount}</span>
                  <Badge variant={inv.status === 'paid' ? 'success' : 'secondary'} className="capitalize">
                    {inv.status}
                  </Badge>
                  {inv.pdfUrl || inv.hostedUrl ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                      <a href={inv.pdfUrl || inv.hostedUrl || '#'} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'surface-panel relative flex flex-col p-5',
              'highlight' in plan && plan.highlight && 'border-primary/40 shadow-md',
              currentPlan === plan.id && 'ring-1 ring-primary/50',
            )}
          >
            {'highlight' in plan && plan.highlight ? (
              <span className="absolute right-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Popular
              </span>
            ) : null}
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <plan.icon className="h-4 w-4" />
            </div>
            <h2 className="app-title mt-3 text-base">{plan.name}</h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {plan.price}
              {plan.id === 'pro' ? (
                <span className="text-sm font-normal text-muted-foreground"> / seat</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{plan.blurb}</p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">{plan.seats}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-5"
              variant={currentPlan === plan.id ? 'secondary' : 'default'}
              disabled={
                currentPlan === plan.id ||
                plan.id === 'free' ||
                plan.id === 'enterprise' ||
                checkoutMutation.isPending ||
                !configured
              }
              onClick={() => {
                if (plan.id === 'pro') startCheckout()
                else if (plan.id === 'enterprise') {
                  toast.message('Enterprise is sales-led — contact support for a custom quote.')
                }
              }}
            >
              {currentPlan === plan.id
                ? 'Current plan'
                : plan.id === 'enterprise'
                  ? 'Contact sales'
                  : plan.id === 'free'
                    ? 'Included'
                    : checkoutMutation.isPending
                      ? 'Redirecting…'
                      : `Upgrade to ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
