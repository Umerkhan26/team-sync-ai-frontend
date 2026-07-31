import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { Button } from '@/components/ui/button'

const pillars = [
  {
    title: 'Plan',
    body: 'Projects, tasks, and Kanban that keep delivery visible without ceremony.',
  },
  {
    title: 'Sync',
    body: 'Chat and docs live beside the work so context never leaves the workspace.',
  },
  {
    title: 'Accelerate',
    body: 'AI drafts descriptions, summaries, and sprint plans on Gemini free tier.',
  },
]

export function LandingPage() {
  useSurfaceMode('marketing')

  return (
    <div>
      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center px-4 pb-20 pt-6 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[72vh] bg-[radial-gradient(ellipse_at_top,hsl(186_70%_78%/0.5),transparent_55%),radial-gradient(ellipse_at_85%_15%,hsl(210_60%_80%/0.35),transparent_45%)]"
        />
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          AI-native workspace for modern teams
        </div>
        <div className="mt-6 flex items-center gap-3">
          <img
            src="/brand/logo-mark.png"
            alt="TeamSync AI logo"
            className="h-12 w-12 rounded-xl shadow-sm sm:h-14 sm:w-14"
          />
          <p className="brand-mark text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            TeamSync AI
          </p>
        </div>
        <h1 className="mt-5 max-w-2xl font-display text-3xl font-medium leading-tight text-foreground/90 sm:text-4xl">
          One workspace for teams that ship.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Register your company, invite your org, and run projects, chat, docs, and AI in one
          multi-tenant workspace—with Owner, Admin, Manager, and Member experiences.
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
          Journey: register admin → verify email → company setup → invite team → first project.
        </p>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map((item, index) => (
            <div
              key={item.title}
              className="relative rounded-xl border border-border/60 bg-card/60 p-5 transition-colors hover:border-primary/30"
            >
              <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h2 className="font-display text-2xl font-medium text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
