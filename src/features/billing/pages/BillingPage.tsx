import { Link } from 'react-router-dom'
import { Check, CreditCard, Sparkles, Zap } from 'lucide-react'
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

export function BillingPage() {
  const org = useAppSelector((s) => s.org.activeOrganization)
  const { can, isOwner } = usePermissions()
  const currentPlan = (org?.plan || 'free').toLowerCase()

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description={`${org?.name || 'Workspace'} · current plan: ${currentPlan}. Stripe checkout is stubbed for now.`}
      />

      <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Current plan</p>
          <p className="text-xs text-muted-foreground">
            Seats and invoices will appear here after Stripe is connected.
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {currentPlan}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'surface-panel relative flex flex-col p-5',
              plan.highlight && 'border-primary/40 shadow-md',
              currentPlan === plan.id && 'ring-1 ring-primary/50',
            )}
          >
            {plan.highlight ? (
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
              onClick={() => {
                window.alert(
                  'Billing is a stub for now. Stripe checkout will plug in here later.',
                )
              }}
            >
              {currentPlan === plan.id ? 'Current plan' : `Upgrade to ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
