import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'

export interface BulkInviteRow {
  name?: string
  email: string
  roleSlug?: string
  department?: string
}

interface BulkInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (rows: BulkInviteRow[]) => void
  loading?: boolean
}

function parseCsv(text: string): { rows: BulkInviteRow[]; errors: string[] } {
  const rows: BulkInviteRow[] = []
  const errors: string[] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const [index, line] of lines.entries()) {
    const lower = line.toLowerCase()
    if (index === 0 && lower.startsWith('name') && lower.includes('email')) {
      continue // header row
    }
    const parts = line.split(',').map((p) => p.trim())
    const [name, email, roleSlug, department] = parts
    if (!email || !email.includes('@')) {
      errors.push(`Line ${index + 1}: missing or invalid email`)
      continue
    }
    rows.push({
      name: name || undefined,
      email,
      roleSlug: roleSlug || undefined,
      department: department || undefined,
    })
  }

  return { rows, errors }
}

export function BulkInviteDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: BulkInviteDialogProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<BulkInviteRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleParse = (value: string) => {
    setText(value)
    const result = parseCsv(value)
    setRows(result.rows)
    setErrors(result.errors)
  }

  const handleFile = async (file: File) => {
    const content = await file.text()
    handleParse(content)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setText('')
          setRows([])
          setErrors([])
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk invite</DialogTitle>
          <DialogDescription>
            Paste CSV rows as <code>name,email,role,department</code> — one per line.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload .csv
            </Button>
            <span className="text-xs text-muted-foreground">or paste below</span>
          </div>
          <Textarea
            rows={6}
            placeholder={'Alex Chen,alex@company.com,member,Engineering\nJo Diaz,jo@company.com,manager,Design'}
            value={text}
            onChange={(e) => handleParse(e.target.value)}
          />

          {errors.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {errors.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Email</th>
                    <th className="px-2 py-1.5 text-left">Role</th>
                    <th className="px-2 py-1.5 text-left">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.email} className="border-t border-border">
                      <td className="px-2 py-1.5">{row.name || '—'}</td>
                      <td className="px-2 py-1.5">{row.email}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline">{row.roleSlug || 'member'}</Badge>
                      </td>
                      <td className="px-2 py-1.5">{row.department || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={rows.length === 0 || loading}
            onClick={() => onSubmit(rows)}
          >
            {loading ? 'Sending…' : `Send ${rows.length || ''} invite${rows.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
