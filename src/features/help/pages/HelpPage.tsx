import { useMemo, useState } from 'react'
import { Activity, LifeBuoy, Mail, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface FaqEntry {
  question: string
  answer: string
  category: string
}

const FAQS: FaqEntry[] = [
  {
    category: 'Getting started',
    question: 'How do I create a new project?',
    answer:
      'Go to Projects → New project, give it a name and optional key, then invite teammates as members. You can start adding tasks right away.',
  },
  {
    category: 'Getting started',
    question: 'How do I invite teammates to my workspace?',
    answer:
      'Open Admin → Members and use the invite form (or Bulk invite for CSV). Invitees get a secure link and set their own password — no passwords are ever emailed.',
  },
  {
    category: 'Tasks',
    question: 'How do I change a task\u2019s due date or assignee?',
    answer:
      'Click any task to open its detail drawer, or edit it inline from the Board, List, or Calendar view on the Tasks page.',
  },
  {
    category: 'Tasks',
    question: 'What do the relative due labels mean?',
    answer:
      'Tasks show friendly labels like "Today", "Tomorrow", or "Overdue" based on their due date so you can prioritize at a glance.',
  },
  {
    category: 'Files',
    question: 'What file types can I upload?',
    answer:
      'Any file type is supported. Images and PDFs get an inline preview; other files open a secure download link.',
  },
  {
    category: 'Roles & permissions',
    question: 'What is the difference between system and custom roles?',
    answer:
      'System roles (Owner, Admin, Manager, Member, Guest) ship with fixed permissions and can\u2019t be edited or deleted. Custom roles are created by Admins and can be fully customized or removed.',
  },
  {
    category: 'Roles & permissions',
    question: 'Can I revoke a pending invitation?',
    answer:
      'Yes — open Admin → Members → Invitations and use Revoke next to any pending invite. Revoked links stop working immediately.',
  },
  {
    category: 'AI',
    question: 'What can the AI assistant help with?',
    answer:
      'Ask it to summarize meetings, draft task descriptions, suggest next actions, or answer questions about your workspace data.',
  },
  {
    category: 'Billing',
    question: 'Is there a paid plan?',
    answer:
      'Pro and Enterprise plans are available under Billing. Stripe checkout is stubbed during early access.',
  },
]

const CHANGELOG = [
  {
    version: '0.9.0',
    date: '2026-07-28',
    items: ['AI assistant with saved prompts and credit meter', 'Admin SSO wizard stub', 'Billing seat management'],
  },
  {
    version: '0.8.2',
    date: '2026-07-15',
    items: ['Custom roles and audit log', 'Bulk invite from CSV', 'Command palette search'],
  },
  {
    version: '0.8.0',
    date: '2026-07-01',
    items: ['Real-time chat and presence', 'Document editor with Tiptap', 'Project templates'],
  },
] as const

const STATUS_SERVICES = [
  { name: 'API', status: 'operational' as const },
  { name: 'Web app', status: 'operational' as const },
  { name: 'Real-time (WebSocket)', status: 'operational' as const },
  { name: 'File uploads', status: 'operational' as const },
  { name: 'AI generation', status: 'operational' as const },
  { name: 'Email delivery', status: 'operational' as const },
] as const

const SUPPORT_EMAIL = 'support@teamsync.ai'

export function HelpPage() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQS
    return FAQS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    )
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, FaqEntry[]>()
    for (const faq of filtered) {
      if (!map.has(faq.category)) map.set(faq.category, [])
      map.get(faq.category)!.push(faq)
    }
    return Array.from(map.entries())
  }, [filtered])

  const allOperational = STATUS_SERVICES.every((s) => s.status === 'operational')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Help & support"
        description="Search frequently asked questions, check system status, or reach out to our team."
        actions={
          <Button asChild size="sm">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('TeamSync AI support request')}`}>
              <Mail className="h-4 w-4" />
              Contact support
            </a>
          </Button>
        }
      />

      <div className="surface-panel flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${allOperational ? 'bg-success' : 'bg-warning'} animate-pulse`}
          />
          <p className="text-sm font-medium">
            {allOperational ? 'All systems operational' : 'Partial outage detected'}
          </p>
        </div>
        <Activity className="h-4 w-4 text-muted-foreground" />
        <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
          {STATUS_SERVICES.map((svc) => (
            <li key={svc.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {svc.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          className="pl-9"
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="h-5 w-5" />}
          title="No answers found"
          description="Try a different search term, or contact support directly."
          actionLabel="Contact support"
          onAction={() => {
            window.location.href = `mailto:${SUPPORT_EMAIL}`
          }}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, faqs]) => (
            <section key={category}>
              <h2 className="app-title mb-2 flex items-center gap-2 text-sm">
                {category}
                <Badge variant="secondary" className="text-[10px]">
                  {faqs.length}
                </Badge>
              </h2>
              <div className="surface-panel divide-y divide-border overflow-hidden">
                {faqs.map((faq) => (
                  <details key={faq.question} className="group px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                      <span className="flex items-center justify-between gap-3">
                        {faq.question}
                        <span className="shrink-0 text-muted-foreground transition group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="app-title text-sm">Changelog</h2>
        <div className="surface-panel divide-y divide-border overflow-hidden">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  v{entry.version}
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="surface-panel flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Still need help?</p>
          <p className="text-xs text-muted-foreground">
            Email {SUPPORT_EMAIL} and we&apos;ll get back to you within one business day.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail className="h-3.5 w-3.5" />
            Email us
          </a>
        </Button>
      </div>
    </div>
  )
}
