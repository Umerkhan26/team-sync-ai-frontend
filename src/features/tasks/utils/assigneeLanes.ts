import type { Task } from '@/types'

export type AssigneeLane = { id: string; label: string }

export function getAssigneeLanes(
  tasks: Task[],
  memberNames: Map<string, string>,
): AssigneeLane[] {
  const assigneeIds = new Set<string>()
  let hasUnassigned = false

  for (const task of tasks) {
    if (!task.assigneeIds?.length) {
      hasUnassigned = true
      continue
    }
    for (const id of task.assigneeIds) assigneeIds.add(id)
  }

  const lanes: AssigneeLane[] = []
  if (hasUnassigned) lanes.push({ id: '__unassigned__', label: 'Unassigned' })

  for (const id of [...assigneeIds].sort((a, b) =>
    (memberNames.get(a) || a).localeCompare(memberNames.get(b) || b),
  )) {
    lanes.push({ id, label: memberNames.get(id) || `Member ${id.slice(0, 6)}` })
  }

  return lanes
}

export function taskInAssigneeLane(task: Task, laneId: string): boolean {
  if (laneId === '__unassigned__') return !task.assigneeIds?.length
  return task.assigneeIds?.includes(laneId) ?? false
}
