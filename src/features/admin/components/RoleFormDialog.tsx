import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PERMISSION_GROUPS } from '@/constants/permissions'
import type { Role } from '@/types'

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: Role | null
  onSubmit: (values: { name: string; description?: string; permissions: string[] }) => void
  loading?: boolean
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSubmit,
  loading,
}: RoleFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(role?.name || '')
      setDescription('')
      setPermissions(role?.permissions || [])
    }
  }, [open, role])

  const togglePermission = (permission: string) => {
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    )
  }

  const toggleGroup = (groupPermissions: string[], checked: boolean) => {
    setPermissions((prev) => {
      const withoutGroup = prev.filter((p) => !groupPermissions.includes(p))
      return checked ? [...withoutGroup, ...groupPermissions] : withoutGroup
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : 'Create custom role'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || permissions.length === 0) return
            onSubmit({ name: name.trim(), description: description.trim() || undefined, permissions })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roleName">Name</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contractor"
                disabled={Boolean(role?.isSystem)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Input
                id="roleDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="max-h-[360px] space-y-4 overflow-y-auto rounded-md border border-border p-3">
              {PERMISSION_GROUPS.map((group) => {
                const allChecked = group.permissions.every((p) => permissions.includes(p))
                return (
                  <div key={group.label}>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(checked) =>
                          toggleGroup(group.permissions, Boolean(checked))
                        }
                      />
                      {group.label}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 pl-6 sm:grid-cols-3">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-1.5 text-xs text-foreground"
                        >
                          <Checkbox
                            checked={permissions.includes(permission)}
                            onCheckedChange={() => togglePermission(permission)}
                          />
                          {permission}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {permissions.length === 0 ? (
              <p className="text-xs text-destructive">Select at least one permission.</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || permissions.length === 0}>
              {loading ? 'Saving…' : role ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
