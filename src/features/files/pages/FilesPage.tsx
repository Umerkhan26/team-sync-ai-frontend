import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bookmark,
  Download,
  FileIcon,
  Grid3x3,
  List as ListIcon,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fileApi } from '@/services/fileApi'
import { projectApi } from '@/services/projectApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, getErrorMessage } from '@/utils/cn'
import {
  deleteSavedView,
  listSavedViews,
  saveSavedView,
  type SavedView,
} from '@/utils/savedViews'
import type { FileAsset } from '@/types'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPreviewable(mimeType: string) {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export function FilesPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const { can } = usePermissions()
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [projectFilter, setProjectFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const dragCounter = useRef(0)

  useEffect(() => {
    if (!orgId) return
    setSavedViews(listSavedViews(orgId, 'files'))
  }, [orgId])

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId, 'files-filter'],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId),
  })

  const filesQuery = useQuery({
    queryKey: ['files', orgId, projectFilter],
    queryFn: () =>
      fileApi.list({
        limit: 100,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
      }),
    enabled: Boolean(orgId) && can('files:read'),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      fileApi.upload(file, { onProgress: (percent) => setUploadProgress(percent) }),
    onSuccess: () => {
      toast.success('File uploaded')
      void queryClient.invalidateQueries({ queryKey: ['files', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Upload failed')),
    onSettled: () => setUploadProgress(null),
  })

  const removeMutation = useMutation({
    mutationFn: (fileId: string) => fileApi.remove(fileId),
    onSuccess: () => {
      toast.success('File deleted')
      setRemoveId(null)
      void queryClient.invalidateQueries({ queryKey: ['files', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Delete failed')),
  })

  const uploadFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    for (const file of Array.from(fileList)) {
      uploadMutation.mutate(file)
    }
  }

  if (!orgId) {
    return <EmptyState title="Select a workspace" />
  }

  if (!can('files:read')) {
    return (
      <EmptyState
        title="No file access"
        description="Your role cannot view workspace files."
      />
    )
  }

  const files = useMemo(() => {
    let list = filesQuery.data?.data.items ?? []
    if (typeFilter === 'images') list = list.filter((f) => f.mimeType.startsWith('image/'))
    if (typeFilter === 'pdf') list = list.filter((f) => f.mimeType === 'application/pdf')
    if (typeFilter === 'other') {
      list = list.filter((f) => !f.mimeType.startsWith('image/') && f.mimeType !== 'application/pdf')
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((f) => f.fileName.toLowerCase().includes(q))
    }
    return list
  }, [filesQuery.data, typeFilter, search])
  const canUpload = can('files:upload')
  const projects = projectsQuery.data?.data.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Upload assets to Cloudinary and keep them linked to this workspace."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              <Button
                type="button"
                variant={view === 'grid' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('grid')}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('list')}
                aria-label="List view"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
            {canUpload ? (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    uploadFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <Button
                  size="sm"
                  disabled={uploadMutation.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadMutation.isPending
                    ? uploadProgress !== null
                      ? `Uploading… ${uploadProgress}%`
                      : 'Uploading…'
                    : 'Upload'}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…"
          className="h-8 max-w-xs"
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="images">Images</SelectItem>
            <SelectItem value="pdf">PDFs</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {orgId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                const name = window.prompt('Name this view')
                if (!name?.trim()) return
                setSavedViews(
                  saveSavedView(orgId, 'files', name, {
                    projectId: projectFilter,
                    type: typeFilter,
                    search,
                  }),
                )
                toast.success('View saved')
              }}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save view
            </Button>
            {savedViews.map((saved) => (
              <Button
                key={saved.id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                title="Right-click to delete"
                onClick={() => {
                  setProjectFilter(saved.filters.projectId || 'all')
                  setTypeFilter(saved.filters.type || 'all')
                  setSearch(saved.filters.search || '')
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (!window.confirm(`Delete saved view “${saved.name}”?`)) return
                  setSavedViews(deleteSavedView(orgId, 'files', saved.id))
                }}
              >
                {saved.name}
              </Button>
            ))}
          </>
        ) : null}
      </div>

      {canUpload ? (
        <div
          className={cn(
            'group relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-all duration-150',
            isDragging
              ? 'scale-[1.005] border-primary bg-primary/5 shadow-sm'
              : 'hover:border-primary/40 hover:bg-muted/30',
          )}
          onDragEnter={(e) => {
            e.preventDefault()
            dragCounter.current += 1
            setIsDragging(true)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault()
            dragCounter.current -= 1
            if (dragCounter.current <= 0) {
              dragCounter.current = 0
              setIsDragging(false)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            dragCounter.current = 0
            setIsDragging(false)
            uploadFiles(e.dataTransfer.files)
          }}
        >
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-transform duration-150',
              isDragging && 'scale-110',
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragging ? 'Drop to upload' : 'Drag and drop files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or{' '}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
              onClick={() => inputRef.current?.click()}
            >
              browse
            </button>{' '}
            from your computer
          </p>
          {uploadMutation.isPending ? (
            <p className="text-xs font-medium text-primary">
              {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Uploading…'}
            </p>
          ) : null}
        </div>
      ) : null}

      {filesQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : filesQuery.isError ? (
        <ErrorState onRetry={() => void filesQuery.refetch()} />
      ) : files.length === 0 ? (
        <EmptyState
          title="No files yet"
          description={
            canUpload
              ? 'Upload images or documents. Files are stored on Cloudinary free tier.'
              : 'Uploaded workspace files will appear here.'
          }
          actionLabel={canUpload ? 'Upload file' : undefined}
          onAction={canUpload ? () => inputRef.current?.click() : undefined}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((file) => (
            <div
              key={file.id}
              className="surface-panel group relative overflow-hidden shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <button
                type="button"
                className="flex aspect-square w-full items-center justify-center bg-muted/60"
                onClick={() => (isPreviewable(file.mimeType) ? setPreviewFile(file) : window.open(file.secureUrl || file.url, '_blank'))}
              >
                {file.mimeType.startsWith('image/') ? (
                  <img
                    src={file.secureUrl || file.url}
                    alt={file.fileName}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <FileIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </button>
              <div className="space-y-1 p-2.5">
                <p className="truncate text-xs font-medium" title={file.fileName}>
                  {file.fileName}
                </p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(file.bytes)}</p>
              </div>
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="secondary" size="icon-sm" className="h-7 w-7" asChild>
                  <a href={file.secureUrl || file.url} target="_blank" rel="noreferrer" download>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {can('files:delete') ? (
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setRemoveId(file.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="surface-panel divide-y divide-border overflow-hidden">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => (isPreviewable(file.mimeType) ? setPreviewFile(file) : window.open(file.secureUrl || file.url, '_blank'))}
              >
                <span className="rounded-md bg-muted p-2 text-muted-foreground">
                  <FileIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary hover:underline">
                    {file.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(file.bytes)} · {formatDate(file.createdAt)}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{file.mimeType.split('/')[0]}</Badge>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={file.secureUrl || file.url} target="_blank" rel="noreferrer" download>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {can('files:delete') ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => setRemoveId(file.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{previewFile?.fileName}</DialogTitle>
          </DialogHeader>
          {previewFile ? (
            <div className="max-h-[70vh] overflow-auto rounded-md bg-muted/40">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={previewFile.secureUrl || previewFile.url}
                  alt={previewFile.fileName}
                  className="mx-auto max-h-[70vh] object-contain"
                />
              ) : (
                <iframe
                  src={previewFile.secureUrl || previewFile.url}
                  title={previewFile.fileName}
                  className="h-[70vh] w-full border-0"
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="Delete file?"
        description="This removes the file from the workspace list permanently."
        confirmLabel="Delete"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />
    </div>
  )
}
