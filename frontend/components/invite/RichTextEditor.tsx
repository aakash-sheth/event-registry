'use client'

import React, { useRef, useState, useEffect } from 'react'
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  List,
  ChevronDown,
  Indent,
  Link,
  Smile
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const FONTS = [
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { label: 'Impact', value: 'Impact, fantasy' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Palatino', value: 'Palatino, serif' },
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)
  const [showIndentMenu, setShowIndentMenu] = useState(false)
  const [textColor, setTextColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('transparent')
  const [fontSize, setFontSize] = useState(12)
  const [currentFont, setCurrentFont] = useState('Helvetica')

  // Convert markdown to HTML for display
  const markdownToHtml = (markdown: string): string => {
    let html = markdown
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n/g, '<br>')
    
    // Handle inline styles from contentEditable (font, size, color, etc.)
    // These are preserved as-is in HTML format
    return html
  }

  // Convert HTML to markdown (simplified - preserves HTML for complex formatting)
  const htmlToMarkdown = (html: string): string => {
    // For complex formatting (fonts, colors, alignment, etc.), we preserve HTML
    // Only convert basic markdown patterns
    let markdown = html
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<em>(.+?)<\/em>/g, '*$1*')
      .replace(/<s>(.+?)<\/s>/g, '~~$1~~')
      .replace(/<a href="(.+?)" target="_blank">(.+?)<\/a>/g, '[$2]($1)')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<div>/g, '\n')
      .replace(/<\/div>/g, '')
      .replace(/<p>/g, '\n')
      .replace(/<\/p>/g, '')
    
    // Preserve underline and other formatting as HTML
    // This allows the editor to maintain complex formatting
    return markdown.trim()
  }

  useEffect(() => {
    if (editorRef.current && !isFocused) {
      // Check if value is HTML or markdown
      const isHTML = /<[a-z][\s\S]*>/i.test(value || '')
      if (isHTML) {
        editorRef.current.innerHTML = value || ''
      } else {
        editorRef.current.innerHTML = markdownToHtml(value || '')
      }
    }
  }, [value, isFocused])

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

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      // Always store HTML to preserve all formatting (fonts, colors, alignment, lists, etc.)
      // This ensures all rich text features work correctly
      onChange(html)
    }
  }

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const handleFontChange = (font: string) => {
    handleFormat('fontName', font)
    setCurrentFont(font)
    setShowFontMenu(false)
  }

  const handleFontSizeChange = (size: number) => {
    handleFormat('fontSize', size.toString())
    setFontSize(size)
    setShowSizeMenu(false)
  }

  const handleTextColorChange = (color: string) => {
    handleFormat('foreColor', color)
    setTextColor(color)
  }

  const handleHighlightColorChange = (color: string) => {
    if (color === 'transparent') {
      handleFormat('backColor', '#ffffff')
      setHighlightColor('transparent')
    } else {
      handleFormat('backColor', color)
      setHighlightColor(color)
    }
  }

  const handleAlignment = (align: string) => {
    handleFormat('justify' + align.charAt(0).toUpperCase() + align.slice(1))
  }

  const handleList = (type: 'unordered' | 'ordered') => {
    if (type === 'unordered') {
      handleFormat('insertUnorderedList')
    } else {
      handleFormat('insertOrderedList')
    }
    setShowListMenu(false)
  }

  const handleIndent = (direction: 'increase' | 'decrease') => {
    if (direction === 'increase') {
      handleFormat('indent')
    } else {
      handleFormat('outdent')
    }
    setShowIndentMenu(false)
  }

  const insertEmoji = (emoji: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(emoji)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      handleInput()
    }
  }

  const commonEmojis = ['😊', '❤️', '🎉', '🎊', '💐', '🌸', '🌺', '✨', '🌟', '💫']

  return (
    <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-eco-green focus-within:border-eco-green overflow-hidden">
      {/* Toolbar - Dark gray background like screenshot */}
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
            <span className="text-xs">{currentFont}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {FONTS.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => handleFontChange(font.value)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
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
                  onClick={() => handleFontSizeChange(size)}
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
            onChange={(e) => handleTextColorChange(e.target.value)}
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
              onChange={(e) => handleHighlightColorChange(e.target.value)}
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
          onClick={() => handleFormat('bold')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => handleFormat('italic')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Italic"
        >
          <span className="italic text-sm">I</span>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => handleFormat('underline')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Underline"
        >
          <span className="underline text-sm">U</span>
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          onClick={() => handleFormat('strikeThrough')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Strikethrough"
        >
          <span className="line-through text-sm">S</span>
        </button>

        <div className="w-px h-6 bg-gray-500 mx-1" />

        {/* Alignment Buttons */}
        <button
          type="button"
          onClick={() => handleAlignment('Left')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleAlignment('Center')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleAlignment('Right')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleAlignment('Full')}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
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
                onClick={() => handleList('unordered')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <span className="text-lg">•</span> Bullet List
              </button>
              <button
                type="button"
                onClick={() => handleList('ordered')}
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
                onClick={() => handleIndent('increase')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Indent className="h-4 w-4 rotate-180" />
                Increase Indent
              </button>
              <button
                type="button"
                onClick={() => handleIndent('decrease')}
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
              handleFormat('insertHTML', `<a href="${url}" target="_blank">${text}</a>`)
            }
          }}
          className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
          title="Insert Link"
        >
          <Link className="h-4 w-4" />
        </button>

        {/* Emoji */}
        <div className="relative group">
          <button
            type="button"
            className="h-8 w-8 bg-gray-600 hover:bg-gray-500 text-white rounded flex items-center justify-center border border-gray-500"
            title="Insert Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-10 hidden group-hover:block">
            <div className="grid grid-cols-5 gap-1">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="min-h-[200px] p-3 focus:outline-none bg-white"
        style={{
          whiteSpace: 'pre-wrap',
        }}
        data-placeholder={placeholder || 'Enter event details...'}
      />
      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

