import { Link } from 'react-router-dom'
import {
  FileText,
  FolderKanban,
  MessageSquare,
  Sparkles,
  ListTodo,
} from 'lucide-react'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { Button } from '@/components/ui/button'

const pillars = [
  {
    title: 'Plan',
    body: 'Projects, tasks, and Kanban that keep delivery visible without ceremony.',
    icon: FolderKanban,
  },
  {
    title: 'Sync',
    body: 'Chat and docs live beside the work so context never leaves the workspace.',
    icon: MessageSquare,
  },
  {
    title: 'Accelerate',
    body: 'AI drafts descriptions, summaries, and sprint plans when you need speed.',
    icon: Sparkles,
  },
]

const previewModules = [
  { label: 'Projects', icon: FolderKanban },
  { label: 'Tasks', icon: ListTodo },
  { label: 'Chat', icon: MessageSquare },
  { label: 'Docs', icon: FileText },
]

export function LandingPage() {
  useSurfaceMode('marketing')

  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_10%_-10%,hsl(186_70%_78%/0.45),transparent_55%),radial-gradient(ellipse_70%_50%_at_95%_5%,hsl(210_55%_78%/0.32),transparent_50%)]"
        />
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              AI-native workspace for modern teams
            </div>
            <div className="mt-6 flex items-center gap-3">
              <img
                src="/brand/logo-mark.png"
                alt="TeamSync AI logo"
                className="h-12 w-12 rounded-xl shadow-md sm:h-14 sm:w-14"
              />
              <p className="brand-mark text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                TeamSync AI
              </p>
            </div>
            <h1 className="mt-5 max-w-xl font-display text-3xl font-medium leading-[1.15] text-foreground/90 sm:text-4xl">
              One workspace for teams that ship.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Register your company, invite your org, and run projects, chat, docs, and AI in one
              multi-tenant workspace—with clear roles from Owner to Guest.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">Create company</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Journey: register → verify → company setup → invite team → first project.
            </p>
          </div>

          <div className="relative hidden min-h-[420px] lg:block">
            <div
              aria-hidden
              className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-br from-primary/20 via-brand-secondary/10 to-transparent blur-2xl"
            />
            <div className="relative overflow-hidden rounded-[1.25rem] border border-border/70 bg-[hsl(215_36%_8%)] text-[hsl(210_20%_94%)] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-[11px] text-white/50">TeamSync Demo</span>
              </div>
              <div className="grid grid-cols-[140px_1fr]">
                <aside className="border-r border-white/10 p-3">
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Workspace
                  </p>
                  <ul className="space-y-1">
                    {previewModules.map((item, i) => (
                      <li
                        key={item.label}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                          i === 0 ? 'bg-white/10 text-white' : 'text-white/55'
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </aside>
                <div className="space-y-3 p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Home</p>
                      <p className="text-sm font-semibold">Good morning, team</p>
                    </div>
                    <span className="rounded-md bg-[hsl(204_68%_46%)] px-2.5 py-1 text-[11px] font-medium text-white">
                      + Create
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['My open', 'Due today', 'Projects'].map((label, i) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                        <p className="text-[10px] text-white/45">{label}</p>
                        <p className="mt-1 text-lg font-semibold">{[3, 1, 2][i]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] font-medium text-white/70">Work needing attention</p>
                    <div className="mt-2 space-y-2">
                      {['Ship landing polish', 'Review onboarding PR', 'Schedule kickoff'].map(
                        (t) => (
                          <div
                            key={t}
                            className="flex items-center justify-between rounded-md bg-black/20 px-2.5 py-2 text-[11px]"
                          >
                            <span className="text-white/80">{t}</span>
                            <span className="text-white/35">Todo</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map((item, index) => (
            <div
              key={item.title}
              className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition group-hover:scale-125"
              />
              <span className="relative mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="relative text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                0{index + 1}
              </p>
              <h2 className="relative mt-1 font-display text-2xl font-medium text-foreground">
                {item.title}
              </h2>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
