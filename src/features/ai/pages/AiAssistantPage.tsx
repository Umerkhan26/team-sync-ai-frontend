import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { aiApi } from '@/services/fileApi'
import { useAppSelector } from '@/store'
import { getErrorMessage } from '@/utils/cn'

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

export function AiAssistantPage() {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const [output, setOutput] = useState('')

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

  const generate = useMutation({
    mutationFn: (input: {
      prompt: string
      systemInstruction: string
      feature: string
    }) => aiApi.generate(input),
    onSuccess: (data) => {
      setOutput(resultText(data.result))
      toast.success('AI response ready')
    },
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  const suggest = useMutation({
    mutationFn: () => aiApi.suggestActions(),
    onSuccess: (data) => {
      setOutput(resultText(data.result))
      toast.success('Suggestions ready')
    },
    onError: (error) => toast.error(getErrorMessage(error, 'AI request failed')),
  })

  if (!orgId) {
    return <EmptyState title="Select an organization" />
  }

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Generate task descriptions, summaries, and sprint plans."
        actions={
          <Button
            variant="outline"
            onClick={() => suggest.mutate()}
            disabled={suggest.isPending}
          >
            {suggest.isPending ? 'Thinking…' : 'Suggest next actions'}
          </Button>
        }
      />

      <Tabs defaultValue="task">
        <TabsList>
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
            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? 'Generating…' : 'Generate description'}
            </Button>
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
              <Textarea
                id="summary-prompt"
                rows={8}
                {...summaryForm.register('prompt')}
              />
            </div>
            <Button type="submit" disabled={generate.isPending}>
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
            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? 'Planning…' : 'Generate sprint plan'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <section className="mt-8">
        <h2 className="app-title mb-2 text-base">Output</h2>
        {output ? (
          <pre className="surface-panel max-h-[480px] overflow-auto whitespace-pre-wrap p-4 text-sm">
            {output}
          </pre>
        ) : (
          <EmptyState
            title="No output yet"
            description="Run one of the AI forms to see results here."
            className="py-10"
          />
        )}
      </section>
    </div>
  )
}
