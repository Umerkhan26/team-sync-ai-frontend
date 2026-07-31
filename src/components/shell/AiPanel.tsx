import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookmarkPlus, ExternalLink, Sparkles } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useAppDispatch, useAppSelector } from '@/store'
import { setAiPanelOpen } from '@/store/uiSlice'
import { aiApi } from '@/services/fileApi'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage } from '@/utils/cn'
import { useStreamingText } from '@/hooks/useStreamingText'
import {
  STUB_CITATIONS,
  deductAiCredit,
  getAiCredits,
  savePrompt,
} from '@/utils/aiStorage'

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

export function AiPanel() {
  const open = useAppSelector((s) => s.ui.aiPanelOpen)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const { can } = usePermissions()
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [feature, setFeature] = useState('task_description')
  const [credits, setCredits] = useState(() => (orgId ? getAiCredits(orgId) : 100))
  const displayedOutput = useStreamingText(output, streaming)

  useEffect(() => {
    if (orgId) setCredits(getAiCredits(orgId))
  }, [orgId, open])

  useEffect(() => {
    if (streaming && displayedOutput === output && output) setStreaming(false)
  }, [streaming, displayedOutput, output])

  const generate = useMutation({
    mutationFn: (input: {
      prompt: string
      systemInstruction: string
      feature: string
    }) => aiApi.generate(input),
    onSuccess: (data, variables) => {
      setOutput(resultText(data.result))
      setStreaming(true)
      if (orgId) {
        setCredits(deductAiCredit(orgId))
        savePrompt(orgId, variables.prompt, variables.feature)
      }
      toast.success('AI ready')
    },
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  if (!can('ai:use')) return null

  const runGenerate = (systemInstruction: string, feat: string) => {
    setFeature(feat)
    generate.mutate({ prompt, feature: feat, systemInstruction })
  }

  const creditPct = Math.round((credits / 100) * 100)

  return (
    <Sheet open={open} onOpenChange={(v) => dispatch(setAiPanelOpen(v))}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Assistant
          </SheetTitle>
          <SheetDescription>
            Draft tasks, summarize context, or sketch a sprint — without leaving your flow.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Credits</span>
              <span className="tabular-nums text-muted-foreground">{credits} / 100</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${creditPct}%` }}
              />
            </div>
          </div>

          <Tabs defaultValue="task">
            <TabsList className="w-full">
              <TabsTrigger value="task" className="flex-1">
                Task
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex-1">
                Summarize
              </TabsTrigger>
              <TabsTrigger value="sprint" className="flex-1">
                Sprint
              </TabsTrigger>
            </TabsList>

            <TabsContent value="task" className="space-y-3">
              <Label htmlFor="ai-prompt">Describe the work</Label>
              <Textarea
                id="ai-prompt"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Onboarding checklist for new engineers…"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  loading={generate.isPending}
                  disabled={credits === 0}
                  onClick={() =>
                    runGenerate(
                      'Write a clear task description with acceptance criteria and checklist.',
                      'task_description',
                    )
                  }
                >
                  Generate description
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!prompt.trim()}
                  title="Save prompt"
                  onClick={() => {
                    if (orgId && prompt.trim()) {
                      savePrompt(orgId, prompt, feature)
                      toast.success('Prompt saved')
                    }
                  }}
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-3">
              <Label htmlFor="ai-summary">Paste text to summarize</Label>
              <Textarea
                id="ai-summary"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste a long thread, notes, or doc…"
              />
              <Button
                className="w-full"
                loading={generate.isPending}
                disabled={credits === 0}
                onClick={() =>
                  runGenerate(
                    'Summarize into bullet points with decisions and open questions.',
                    'summarize',
                  )
                }
              >
                Summarize
              </Button>
            </TabsContent>

            <TabsContent value="sprint" className="space-y-3">
              <Label htmlFor="ai-sprint">Sprint goals</Label>
              <Textarea
                id="ai-sprint"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Goals, constraints, capacity…"
              />
              <Button
                className="w-full"
                loading={generate.isPending}
                disabled={credits === 0}
                onClick={() =>
                  runGenerate(
                    'Produce a 1–2 week sprint plan with prioritized tasks and risks.',
                    'sprint_plan',
                  )
                }
              >
                Generate sprint plan
              </Button>
            </TabsContent>
          </Tabs>

          {output || generate.isPending ? (
            <div className="space-y-2">
              <div className="surface-panel max-h-[40vh] overflow-y-auto p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Output
                </p>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                  {generate.isPending && !displayedOutput ? (
                    <span className="animate-pulse text-muted-foreground">Thinking…</span>
                  ) : (
                    <>
                      {displayedOutput}
                      {streaming && displayedOutput.length < output.length ? (
                        <span className="inline-block h-3 w-0.5 animate-pulse bg-primary" />
                      ) : null}
                    </>
                  )}
                </pre>
              </div>
              {output && !streaming ? (
                <div className="rounded-md border border-border p-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </p>
                  <ul className="space-y-1">
                    {STUB_CITATIONS.slice(0, 2).map((cite) => (
                      <li key={cite.title} className="flex items-center gap-1.5 text-[11px]">
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="truncate">{cite.title}</span>
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                          {cite.source}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
