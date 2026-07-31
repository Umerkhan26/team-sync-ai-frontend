import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/react'
import { History, Plus, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState, PageLoading } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TiptapEditor } from '@/features/documents/components/TiptapEditor'
import { documentApi } from '@/services/documentApi'
import { useAppSelector } from '@/store'
import { formatDate, formatDateTime, getErrorMessage } from '@/utils/cn'
import type { User } from '@/types'

const createSchema = z.object({
  title: z.string().min(1).max(200),
})

type CreateForm = z.infer<typeof createSchema>

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['documents', orgId],
    queryFn: () => documentApi.list({ limit: 50 }),
    enabled: Boolean(orgId),
  })

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: '' },
  })

  useEffect(() => {
    if (searchParams.get('open') !== '1') return
    form.reset({ title: searchParams.get('title') || '' })
    setOpen(true)
    searchParams.delete('open')
    searchParams.delete('title')
    searchParams.delete('template')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createMutation = useMutation({
    mutationFn: (values: CreateForm) =>
      documentApi.create({
        title: values.title,
      }),
    onSuccess: async (result) => {
      toast.success('Document created')
      setOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      navigate(`/app/documents/${result.document.id}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documents = query.data?.data.items ?? []

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Lightweight docs for specs, notes, and plans."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New document
          </Button>
        }
      />

      {!orgId ? (
        <EmptyState title="Select an organization" />
      ) : query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents"
          description="Create a document to capture shared knowledge."
          actionLabel="Create document"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`/app/documents/${doc.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {doc.content?.slice(0, 120) || 'Empty document'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(doc.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create document</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register('title')} placeholder="Untitled document" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const AUTOSAVE_DELAY_MS = 900

export function DocumentEditorPage() {
  const { documentId = '' } = useParams()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const pendingContent = useRef<{ content: string; contentJson: JSONContent } | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useQuery({
    queryKey: ['documents', orgId, documentId],
    queryFn: () => documentApi.get(documentId),
    enabled: Boolean(orgId && documentId),
  })

  const versionsQuery = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: () => documentApi.listVersions(documentId),
    enabled: Boolean(documentId) && historyOpen,
  })

  useEffect(() => {
    if (query.data) setTitle(query.data.title)
  }, [query.data?.id])

  const saveMutation = useMutation({
    mutationFn: (values: { title?: string; content?: string; contentJson?: JSONContent }) =>
      documentApi.update(documentId, values),
    onMutate: () => setSaveState('saving'),
    onSuccess: async () => {
      setSaveState('saved')
      await queryClient.invalidateQueries({ queryKey: ['documents', orgId, documentId], refetchType: 'none' })
      await queryClient.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: (error) => {
      setSaveState('idle')
      toast.error(getErrorMessage(error, 'Autosave failed'))
    },
  })

  const scheduleSave = (values: { title?: string; content?: string; contentJson?: JSONContent }) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      saveMutation.mutate({
        title,
        ...(pendingContent.current || {}),
        ...values,
      })
    }, AUTOSAVE_DELAY_MS)
  }

  const deleteMutation = useMutation({
    mutationFn: () => documentApi.remove(documentId),
    onSuccess: async () => {
      toast.success('Document deleted')
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      navigate('/app/documents')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => documentApi.restoreVersion(documentId, versionId),
    onSuccess: async (result) => {
      toast.success('Version restored')
      setTitle(result.document.title)
      setReloadKey((k) => k + 1)
      await queryClient.invalidateQueries({ queryKey: ['documents', orgId, documentId] })
      await queryClient.invalidateQueries({ queryKey: ['document-versions', documentId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />
  }

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : '\u00A0'

  return (
    <div>
      <PageHeader
        title="Document"
        description={saveLabel}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/documents">Back</Link>
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen((v) => !v)}>
              <History className="h-4 w-4" />
              History
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Delete this document?')) deleteMutation.mutate()
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      <div className={historyOpen ? 'grid gap-6 lg:grid-cols-[1fr_280px]' : ''}>
        <div className="space-y-4">
          <Input
            className="app-title h-auto border-none bg-transparent px-0 text-2xl shadow-none focus-visible:ring-0"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              scheduleSave({ title: e.target.value })
            }}
            placeholder="Untitled document"
          />
          <TiptapEditor
            key={`${documentId}-${reloadKey}`}
            content={query.data.contentJson || query.data.content || ''}
            onUpdate={({ json, text }) => {
              pendingContent.current = { content: text, contentJson: json }
              scheduleSave({ content: text, contentJson: json })
            }}
          />
        </div>

        {historyOpen ? (
          <aside className="surface-panel h-fit p-4">
            <h3 className="mb-3 text-sm font-semibold">Version history</h3>
            {versionsQuery.isLoading ? (
              <LoadingState rows={3} />
            ) : (versionsQuery.data?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Versions are saved automatically as you edit.
              </p>
            ) : (
              <ul className="space-y-2">
                {versionsQuery.data!.map((version) => {
                  const author =
                    typeof version.createdBy === 'object' ? (version.createdBy as User) : null
                  return (
                    <li
                      key={version.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{version.title}</p>
                        <p className="text-muted-foreground">
                          {formatDateTime(version.createdAt)}
                          {author ? ` · ${author.name}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate(version.id)}
                        aria-label="Restore version"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
