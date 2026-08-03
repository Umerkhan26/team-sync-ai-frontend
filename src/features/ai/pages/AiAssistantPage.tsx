import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bookmark, BookmarkPlus, ExternalLink, Sparkles, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { aiApi } from '@/services/fileApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage } from '@/utils/cn'
import { useStreamingText } from '@/hooks/useStreamingText'
import {
  STUB_CITATIONS,
  deductAiCredit,
  deleteSavedPrompt,
  getAiCredits,
  listSavedPrompts,
  savePrompt,
  type SavedPrompt,
} from '@/utils/aiStorage'

const promptSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(20000),
})

type PromptForm = z.infer<typeof promptSchema>

function resultText(result: unknown): string {
  if (!result) return ''
  if (typeof result === 'string') return result
  if (typeof result === 'object') {
    const r = result as { text?: string; content?: string }
    if (r.text) return r.text
    if (r.content) return r.content
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

function CreditMeter({ credits, max = 100 }: { credits: number; max?: number }) {
  const pct = Math.round((credits / max) * 100)
  const low = credits <= 10
  return (
    <div className="surface-panel space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI credits {credits} / {max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${low ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {low ? (
        <p className="text-[11px] text-warning">Running low — upgrade for more quota.</p>
      ) : null}
    </div>
  )
}

