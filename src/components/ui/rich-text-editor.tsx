'use client'

import { useEffect, useRef } from 'react'
import { Bold, Italic, List, ListOrdered, Undo, Redo, Minus } from 'lucide-react'

// Convert markdown → HTML for rendering AI-generated content
function mdToHtml(text: string): string {
  if (!text) return ''
  if (text.trim().startsWith('<') && !text.trim().startsWith('<p>## ') && !text.trim().startsWith('<p># ')) return text

  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings (must come before bold/italic)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // horizontal rule
    .replace(/^---$/gm, '<hr>')
    // unordered lists — collect consecutive - lines into <ul>
    .replace(/(^- .+$(\n- .+$)*)/gm, (block) => {
      const items = block.split('\n').map(l => `<li>${l.slice(2)}</li>`).join('')
      return `<ul>${items}</ul>`
    })
    // ordered lists
    .replace(/(^\d+\. .+$(\n\d+\. .+$)*)/gm, (block) => {
      const items = block.split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')
      return `<ol>${items}</ol>`
    })

  // Wrap remaining plain lines in <p>, skip lines that are already block elements
  const blockTags = /^<(h[1-6]|ul|ol|li|hr|blockquote|div)/
  html = html.split('\n').map(line => {
    if (line.trim() === '') return '<p><br></p>'
    if (blockTags.test(line.trim())) return line
    return `<p>${line}</p>`
  }).join('\n')

  return html
}

function ToolBtn({ onClick, title, children, active }: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded-md transition-colors text-xs font-medium min-w-[28px] flex items-center justify-center ${
        active
          ? 'bg-violet-600/30 text-violet-300 border border-violet-600/40'
          : 'hover:bg-slate-700 text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-700 mx-0.5" />
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export function RichTextEditor({ value, onChange, placeholder = 'Write your content here…', minHeight = 260 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef<string>('')
  const isComposing = useRef(false)

  // Initialize with value on mount or when value changes externally (modal open)
  useEffect(() => {
    if (!editorRef.current) return
    const html = mdToHtml(value)
    if (html !== lastValueRef.current) {
      editorRef.current.innerHTML = html
      lastValueRef.current = html
    }
  }, [value])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined)
    editorRef.current?.focus()
    emitChange()
  }

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? ''
    lastValueRef.current = html
    onChange(html)
  }

  const charCount = value.replace(/<[^>]+>/g, '').length

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950 focus-within:border-violet-500 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-800 bg-slate-900 flex-wrap">
        <ToolBtn onClick={() => exec('formatBlock', 'h1')} title="Heading 1">H1</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'h2')} title="Heading 2">H2</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'h3')} title="Heading 3">H3</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', 'p')} title="Paragraph">P</ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Bullet List"><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => exec('insertHorizontalRule')} title="Divider"><Minus className="w-3.5 h-3.5" /></ToolBtn>
        <div className="flex-1" />
        <ToolBtn onClick={() => exec('undo')} title="Undo"><Undo className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec('redo')} title="Redo"><Redo className="w-3.5 h-3.5" /></ToolBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={() => { isComposing.current = false; emitChange() }}
        onInput={() => { if (!isComposing.current) emitChange() }}
        onKeyDown={e => {
          // Tab → indent
          if (e.key === 'Tab') { e.preventDefault(); exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;') }
        }}
        className="relative outline-none overflow-y-auto px-4 py-3 text-slate-200 text-sm leading-relaxed
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-2
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-100 [&_h3]:mt-2 [&_h3]:mb-1
          [&_p]:mb-2 [&_p]:text-slate-300 [&_p:empty]:min-h-[1.4em]
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:text-slate-300
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:text-slate-300
          [&_li]:mb-0.5
          [&_strong]:text-white [&_strong]:font-semibold
          [&_em]:text-slate-300
          [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-violet-300
          [&_hr]:border-slate-700 [&_hr]:my-3
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600 empty:before:pointer-events-none"
        style={{ minHeight }}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800 bg-slate-900/50">
        <span className="text-[11px] text-slate-600">Select text to format · Tab to indent</span>
        <span className="text-[11px] text-slate-600">{charCount.toLocaleString()} chars</span>
      </div>
    </div>
  )
}
