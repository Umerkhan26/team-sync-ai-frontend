export interface CustomTemplate {
  id: string
  kind: 'project' | 'task' | 'document'
  title: string
  description: string
  tags: string[]
  params: Record<string, string>
  createdAt: string
}

function storageKey(orgId: string) {
  return `teamsync_custom_templates_${orgId}`
}

export function listCustomTemplates(orgId: string): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomTemplate(
  orgId: string,
  template: Omit<CustomTemplate, 'id' | 'createdAt'> & { id?: string },
): CustomTemplate[] {
  const existing = listCustomTemplates(orgId)
  const entry: CustomTemplate = {
    ...template,
    id: template.id || `${Date.now()}`,
    createdAt: template.id
      ? existing.find((t) => t.id === template.id)?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  }
  const updated = template.id
    ? existing.map((t) => (t.id === template.id ? entry : t))
    : [entry, ...existing]
  localStorage.setItem(storageKey(orgId), JSON.stringify(updated))
  return updated
}

export function deleteCustomTemplate(orgId: string, id: string): CustomTemplate[] {
  const updated = listCustomTemplates(orgId).filter((t) => t.id !== id)
  localStorage.setItem(storageKey(orgId), JSON.stringify(updated))
  return updated
}
