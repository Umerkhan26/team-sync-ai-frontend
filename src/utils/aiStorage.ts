const CREDITS_KEY = 'teamsync_ai_credits'
const PROMPTS_KEY = 'teamsync_ai_prompts'
const DEFAULT_CREDITS = 42

export interface SavedPrompt {
  id: string
  text: string
  feature: string
  createdAt: string
}

function creditsKey(orgId: string) {
  return `${CREDITS_KEY}_${orgId}`
}

function promptsKey(orgId: string) {
  return `${PROMPTS_KEY}_${orgId}`
}

export function getAiCredits(orgId: string): number {
  try {
    const raw = localStorage.getItem(creditsKey(orgId))
    if (raw === null) return DEFAULT_CREDITS
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CREDITS
  } catch {
    return DEFAULT_CREDITS
  }
}

export function setAiCredits(orgId: string, credits: number) {
  localStorage.setItem(creditsKey(orgId), String(Math.max(0, credits)))
}

export function deductAiCredit(orgId: string, amount = 1): number {
  const next = Math.max(0, getAiCredits(orgId) - amount)
  setAiCredits(orgId, next)
  return next
}

export function listSavedPrompts(orgId: string): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(promptsKey(orgId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedPrompt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePrompt(orgId: string, text: string, feature: string): SavedPrompt[] {
  const prompts = listSavedPrompts(orgId)
  const entry: SavedPrompt = {
    id: `${Date.now()}`,
    text: text.trim(),
    feature,
    createdAt: new Date().toISOString(),
  }
  const updated = [entry, ...prompts.filter((p) => p.text !== entry.text)].slice(0, 20)
  localStorage.setItem(promptsKey(orgId), JSON.stringify(updated))
  return updated
}

export function deleteSavedPrompt(orgId: string, id: string): SavedPrompt[] {
  const updated = listSavedPrompts(orgId).filter((p) => p.id !== id)
  localStorage.setItem(promptsKey(orgId), JSON.stringify(updated))
  return updated
}

export const STUB_CITATIONS = [
  { title: 'Q3 product roadmap', source: 'Document', href: '#' },
  { title: '#engineering channel', source: 'Chat', href: '#' },
  { title: 'Sprint 14 retro notes', source: 'Meeting', href: '#' },
] as const
