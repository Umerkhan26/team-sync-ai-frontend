import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bookmark,
  Download,
  FileIcon,
  Folder,
  Grid3x3,
  History,
  Link2,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fileApi } from '@/services/fileApi'
import { projectApi } from '@/services/projectApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, formatDateTime, getErrorMessage } from '@/utils/cn'
import type { SavedView } from '@/utils/savedViews'
import { savedViewApi } from '@/services/savedViewApi'
import type { FileAsset } from '@/types'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPreviewable(mimeType: string) {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

function fileFolderPath(fileName: string): string {
  const slash = fileName.indexOf('/')
  if (slash <= 0) return 'Root'
  return fileName.slice(0, slash)
}

function fileDisplayName(fileName: string): string {
  const slash = fileName.lastIndexOf('/')
  return slash >= 0 ? fileName.slice(slash + 1) : fileName
}

function copyFileShareUrl(file: FileAsset) {
  const url = file.secureUrl || file.url
  if (!url) {
    toast.error('No shareable URL for this file')
    return
  }
  void navigator.clipboard.writeText(url).then(
    () => toast.success('File link copied'),
    () => toast.error('Could not copy link'),
  )
}

const MIME_CHIPS = ['Images', 'PDFs', 'Docs'] as const
type FolderChip = 'all' | (typeof MIME_CHIPS)[number] | string

function matchesMimeChip(file: FileAsset, chip: string) {
  if (chip === 'Images') return file.mimeType.startsWith('image/')
  if (chip === 'PDFs') return file.mimeType === 'application/pdf'
  if (chip === 'Docs') {
    return (
      file.mimeType.startsWith('text/') ||
      file.mimeType.includes('document') ||
      file.mimeType.includes('msword') ||
      file.mimeType.includes('officedocument') ||
      file.mimeType === 'application/rtf'
    )
  }
  return true
}

export function FilesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const { can } = usePermissions()
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const [versionFile, setVersionFile] = useState<FileAsset | null>(null)
  const versionInputRef = useRef<HTMLInputElement>(null)
  const [groupByFolder, setGroupByFolder] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [projectFilter, setProjectFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [folderChip, setFolderChip] = useState<FolderChip>('all')
  const [search, setSearch] = useState('')
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const dragCounter = useRef(0)

  const savedViewsQuery = useQuery({
    queryKey: ['saved-views', orgId, 'files'],
    queryFn: () => savedViewApi.list('files'),
    enabled: Boolean(orgId),
  })

  useEffect(() => {
    setSavedViews(savedViewsQuery.data ?? [])
  }, [savedViewsQuery.data])

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

  const versionsQuery = useQuery({
    queryKey: ['file-versions', orgId, versionFile?.id],
    queryFn: () => fileApi.listVersions(versionFile!.id),
    enabled: Boolean(orgId && versionFile?.id),
  })

  const uploadVersionMutation = useMutation({
    mutationFn: ({ fileId, file }: { fileId: string; file: File }) =>
      fileApi.uploadVersion(fileId, file),
    onSuccess: (updated) => {
      toast.success(`Uploaded version ${updated.version ?? ''}`)
      setVersionFile(updated)
      void queryClient.invalidateQueries({ queryKey: ['files', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['file-versions', orgId, updated.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Version upload failed')),
  })

  const restoreVersionMutation = useMutation({
    mutationFn: ({ fileId, versionId }: { fileId: string; versionId: string }) =>
      fileApi.restoreVersion(fileId, versionId),
    onSuccess: (updated) => {
      toast.success(`Restored as version ${updated.version ?? ''}`)
      setVersionFile(updated)
      void queryClient.invalidateQueries({ queryKey: ['files', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['file-versions', orgId, updated.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Restore failed')),
  })

  const uploadFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    for (const file of Array.from(fileList)) {
      uploadMutation.mutate(file)
    }
  }

  const allFiles = filesQuery.data?.data.items ?? []

  useEffect(() => {
    const fileId = searchParams.get('fileId')
    if (!fileId || filesQuery.isLoading) return
    const found = allFiles.find((f) => f.id === fileId)
    if (found) setPreviewFile(found)
    searchParams.delete('fileId')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesQuery.isLoading, allFiles.length])

  const pathFolders = useMemo(() => {
    const folders = new Set<string>()
    for (const f of allFiles) {
      const slash = f.fileName.indexOf('/')
      if (slash > 0) folders.add(f.fileName.slice(0, slash))
    }
    return Array.from(folders).sort((a, b) => a.localeCompare(b))
  }, [allFiles])

  const files = useMemo(() => {
    let list = allFiles
    if (typeFilter === 'images') list = list.filter((f) => f.mimeType.startsWith('image/'))
    if (typeFilter === 'pdf') list = list.filter((f) => f.mimeType === 'application/pdf')
    if (typeFilter === 'other') {
      list = list.filter((f) => !f.mimeType.startsWith('image/') && f.mimeType !== 'application/pdf')
    }
    if (folderChip !== 'all') {
      if ((MIME_CHIPS as readonly string[]).includes(folderChip)) {
        list = list.filter((f) => matchesMimeChip(f, folderChip))
      } else {
        list = list.filter((f) => fileFolderPath(f.fileName) === folderChip)
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((f) => f.fileName.toLowerCase().includes(q))
    }
    return list
  }, [allFiles, typeFilter, folderChip, search])

  const folderGroups = useMemo(() => {
    const map = new Map<string, FileAsset[]>()
    for (const file of files) {
      const folder = fileFolderPath(file.fileName)
      const list = map.get(folder) ?? []
      list.push(file)
      map.set(folder, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Root') return -1
      if (b === 'Root') return 1
      return a.localeCompare(b)
    })
  }, [files])

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

  const canUpload = can('files:upload')
  const projects = projectsQuery.data?.data.items ?? []

  const renderFileGridCard = (file: FileAsset) => (
    <div
      key={file.id}
      className="surface-panel group relative overflow-hidden shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <button
        type="button"
        className="flex aspect-square w-full items-center justify-center bg-muted/60"
        onClick={() =>
          isPreviewable(file.mimeType)
            ? setPreviewFile(file)
            : window.open(file.secureUrl || file.url, '_blank')
        }
      >
        {file.mimeType.startsWith('image/') ? (
          <img
            src={file.secureUrl || file.url}
            alt={fileDisplayName(file.fileName)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <FileIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </button>
      <div className="space-y-1 p-2.5">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-medium" title={fileDisplayName(file.fileName)}>
            {fileDisplayName(file.fileName)}
          </p>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            v{file.version ?? 1}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] text-muted-foreground">{formatBytes(file.bytes)}</p>
        </div>
      </div>
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon-sm"
          className="h-7 w-7"
          title="Share link"
          onClick={() => copyFileShareUrl(file)}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          className="h-7 w-7"
          title="Version history"
          onClick={() => setVersionFile(file)}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
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
  )

  const renderFileListRow = (file: FileAsset) => (
    <li
      key={file.id}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() =>
          isPreviewable(file.mimeType)
            ? setPreviewFile(file)
            : window.open(file.secureUrl || file.url, '_blank')
        }
      >
        <span className="rounded-md bg-muted p-2 text-muted-foreground">
          <FileIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary hover:underline">
            {fileDisplayName(file.fileName)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatBytes(file.bytes)} · {formatDate(file.createdAt)}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          v{file.version ?? 1}
        </Badge>
        <Badge variant="secondary">{file.mimeType.split('/')[0]}</Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Share link"
          onClick={() => copyFileShareUrl(file)}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Version history"
          onClick={() => setVersionFile(file)}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
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
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="Files"
        description="Upload assets to Cloudinary and keep them linked to this workspace."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={groupByFolder ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setGroupByFolder((v) => !v)}
            >
              <Folder className="h-3.5 w-3.5" />
              Folders
            </Button>
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

      <div className="ts-filter-bar">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…"
          className="h-8 max-w-xs border-0 bg-transparent shadow-none focus-visible:ring-0"
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={folderChip === 'all' ? 'secondary' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setFolderChip('all')}
          >
            All folders
          </Button>
          {MIME_CHIPS.map((chip) => (
            <Button
              key={chip}
              type="button"
              size="sm"
              variant={folderChip === chip ? 'secondary' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFolderChip(chip)}
            >
              {chip}
            </Button>
          ))}
          {pathFolders.map((folder) => (
            <Button
              key={folder}
              type="button"
              size="sm"
              variant={folderChip === folder ? 'secondary' : 'outline'}
              className="h-7 gap-1 text-xs"
              onClick={() => setFolderChip(folder)}
            >
              <Folder className="h-3 w-3" />
              {folder}
            </Button>
          ))}
        </div>
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
                void savedViewApi
                  .create({
                    scope: 'files',
                    name,
                    filters: {
                      projectId: projectFilter,
                      type: typeFilter,
                      search,
                    },
                  })
                  .then(async () => {
                    toast.success('View saved')
                    await queryClient.invalidateQueries({ queryKey: ['saved-views', orgId, 'files'] })
                  })
                  .catch((error) => toast.error(getErrorMessage(error)))
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
                  void savedViewApi
                    .remove(saved.id)
                    .then(async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ['saved-views', orgId, 'files'],
                      })
                    })
                    .catch((error) => toast.error(getErrorMessage(error)))
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
        <LoadingState variant="page" rows={4} />
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
        groupByFolder ? (
          <div className="space-y-6">
            {folderGroups.map(([folder, folderFiles]) => (
              <section key={folder}>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Folder className="h-3.5 w-3.5" />
                  {folder}
                  <Badge variant="secondary" className="tabular-nums">
                    {folderFiles.length}
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {folderFiles.map(renderFileGridCard)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map(renderFileGridCard)}
          </div>
        )
      ) : groupByFolder ? (
        <div className="space-y-4">
          {folderGroups.map(([folder, folderFiles]) => (
            <section key={folder} className="surface-panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Folder className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{folder}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {folderFiles.length}
                </Badge>
              </div>
              <ul className="divide-y divide-border">{folderFiles.map(renderFileListRow)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="surface-panel divide-y divide-border overflow-hidden">
          {files.map(renderFileListRow)}
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

      <Sheet open={Boolean(versionFile)} onOpenChange={(open) => !open && setVersionFile(null)}>
        <SheetContent side="right" className="sm:max-w-md">
          {versionFile ? (
            <>
              <SheetHeader>
                <SheetTitle>Version history</SheetTitle>
                <SheetDescription className="truncate">
                  {fileDisplayName(versionFile.fileName)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center gap-2 px-5 pb-2">
                <input
                  ref={versionInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const next = e.target.files?.[0]
                    e.target.value = ''
                    if (!next || !versionFile) return
                    uploadVersionMutation.mutate({ fileId: versionFile.id, file: next })
                  }}
                />
                {can('files:upload') ? (
                  <Button
                    size="sm"
                    disabled={uploadVersionMutation.isPending}
                    onClick={() => versionInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadVersionMutation.isPending ? 'Uploading…' : 'Upload new version'}
                  </Button>
                ) : null}
              </div>
              {versionsQuery.isLoading ? (
                <div className="px-5 py-8">
                  <LoadingState />
                </div>
              ) : versionsQuery.isError ? (
                <div className="px-5 py-4">
                  <ErrorState onRetry={() => void versionsQuery.refetch()} />
                </div>
              ) : (
                <ul className="space-y-2 p-5">
                  {(versionsQuery.data?.versions ?? []).map((version) => (
                    <li
                      key={version.id}
                      className={cn(
                        'rounded-md border border-border px-3 py-2.5 text-sm',
                        version.isCurrent && 'border-primary/30 bg-primary/5',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">v{version.version}</span>
                        <div className="flex items-center gap-1">
                          {version.isCurrent ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Current
                            </Badge>
                          ) : can('files:upload') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={restoreVersionMutation.isPending}
                              onClick={() =>
                                restoreVersionMutation.mutate({
                                  fileId: versionFile.id,
                                  versionId: version.id,
                                })
                              }
                            >
                              Restore
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <a href={version.secureUrl || version.url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {fileDisplayName(version.fileName)} · {formatBytes(version.bytes)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(version.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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
