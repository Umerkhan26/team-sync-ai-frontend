import { useEffect } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  Bold,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DOC_SNIPPETS } from '@/features/documents/constants/snippets'
import { cn } from '@/utils/cn'

interface TiptapEditorProps {
  content?: JSONContent | string | null
  editable?: boolean
  onUpdate?: (payload: { json: JSONContent; html: string; text: string }) => void
  className?: string
}

export function TiptapEditor({ content, editable = true, onUpdate, className }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: content || '',
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'ts-editor-content min-h-[360px] focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onUpdate?.({
        json: instance.getJSON(),
        html: instance.getHTML(),
        text: instance.getText(),
      })
    },
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  if (!editor) return null

  return (
    <div className={cn('surface-panel overflow-hidden', className)}>
      {editable ? (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            icon={Bold}
            label="Bold"
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            icon={Italic}
            label="Italic"
          />
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            icon={Strikethrough}
            label="Strikethrough"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            icon={Heading1}
            label="Heading 1"
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            icon={Heading2}
            label="Heading 2"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            icon={List}
            label="Bullet list"
          />
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            icon={ListOrdered}
            label="Numbered list"
          />
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            icon={Quote}
            label="Quote"
          />
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={() => {
              const url = window.prompt('Link URL')
              if (url) editor.chain().focus().setLink({ href: url }).run()
              else editor.chain().focus().unsetLink().run()
            }}
            icon={LinkIcon}
            label="Link"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            icon={Undo}
            label="Undo"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            icon={Redo}
            label="Redo"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          {DOC_SNIPPETS.map((snippet) => (
            <Button
              key={snippet.id}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              title={`Insert ${snippet.label}`}
              onClick={() => {
                const lines = snippet.content.split('\n')
                editor
                  .chain()
                  .focus()
                  .insertContent(
                    lines.map((line) => ({
                      type: 'paragraph',
                      content: line ? [{ type: 'text', text: line }] : [],
                    })),
                  )
                  .run()
              }}
            >
              <FileText className="h-3 w-3" />
              {snippet.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active?: boolean
  onClick: () => void
  icon: typeof Bold
  label: string
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  )
}
