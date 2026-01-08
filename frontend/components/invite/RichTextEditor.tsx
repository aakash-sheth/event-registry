'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
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
  Link
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

  // Function to extract formatting from current selection and update UI controls
  const updateUIFromSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return
    }

    const range = selection.getRangeAt(0)
    
    // Check if selection is within the editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return
    }
    if (range.collapsed) {
      // No selection - get formatting from the element containing the cursor
      let element = range.commonAncestorContainer as HTMLElement
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement as HTMLElement
      }

      // Walk up to find the element with formatting
      while (element && element !== editorRef.current) {
        const computedStyle = window.getComputedStyle(element)
        
        // Check for color
        const color = computedStyle.color
        if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
          // Convert rgb/rgba to hex
          const rgb = color.match(/\d+/g)
          if (rgb && rgb.length >= 3) {
            const hex = '#' + rgb.slice(0, 3).map(x => {
              const val = parseInt(x).toString(16)
              return val.length === 1 ? '0' + val : val
            }).join('')
            setTextColor(hex)
          }
        }

        // Check for font size
        const fontSize = computedStyle.fontSize
        if (fontSize) {
          const size = parseInt(fontSize)
          if (!isNaN(size) && FONT_SIZES.includes(size)) {
            setFontSize(size)
          }
        }

        // Check for font family
        const fontFamily = computedStyle.fontFamily
        if (fontFamily) {
          const matchedFont = FONTS.find(f => 
            fontFamily.includes(f.value.split(',')[0])
          )
          if (matchedFont) {
            setCurrentFont(matchedFont.value)
          }
        }

        // If we found formatting, stop walking up
        if (color !== 'rgb(0, 0, 0)' || fontSize || fontFamily) {
          break
        }

        element = element.parentElement as HTMLElement
      }
    } else {
      // Has selection - get formatting from the selected range
      const container = range.commonAncestorContainer as HTMLElement
      let element: HTMLElement | null = null
      
      if (container.nodeType === Node.TEXT_NODE) {
        element = container.parentElement
      } else {
        element = container as HTMLElement
      }

      // Check for inline styles in spans within selection
      const walker = document.createTreeWalker(
        range.cloneContents(),
        NodeFilter.SHOW_ELEMENT,
        null
      )

      let foundColor = false
      let foundSize = false
      let foundFont = false

      let node
      while (node = walker.nextNode()) {
        const el = node as HTMLElement
        const style = el.style

        if (!foundColor && style.color) {
          setTextColor(style.color)
          foundColor = true
        }

        if (!foundSize && style.fontSize) {
          const size = parseInt(style.fontSize)
          if (!isNaN(size) && FONT_SIZES.includes(size)) {
            setFontSize(size)
            foundSize = true
          }
        }

        if (!foundFont && style.fontFamily) {
          const matchedFont = FONTS.find(f => 
            style.fontFamily.includes(f.value.split(',')[0])
          )
          if (matchedFont) {
            setCurrentFont(matchedFont.value)
            foundFont = true
          }
        }

        if (foundColor && foundSize && foundFont) break
      }

      // If no inline styles found, check computed styles
      if (element && (!foundColor || !foundSize || !foundFont)) {
        const computedStyle = window.getComputedStyle(element)
        
        if (!foundColor) {
          const color = computedStyle.color
          if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
            const rgb = color.match(/\d+/g)
            if (rgb && rgb.length >= 3) {
              const hex = '#' + rgb.slice(0, 3).map(x => {
                const val = parseInt(x).toString(16)
                return val.length === 1 ? '0' + val : val
              }).join('')
              setTextColor(hex)
            }
          }
        }

        if (!foundSize) {
          const fontSize = computedStyle.fontSize
          if (fontSize) {
            const size = parseInt(fontSize)
            if (!isNaN(size) && FONT_SIZES.includes(size)) {
              setFontSize(size)
            }
          }
        }

        if (!foundFont) {
          const fontFamily = computedStyle.fontFamily
          if (fontFamily) {
            const matchedFont = FONTS.find(f => 
              fontFamily.includes(f.value.split(',')[0])
            )
            if (matchedFont) {
              setCurrentFont(matchedFont.value)
            }
          }
        }
      }
    }
  }, [FONTS, FONT_SIZES])

  // Update editor content when value prop changes (only when not focused to avoid conflicts)
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      // Only update if the content has actually changed to avoid overwriting user edits
      const currentContent = editorRef.current.innerHTML
      const newContent = (() => {
        const isHTML = /<[a-z][\s\S]*>/i.test(value || '')
        return isHTML ? (value || '') : markdownToHtml(value || '')
      })()
      
      // Only update if content is different to avoid losing formatting during editing
      if (currentContent !== newContent) {
        editorRef.current.innerHTML = newContent
        // Update UI controls to reflect the content after sync
        setTimeout(() => updateUIFromSelection(), 0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused, updateUIFromSelection])

  // Listen for selection changes to update UI controls
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current && isFocused) {
        updateUIFromSelection()
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [isFocused, updateUIFromSelection])

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
      // Normalize empty paragraphs to ensure they're preserved
      // Handle both truly empty and paragraphs with only <br>
      // IMPORTANT: Only normalize truly empty paragraphs, preserve all formatting
      const allParagraphs = editorRef.current.querySelectorAll('p, div')
      allParagraphs.forEach((el) => {
        const textContent = el.textContent?.trim() || ''
        const innerHTML = el.innerHTML.trim()
        
        // Only normalize if paragraph is completely empty (no text, no formatting)
        // Preserve any formatting that exists
        if (textContent === '' && (innerHTML === '' || innerHTML === '<br>' || innerHTML === '<br/>')) {
          // Only set to <br> if it's truly empty, don't touch paragraphs with formatting
          const hasFormatting = el.querySelector('span, strong, em, u, s, a, font') !== null
          if (!hasFormatting) {
            el.innerHTML = '<br>'
          }
        }
      })
      
      const html = editorRef.current.innerHTML
      // Always store HTML to preserve all formatting (fonts, colors, alignment, lists, etc.)
      // This ensures all rich text features work correctly
      onChange(html)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle Enter key to create proper paragraphs
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // Prevent default behavior
      
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || !editorRef.current) {
        return
      }
      
      const range = selection.getRangeAt(0)
      
      // Find the current block element (p or div) that's a direct child of editor
      let currentBlock: HTMLElement | null = null
      let node: Node | null = range.startContainer
      
      // Walk up the DOM tree to find the block element
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement
          if ((el.tagName === 'P' || el.tagName === 'DIV') && el.parentElement === editorRef.current) {
            currentBlock = el
            break
          }
        }
        node = node.parentNode
      }
      
      // If no block found, create one
      if (!currentBlock) {
        currentBlock = document.createElement('p')
        editorRef.current.appendChild(currentBlock)
      }
      
      // Split the current block at the cursor position
      const clonedRange = range.cloneRange()
      clonedRange.setStartBefore(currentBlock)
      clonedRange.setEnd(range.startContainer, range.startOffset)
      
      // Get content before cursor
      const beforeContent = clonedRange.extractContents()
      
      // Get content after cursor
      const afterRange = range.cloneRange()
      afterRange.setStart(range.startContainer, range.startOffset)
      afterRange.setEndAfter(currentBlock.lastChild || currentBlock)
      const afterContent = afterRange.extractContents()
      
      // Create new paragraph for content after cursor
      const newP = document.createElement('p')
      newP.innerHTML = '<br>'
      
      // If there's content after cursor, put it in the new paragraph
      if (afterContent.textContent?.trim() || afterContent.querySelector('span, strong, em, u, s, a')) {
        newP.innerHTML = ''
        newP.appendChild(afterContent)
      }
      
      // Update current block with content before cursor
      currentBlock.innerHTML = ''
      if (beforeContent.textContent?.trim() || beforeContent.querySelector('span, strong, em, u, s, a')) {
        currentBlock.appendChild(beforeContent)
      } else {
        currentBlock.innerHTML = '<br>'
      }
      
      // Insert new paragraph after current block
      if (currentBlock.nextSibling) {
        currentBlock.parentNode?.insertBefore(newP, currentBlock.nextSibling)
      } else {
        currentBlock.parentNode?.appendChild(newP)
      }
      
      // Move cursor to the new paragraph
      const newRange = document.createRange()
      newRange.setStart(newP, 0)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
      
      // Normalize and update
      setTimeout(() => {
        if (editorRef.current) {
          // Ensure all empty paragraphs have <br>
          const emptyElements = editorRef.current.querySelectorAll('p:empty, div:empty')
          emptyElements.forEach((el) => {
            if (el.innerHTML === '' || el.innerHTML.trim() === '<br>' || el.innerHTML.trim() === '<br/>') {
              el.innerHTML = '<br>'
            }
          })
          handleInput()
        }
      }, 0)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const html = e.clipboardData.getData('text/html')
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    
    // Use plain text to preserve line breaks and avoid formatting issues
    // User can then apply formatting as needed
    const lines = text.split('\n')
    const fragment = document.createDocumentFragment()
    
    lines.forEach((line) => {
      const p = document.createElement('p')
      if (line.trim() === '') {
        p.innerHTML = '<br>'
      } else {
        p.textContent = line
      }
      fragment.appendChild(p)
    })
    
    range.insertNode(fragment)
    
    // Move cursor to end of pasted content
    const lastNode = fragment.lastChild
    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    
    // Normalize the content after pasting
    setTimeout(() => {
      handleInput()
    }, 0)
  }

  const handleFormat = (command: string, value?: string) => {
    const selection = window.getSelection()
    
    if (!selection || selection.rangeCount === 0) {
      // Fallback to execCommand if no selection
      document.execCommand(command, false, value)
      editorRef.current?.focus()
      handleInput()
      return
    }
    
    const range = selection.getRangeAt(0)
    
    // For text formatting commands (bold, italic, underline, strikethrough)
    if (command === 'bold' || command === 'italic' || command === 'underline' || command === 'strikeThrough') {
      if (!selection.isCollapsed) {
        // Apply to selected text
        try {
          const selectedText = range.extractContents()
          const wrapper = document.createElement('span')
          
          if (command === 'bold') {
            wrapper.style.fontWeight = 'bold'
          } else if (command === 'italic') {
            wrapper.style.fontStyle = 'italic'
          } else if (command === 'underline') {
            wrapper.style.textDecoration = 'underline'
          } else if (command === 'strikeThrough') {
            wrapper.style.textDecoration = 'line-through'
          }
          
          wrapper.appendChild(selectedText)
          range.insertNode(wrapper)
          
          // Move cursor after the formatted text
          const newRange = document.createRange()
          newRange.setStartAfter(wrapper)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } catch (e) {
          // Fallback to execCommand
          document.execCommand(command, false, value)
        }
      } else {
        // No selection - apply to current paragraph or use execCommand for next typed text
        document.execCommand(command, false, value)
      }
    } else {
      // For other commands, use execCommand
      document.execCommand(command, false, value)
    }
    
    editorRef.current?.focus()
    handleInput()
  }

  const handleFontChange = (font: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      
      if (!selection.isCollapsed) {
        // Apply to selected text
        const span = document.createElement('span')
        span.style.fontFamily = font
        try {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
          
          // Move cursor after the formatted text
          const newRange = document.createRange()
          newRange.setStartAfter(span)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } catch (e) {
          // Fallback to execCommand
          document.execCommand('fontName', false, font)
        }
      } else {
        // Apply to current paragraph
        let element = range.commonAncestorContainer as HTMLElement
        while (element && element !== editorRef.current) {
          if (element.tagName === 'P' || element.tagName === 'DIV') {
            element.style.fontFamily = font
            break
          }
          element = element.parentElement as HTMLElement
        }
        if (!element || element === editorRef.current) {
          document.execCommand('fontName', false, font)
        }
      }
    } else {
      document.execCommand('fontName', false, font)
    }
    
    setCurrentFont(font)
    setShowFontMenu(false)
    editorRef.current?.focus()
    handleInput()
    // Update UI immediately after applying font
    setTimeout(() => updateUIFromSelection(), 0)
  }

  const handleFontSizeChange = (size: number) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      
      if (!selection.isCollapsed) {
        // Apply to selected text
        const span = document.createElement('span')
        span.style.fontSize = `${size}px`
        try {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
          
          // Move cursor after the formatted text
          const newRange = document.createRange()
          newRange.setStartAfter(span)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } catch (e) {
          // Fallback to execCommand
          document.execCommand('fontSize', false, size.toString())
        }
      } else {
        // Apply to current paragraph
        let element = range.commonAncestorContainer as HTMLElement
        while (element && element !== editorRef.current) {
          if (element.tagName === 'P' || element.tagName === 'DIV') {
            element.style.fontSize = `${size}px`
            break
          }
          element = element.parentElement as HTMLElement
        }
        if (!element || element === editorRef.current) {
          document.execCommand('fontSize', false, size.toString())
        }
      }
    } else {
      document.execCommand('fontSize', false, size.toString())
    }
    
    setFontSize(size)
    setShowSizeMenu(false)
    editorRef.current?.focus()
    handleInput()
    // Update UI immediately after applying font size
    setTimeout(() => updateUIFromSelection(), 0)
  }

  const handleTextColorChange = (color: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      
      if (!selection.isCollapsed) {
        // Apply to selected text
        const span = document.createElement('span')
        span.style.color = color
        try {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
          
          // Move cursor after the formatted text
          const newRange = document.createRange()
          newRange.setStartAfter(span)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } catch (e) {
          // Fallback to execCommand
          document.execCommand('foreColor', false, color)
        }
      } else {
        // Apply to current paragraph
        let element = range.commonAncestorContainer as HTMLElement
        while (element && element !== editorRef.current) {
          if (element.tagName === 'P' || element.tagName === 'DIV') {
            element.style.color = color
            break
          }
          element = element.parentElement as HTMLElement
        }
        if (!element || element === editorRef.current) {
          document.execCommand('foreColor', false, color)
        }
      }
    } else {
      document.execCommand('foreColor', false, color)
    }
    
    setTextColor(color)
    editorRef.current?.focus()
    handleInput()
    // Update UI immediately after applying color
    setTimeout(() => updateUIFromSelection(), 0)
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
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      // Fallback to execCommand
      handleFormat('justify' + align.charAt(0).toUpperCase() + align.slice(1))
      return
    }

    const range = selection.getRangeAt(0)
    const alignValue = align.toLowerCase()
    let alignmentStyle: string
    
    if (alignValue === 'left') {
      alignmentStyle = 'left'
    } else if (alignValue === 'center') {
      alignmentStyle = 'center'
    } else if (alignValue === 'right') {
      alignmentStyle = 'right'
    } else if (alignValue === 'full') {
      alignmentStyle = 'justify'
    } else {
      alignmentStyle = 'left'
    }

    // Get all paragraphs/divs in the selection
    const selectedElements: HTMLElement[] = []
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const el = node as HTMLElement
          if ((el.tagName === 'P' || el.tagName === 'DIV') && range.intersectsNode(el)) {
            return NodeFilter.FILTER_ACCEPT
          }
          return NodeFilter.FILTER_SKIP
        }
      }
    )

    let node
    while (node = walker.nextNode()) {
      selectedElements.push(node as HTMLElement)
    }

    // If no paragraphs found, find the paragraph containing the cursor
    if (selectedElements.length === 0) {
      let element = range.commonAncestorContainer as HTMLElement
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement as HTMLElement
      }
      
      while (element && element !== editorRef.current) {
        if (element.tagName === 'P' || element.tagName === 'DIV') {
          selectedElements.push(element)
          break
        }
        element = element.parentElement as HTMLElement
      }
    }

    // Apply alignment to all selected paragraphs
    selectedElements.forEach(el => {
      el.style.textAlign = alignmentStyle
    })

    // If no elements found, use execCommand as fallback
    if (selectedElements.length === 0) {
      handleFormat('justify' + align.charAt(0).toUpperCase() + align.slice(1))
    } else {
      handleInput()
      editorRef.current?.focus()
    }
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

      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => {
          setIsFocused(true)
          // Update UI controls when editor is focused
          setTimeout(() => updateUIFromSelection(), 0)
        }}
        onBlur={() => setIsFocused(false)}
        onClick={() => {
          // Update UI controls when clicking in the editor
          setTimeout(() => updateUIFromSelection(), 0)
        }}
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
        [contenteditable] p,
        [contenteditable] div {
          margin: 0.5em 0;
          min-height: 1.5em;
        }
        [contenteditable] p:first-child,
        [contenteditable] div:first-child {
          margin-top: 0;
        }
        [contenteditable] p:last-child,
        [contenteditable] div:last-child {
          margin-bottom: 0;
        }
        [contenteditable] p:empty,
        [contenteditable] div:empty {
          min-height: 1.5em;
        }
        [contenteditable] p:empty:before,
        [contenteditable] div:empty:before {
          content: "\\200B";
          color: transparent;
        }
      `}</style>
    </div>
  )
}


