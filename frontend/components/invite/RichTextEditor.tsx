'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { FontSize } from '@/lib/tiptap/extensions/FontSize'
import { FONT_OPTIONS, findFontByFamily } from '@/lib/invite/fonts'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  List,
  ChevronDown,
  Indent,
  Link as LinkIcon
} from 'lucide-react'

export interface RichTextEditorRef {
  insertText: (text: string) => void
  focus: () => void
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder }, ref) => {
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)
  const [showIndentMenu, setShowIndentMenu] = useState(false)
  const [textColor, setTextColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('#ffffff')
  
  // Track the last content we sent via onChange to prevent update loops
  // Initialize as empty string, will be set when editor is ready
  const lastSentContentRef = useRef<string>('')
  const isUpdatingFromPropRef = useRef(false)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Memoize extensions to prevent editor recreation on every render
  // Note: TipTap may warn about duplicate extension names in development mode
  // when multiple editor instances exist (e.g., in settings and modal).
  // This is a development-only warning and doesn't affect functionality.
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false,
    }),
    TextStyle,
    Color,
    FontSize,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    FontFamily.configure({
      types: ['textStyle'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    Placeholder.configure({
      placeholder: placeholder || 'Enter event details...',
    }),
  ], [placeholder]) // Only recreate if placeholder changes

  // Memoize onUpdate callback to prevent editor recreation
  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    // Skip if we're updating from prop to prevent loops
    if (isUpdatingFromPropRef.current) {
      return
    }
    
    const html = editor.getHTML()
    // Only call onChange if content actually changed and it's different from what we last sent
    if (html !== lastSentContentRef.current) {
      lastSentContentRef.current = html
      onChangeRef.current(html) // Use ref to avoid dependency
    }
  }, []) // Empty deps - use ref for onChange

  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'min-h-[200px] p-3 focus:outline-none bg-white prose prose-sm max-w-none',
        style: 'white-space: pre-wrap;',
      },
    },
    immediatelyRender: false,
  })

  // Initialize lastSentContentRef when editor is ready
  useEffect(() => {
    if (editor && lastSentContentRef.current === '') {
      lastSentContentRef.current = editor.getHTML()
    }
  }, [editor])

  // Sync value prop with editor content (only when value changes externally)
  useEffect(() => {
    if (!editor) return
    
    const currentContent = editor.getHTML()
    // Only update if the value prop is different from what we last sent
    // This means the change came from outside (parent component)
    if (value !== lastSentContentRef.current && value !== currentContent) {
      isUpdatingFromPropRef.current = true
      try {
        editor.commands.setContent(value || '', { emitUpdate: false })
        lastSentContentRef.current = value
      } finally {
        // Reset flag after a brief delay to allow onUpdate to complete
        // Use requestAnimationFrame for better timing than setTimeout
        requestAnimationFrame(() => {
          isUpdatingFromPropRef.current = false
        })
      }
    }
  }, [value, editor])

  // Expose insertText and focus methods via ref
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run()
      }
    },
    focus: () => {
      if (editor) {
        editor.chain().focus().run()
      }
    }
  }), [editor])

  // Update UI state from editor selection
  useEffect(() => {
    if (!editor) return

    const updateUI = () => {
      const { color } = editor.getAttributes('textStyle')
      if (color) {
        setTextColor(color)
      }
      
      const { highlight } = editor.getAttributes('highlight')
      if (highlight && highlight !== 'transparent') {
        setHighlightColor(highlight)
      }
    }

    editor.on('selectionUpdate', updateUI)
    editor.on('update', updateUI)

    return () => {
      editor.off('selectionUpdate', updateUI)
      editor.off('update', updateUI)
    }
  }, [editor])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFontMenu ||
        showSizeMenu ||
        showListMenu ||
        showIndentMenu
      ) {
        const target = event.target as HTMLElement
        if (!target.closest('.relative')) {
          setShowFontMenu(false)
          setShowSizeMenu(false)
          setShowListMenu(false)
          setShowIndentMenu(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFontMenu, showSizeMenu, showListMenu, showIndentMenu])

  // CRITICAL FIX: Never return early after hooks - handle null editor in JSX
  // This ensures hooks are always called in the same order
  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-eco-green focus-within:border-eco-green overflow-hidden">
        <div className="min-h-[200px] p-3 bg-white flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading editor...</p>
        </div>
      </div>
    )
  }

  const currentFont = editor.getAttributes('textStyle').fontFamily || 'Helvetica, Arial, sans-serif'
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '12px'
  const fontSize = parseInt(currentFontSize) || 12

  return (
    <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-eco-green focus-within:border-eco-green overflow-hidden">
      {/* Toolbar - Dark gray background */}
      <div className="flex items-center gap-1 p-2 bg-gray-700 rounded-t-lg flex-wrap">
        {/* Font Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowFontMenu(!showFontMenu)
              setShowSizeMenu(false)
              setShowListMenu(false)
              setShowIndentMenu(false)
            }}
            className="h-8 px-3 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded flex items-center gap-1 border border-gray-500"
          >
            <span className="text-xs">
              {findFontByFamily(currentFont)?.name || currentFont.split(',')[0].replace(/['"]/g, '').trim() || 'Helvetica'}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.family).run()
                    setShowFontMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                  style={{ fontFamily: font.family }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowSizeMenu(!showSizeMenu)
              setShowFontMenu(false)
              setShowListMenu(false)
              setShowIndentMenu(false)
            }}
            className="h-8 px-3 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded flex items-center gap-1 border border-gray-500"
          >
            <span className="text-xs">{fontSize}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showSizeMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setFontSize(`${size}px`).run()
                    setShowSizeMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* Text Color Picker */}
        <div className="relative">
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              const color = e.target.value
              setTextColor(color)
              editor.chain().focus().setColor(color).run()
            }}
            className="h-8 w-8 rounded border border-gray-500 cursor-pointer bg-gray-600"
            title="Text Color"
          />
        </div>

        {/* Highlight Color Picker */}
        <div className="relative">
          <div className="relative">
            <input
              type="color"
              value={highlightColor === 'transparent' ? '#ffffff' : highlightColor}
              onChange={(e) => {
                const color = e.target.value
                setHighlightColor(color)
                editor.chain().focus().toggleHighlight({ color }).run()
              }}
              className="h-8 w-8 rounded border border-gray-500 cursor-pointer bg-gray-600"
              title="Highlight Color"
            />
            {highlightColor === 'transparent' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-0.5 bg-red-500 rotate-45"></div>
              </div>
            )}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive('bold')
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive('italic')
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Italic"
        >
          <span className="italic text-sm">I</span>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive('underline')
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Underline"
        >
          <span className="underline text-sm">U</span>
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive('strike')
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Strikethrough"
        >
          <span className="line-through text-sm">S</span>
        </button>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* Alignment Buttons */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive({ textAlign: 'left' })
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive({ textAlign: 'center' })
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive({ textAlign: 'right' })
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* List Options */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowListMenu(!showListMenu)
              setShowFontMenu(false)
              setShowSizeMenu(false)
              setShowIndentMenu(false)
            }}
            className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
            title="List"
          >
            <List className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>
          {showListMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleBulletList().run()
                  setShowListMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <span className="text-lg">•</span> Bullet List
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleOrderedList().run()
                  setShowListMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <span className="text-sm">1.</span> Numbered List
              </button>
            </div>
          )}
        </div>

        {/* Indentation Options */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowIndentMenu(!showIndentMenu)
              setShowFontMenu(false)
              setShowSizeMenu(false)
              setShowListMenu(false)
            }}
            className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
            title="Indent"
          >
            <Indent className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>
          {showIndentMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().sinkListItem('listItem').run()
                  setShowIndentMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Indent className="h-4 w-4 rotate-180" />
                Increase Indent
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().liftListItem('listItem').run()
                  setShowIndentMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Indent className="h-4 w-4" />
                Decrease Indent
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={() => {
            const url = prompt('Enter URL:')
            if (url) {
              const text = window.getSelection()?.toString() || 'Link'
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={`h-8 w-8 rounded flex items-center justify-center border border-gray-500 ${
            editor.isActive('link')
              ? 'bg-gray-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title="Insert Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
      <style jsx global>{`
        .ProseMirror {
          min-height: 200px;
          padding: 12px;
          outline: none;
          background: white;
          white-space: pre-wrap;
        }
        
        .ProseMirror p,
        .ProseMirror div {
          margin: 0.5em 0;
          min-height: 1.5em;
        }
        
        .ProseMirror p:first-child,
        .ProseMirror div:first-child {
          margin-top: 0;
        }
        
        .ProseMirror p:last-child,
        .ProseMirror div:last-child {
          margin-bottom: 0;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        
        .ProseMirror .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        
        .ProseMirror ul {
          list-style-type: disc;
        }
        
        .ProseMirror ol {
          list-style-type: decimal;
        }
        
        .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        
        .ProseMirror a:hover {
          color: #1d4ed8;
        }
        
        .ProseMirror mark {
          background-color: #fef08a;
          border-radius: 0.25rem;
        }
      `}</style>
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
