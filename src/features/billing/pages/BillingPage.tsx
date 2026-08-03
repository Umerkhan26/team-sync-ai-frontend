import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CreditCard, Minus, Plus, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/utils/cn'

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

const STUB_INVOICES = [
  { id: 'inv_001', date: '2026-07-01', amount: '$144.00', status: 'Paid' as const },
  { id: 'inv_002', date: '2026-06-01', amount: '$132.00', status: 'Paid' as const },
  { id: 'inv_003', date: '2026-05-01', amount: '$120.00', status: 'Paid' as const },
]

function seatsKey(orgId: string) {
  return `teamsync_billing_seats_${orgId}`
}

function loadSeats(orgId: string): number {
  try {
    const raw = localStorage.getItem(seatsKey(orgId))
    if (raw === null) return 3
    const n = Number(raw)
    return Number.isFinite(n) && n >= 1 ? n : 3
  } catch {
    return 3
  }
}

const SEAT_CAP = 10

export function BillingPage() {
  const org = useAppSelector((s) => s.org.activeOrganization)
  const { can, isOwner } = usePermissions()
  const currentPlan = (org?.plan || 'free').toLowerCase()
  const [seats, setSeats] = useState(() => (org?.id ? loadSeats(org.id) : 3))

  useEffect(() => {
    if (org?.id) setSeats(loadSeats(org.id))
  }, [org?.id])

  const updateSeats = (next: number) => {
    const clamped = Math.max(1, Math.min(999, next))
    setSeats(clamped)
    if (org?.id) localStorage.setItem(seatsKey(org.id), String(clamped))
  }

  const checkout = (planName: string) => {
    toast.info('Stripe checkout is a preview', {
      description: `${planName} payments are not live yet — no card will be charged.`,
    })
  }

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

  const monthlyTotal = currentPlan === 'pro' ? seats * 12 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan & seats"
        title="Billing"
        description={`${org?.name || 'Workspace'} · current plan: ${currentPlan}. Stripe checkout is a preview — payments are not charged yet.`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Preview</Badge>
            <Button size="sm" onClick={() => checkout('Pro')}>
              <CreditCard className="h-3.5 w-3.5" />
              Stripe checkout (preview)
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Current plan</p>
            <p className="text-xs text-muted-foreground">
              {currentPlan === 'pro'
                ? `$12 × ${seats} seats = $${monthlyTotal}/mo`
                : 'Upgrade to Pro for per-seat billing.'}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {currentPlan}
          </Badge>
        </div>

        <div className="surface-panel p-4">
          <p className="text-sm font-medium">Seats used</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Licensed seats for this workspace (stub).
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={seats <= 1}
              onClick={() => updateSeats(seats - 1)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[4.5rem] text-center text-lg font-semibold tabular-nums">
              {seats} / {SEAT_CAP}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={seats >= SEAT_CAP}
              onClick={() => updateSeats(seats + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (seats / SEAT_CAP) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="app-title text-sm">Invoices</h2>
        <ul className="surface-panel divide-y divide-border overflow-hidden">
          {STUB_INVOICES.map((inv) => (
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
                <Badge variant="success">{inv.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toast.info('Invoice PDF download (stub)')}
                >
                  PDF
                </Button>
              </div>
            </li>
          ))}
        </ul>
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
              disabled={currentPlan === plan.id}
              onClick={() => checkout(plan.name)}
            >
              {currentPlan === plan.id ? 'Current plan' : `Upgrade to ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