export function AiAssistantPage() {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const { can } = usePermissions()
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [credits, setCredits] = useState(() => (orgId ? getAiCredits(orgId) : 42))
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() =>
    orgId ? listSavedPrompts(orgId) : [],
  )
  const [activeFeature, setActiveFeature] = useState('task-description')
  const displayedOutput = useStreamingText(output, streaming)

  useEffect(() => {
    if (!orgId) return
    setCredits(getAiCredits(orgId))
    setSavedPrompts(listSavedPrompts(orgId))
  }, [orgId])

  useEffect(() => {
    if (streaming && displayedOutput === output && output) {
      setStreaming(false)
    }
  }, [streaming, displayedOutput, output])

  const taskForm = useForm<PromptForm>({
    resolver: zodResolver(promptSchema),
    defaultValues: { prompt: '' },
  })
  const summaryForm = useForm<PromptForm>({
    resolver: zodResolver(promptSchema),
    defaultValues: { prompt: '' },
  })
  const sprintForm = useForm<PromptForm>({
    resolver: zodResolver(promptSchema),
    defaultValues: { prompt: '' },
  })

  const onAiSuccess = (data: { result: unknown }, prompt: string, feature: string) => {
    const text = resultText(data.result)
    setOutput(text)
    setStreaming(true)
    if (orgId) {
      setCredits(deductAiCredit(orgId))
      setSavedPrompts(savePrompt(orgId, prompt, feature))
    }
    toast.success('AI response ready')
  }

  const generate = useMutation({
    mutationFn: (input: {
      prompt: string
      systemInstruction: string
      feature: string
    }) => aiApi.generate(input),
    onSuccess: (data, variables) => onAiSuccess(data, variables.prompt, variables.feature),
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  const suggest = useMutation({
    mutationFn: () => aiApi.suggestActions(),
    onSuccess: (data) => {
      const text = resultText(data.result)
      setOutput(text)
      setStreaming(true)
      if (orgId) setCredits(deductAiCredit(orgId))
      toast.success('Suggestions ready')
    },
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  const loadPrompt = (prompt: SavedPrompt) => {
    setActiveFeature(prompt.feature)
    if (prompt.feature.includes('summarize')) {
      summaryForm.setValue('prompt', prompt.text)
    } else if (prompt.feature.includes('sprint')) {
      sprintForm.setValue('prompt', prompt.text)
    } else {
      taskForm.setValue('prompt', prompt.text)
    }
  }

  const removePrompt = (id: string) => {
    if (!orgId) return
    setSavedPrompts(deleteSavedPrompt(orgId, id))
    toast.success('Prompt removed')
  }

  if (!can('ai:use')) {
    return (
      <EmptyState
        title="No AI access"
        description="Your role cannot use the AI assistant in this workspace."
      />
    )
  }

  if (!orgId) {
    return <EmptyState title="Select an organization" />
  }

  const isPending = generate.isPending || suggest.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
      <div className="space-y-4">
        <PageHeader
          eyebrow="Intelligence"
          title="AI Assistant"
          description="Draft task copy, summarize threads, and sketch sprint plans. Credits and citations are demo meters until billing/RAG ship."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => suggest.mutate()}
              disabled={isPending || credits === 0}
            >
              {suggest.isPending ? 'Thinking…' : 'Suggest next actions'}
            </Button>
          }
        />

        <CreditMeter credits={credits} />

        {savedPrompts.length > 0 ? (
          <div className="surface-panel space-y-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bookmark className="h-3.5 w-3.5" />
              Saved prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {savedPrompts.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="group inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-left text-xs transition hover:border-primary/40 hover:bg-accent"
                  onClick={() => loadPrompt(p)}
                  title={p.text}
                >
                  <span className="truncate">{p.text.slice(0, 40)}{p.text.length > 40 ? '…' : ''}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      removePrompt(p.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        removePrompt(p.id)
                      }
                    }}
                    aria-label="Remove prompt"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="surface-panel p-4">
          <Tabs
            defaultValue="task"
            onValueChange={(v) => {
              if (v === 'summary') setActiveFeature('summarize')
              else if (v === 'sprint') setActiveFeature('sprint-plan')
              else setActiveFeature('task-description')
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="task">Task description</TabsTrigger>
              <TabsTrigger value="summary">Summarize</TabsTrigger>
              <TabsTrigger value="sprint">Sprint plan</TabsTrigger>
            </TabsList>

            <TabsContent value="task">
              <form
                className="space-y-4"
                onSubmit={taskForm.handleSubmit((values) =>
                  generate.mutate({
                    prompt: values.prompt,
                    feature: 'task-description',
                    systemInstruction:
                      'You are a product engineer. Expand the brief into a clear task description with acceptance criteria and technical notes.',
                  }),
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="task-prompt">Brief</Label>
                  <Textarea
                    id="task-prompt"
                    rows={5}
                    placeholder="Add OAuth login for Google…"
                    {...taskForm.register('prompt')}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isPending || credits === 0}>
                    {generate.isPending ? 'Generating…' : 'Generate description'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!taskForm.watch('prompt')?.trim()}
                    onClick={() => {
                      const text = taskForm.getValues('prompt')
                      if (text.trim()) {
                        setSavedPrompts(savePrompt(orgId, text, activeFeature))
                        toast.success('Prompt saved')
                      }
                    }}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save prompt
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="summary">
              <form
                className="space-y-4"
                onSubmit={summaryForm.handleSubmit((values) =>
                  generate.mutate({
                    prompt: values.prompt,
                    feature: 'summarize',
                    systemInstruction:
                      'Summarize the following team content into concise bullets with risks and decisions.',
                  }),
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="summary-prompt">Content to summarize</Label>
                  <Textarea id="summary-prompt" rows={8} {...summaryForm.register('prompt')} />
                </div>
                <Button type="submit" disabled={isPending || credits === 0}>
                  {generate.isPending ? 'Summarizing…' : 'Summarize'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sprint">
              <form
                className="space-y-4"
                onSubmit={sprintForm.handleSubmit((values) =>
                  generate.mutate({
                    prompt: values.prompt,
                    feature: 'sprint-plan',
                    systemInstruction:
                      'Create a realistic 1-2 week sprint plan with goals, backlog items, owners placeholders, and risks.',
                  }),
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="sprint-prompt">Goals and constraints</Label>
                  <Textarea
                    id="sprint-prompt"
                    rows={6}
                    placeholder="Ship billing MVP, 3 engineers, one designer…"
                    {...sprintForm.register('prompt')}
                  />
                </div>
                <Button type="submit" disabled={isPending || credits === 0}>
                  {generate.isPending ? 'Planning…' : 'Generate sprint plan'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <section className="ts-module-rail space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="app-title text-base">Output</h2>
          {output ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void navigator.clipboard.writeText(output)}
            >
              Copy
            </Button>
          ) : null}
        </div>
        {output || isPending ? (
          <div className="space-y-3">
            <div className="surface-panel relative min-h-[320px] overflow-hidden p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10"
              />
              <div className="ts-prose-output relative text-foreground/90">
                {isPending && !displayedOutput ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="animate-pulse">Generating</span>
                    <span className="animate-bounce">…</span>
                  </span>
                ) : (
                  <>
                    {displayedOutput}
                    {streaming && displayedOutput.length < output.length ? (
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {output && !streaming ? (
              <div className="surface-panel space-y-2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sources
                </p>
                <ul className="space-y-1.5">
                  {STUB_CITATIONS.map((cite) => (
                    <li key={cite.title}>
                      <a
                        href={cite.href}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                        onClick={(e) => e.preventDefault()}
                      >
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{cite.title}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {cite.source}
                        </Badge>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Citations are stubbed — will link to workspace docs and chat when RAG is enabled.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No output yet"
            description="Run one of the AI forms — results appear here with a streaming feel."
            className="min-h-[320px] py-10"
          />
        )}
      </section>
    </div>
  )
}
