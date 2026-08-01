import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For small teams getting started with one workspace.',
    features: [
      'Up to 10 members',
      'Projects, tasks & chat',
      '5 GB file storage',
      'Basic AI assistant',
    ],
    cta: 'Get started',
    href: '/register',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: 'per member / month',
    description: 'For growing teams that need AI and advanced collaboration.',
    features: [
      'Unlimited members',
      'Advanced AI workflows',
      'Meeting summaries & templates',
      'Integrations hub',
      'Priority support',
    ],
    cta: 'Start Pro trial',
    href: '/register',
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$24',
    period: 'per member / month',
    description: 'For organizations with security, audit, and scale requirements.',
    features: [
      'Everything in Pro',
      'SSO & advanced roles',
      'Audit logs & compliance',
      'Dedicated success manager',
      'Custom integrations',
    ],
    cta: 'Contact sales',
    href: '/register',
    highlighted: false,
  },
]

export function PricingPage() {
  useSurfaceMode('marketing')

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground sm:text-4xl">
          Simple plans that scale with your team
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start free, upgrade when you need AI depth, integrations, and enterprise controls.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              'relative flex flex-col rounded-xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
              tier.highlighted
                ? 'border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20'
                : 'border-border bg-card',
            )}
          >
            {tier.highlighted ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
                Most popular
              </span>
            ) : null}
            <div>
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.period}</span>
              </div>
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className="mt-8 w-full"
              variant={tier.highlighted ? 'default' : 'outline'}
              asChild
            >
              <Link to={tier.href}>{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        All plans include email verification, org onboarding, and role-based access.{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>{' '}
        to manage billing for your workspace.
      </p>
    </div>
  )
}
