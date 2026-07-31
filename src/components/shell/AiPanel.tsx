import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
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
import { useAppDispatch, useAppSelector } from '@/store'
import { setAiPanelOpen } from '@/store/uiSlice'
import { aiApi } from '@/services/fileApi'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage } from '@/utils/cn'

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
  const dispatch = useAppDispatch()
  const { can } = usePermissions()
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')

  const generate = useMutation({
    mutationFn: (input: {
      prompt: string
      systemInstruction: string
      feature: string
    }) => aiApi.generate(input),
    onSuccess: (data) => {
      setOutput(resultText(data.result))
      toast.success('AI ready')
    },
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  if (!can('ai:use')) return null

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
              <Button
                className="w-full"
                loading={generate.isPending}
                onClick={() =>
                  generate.mutate({
                    prompt,
                    feature: 'task_description',
                    systemInstruction:
                      'Write a clear task description with acceptance criteria and checklist.',
                  })
                }
              >
                Generate description
              </Button>
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
                onClick={() =>
                  generate.mutate({
                    prompt,
                    feature: 'summarize',
                    systemInstruction:
                      'Summarize into bullet points with decisions and open questions.',
                  })
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
                onClick={() =>
                  generate.mutate({
                    prompt,
                    feature: 'sprint_plan',
                    systemInstruction:
                      'Produce a 1–2 week sprint plan with prioritized tasks and risks.',
                  })
                }
              >
                Generate sprint plan
              </Button>
            </TabsContent>
          </Tabs>

          {output ? (
            <div className="surface-panel max-h-[40vh] overflow-y-auto p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Output
              </p>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed">{output}</pre>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
