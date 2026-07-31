export interface DocSnippet {
  id: string
  label: string
  content: string
}

export const DOC_SNIPPETS: DocSnippet[] = [
  {
    id: 'meeting-notes',
    label: 'Meeting notes',
    content:
      '## Agenda\n\n1. \n2. \n\n## Discussion\n\n## Action items\n- ',
  },
  {
    id: 'prd-outline',
    label: 'PRD outline',
    content: '## Problem\n\n## Goals\n\n## Scope\n\n## Out of scope\n\n## Success metrics',
  },
  {
    id: 'runbook',
    label: 'Runbook',
    content: '## Overview\n\n## Prerequisites\n\n## Steps\n\n1. \n\n## Rollback',
  },
  {
    id: 'checklist',
    label: 'Checklist',
    content: '- [ ] First item\n- [ ] Second item\n- [ ] Third item',
  },
]
