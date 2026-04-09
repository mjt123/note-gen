'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
import MarkdownIt from 'markdown-it'
import katex from '@traptitech/markdown-it-katex'
import 'katex/dist/katex.min.css'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdownLang from 'highlight.js/lib/languages/markdown'
import { Copy, Check, Pencil, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type ThemeType = 'light' | 'dark'

interface MarkdownPreviewEditProps {
  text: string
  className?: string
  onTextChange?: (text: string) => void
  defaultMode?: 'preview' | 'edit'
  showModeToggle?: boolean
  textSize?: string
  maxHeight?: string
}

// 从 Markdown 文本中提取标题
function extractTitle(text: string): string | null {
  if (!text) return null

  const lines = text.split('\n')

  // 查找第一个 # 标题
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

// 注册语言（只执行一次）
let languagesRegistered = false
function registerLanguages() {
  if (languagesRegistered) return
  languagesRegistered = true

  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('typescript', typescript)
  hljs.registerLanguage('bash', bash)
  hljs.registerLanguage('shell', bash)
  hljs.registerLanguage('python', python)
  hljs.registerLanguage('json', json)
  hljs.registerLanguage('html', xml)
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('rust', rust)
  hljs.registerLanguage('go', go)
  hljs.registerLanguage('sql', sql)
  hljs.registerLanguage('yaml', yaml)
  hljs.registerLanguage('md', markdownLang)
  hljs.registerLanguage('markdown', markdownLang)
}

/**
 * Markdown 预览/编辑组件
 * 支持双击切换预览/编辑模式
 */
export function MarkdownPreviewEdit({
  text,
  className = '',
  onTextChange,
  defaultMode = 'preview',
  showModeToggle = true,
  textSize = 'sm',
  maxHeight = '400px'
}: MarkdownPreviewEditProps) {
  const { theme } = useTheme()
  const [mdTheme, setMdTheme] = useState<ThemeType>('light')
  const [mode, setMode] = useState<'preview' | 'edit'>(defaultMode)
  const [editText, setEditText] = useState(text)
  const [codeBlocks, setCodeBlocks] = useState<Array<{ id: number; code: string; html: string; lang: string }>>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const md = useRef<MarkdownIt | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 提取标题
  const title = useMemo(() => extractTitle(text), [text])

  // 注册语言
  useEffect(() => {
    registerLanguages()
  }, [])

  // 同步外部文本变化
  useEffect(() => {
    setEditText(text)
  }, [text])

  // 初始化 Markdown 解析器
  useEffect(() => {
    md.current = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang): string {
        if (lang && hljs.getLanguage(lang)) {
          try {
            const themeClass = mdTheme === 'dark' ? 'hljs-dark' : 'hljs-light'
            return `<pre class="hljs ${themeClass}"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
          } catch {}
        }
        const themeClass = mdTheme === 'dark' ? 'hljs-dark' : 'hljs-light'
        return `<pre class="hljs ${themeClass}"><code>${md.current ? md.current.utils.escapeHtml(str) : str}</code></pre>`
      }
    }).use(katex, {
      throwOnError: false,
      errorColor: '#cc0000'
    })

    md.current.renderer.rules.link_open = function (tokens, idx, options, _env, self) {
      tokens[idx].attrSet('target', '_blank')
      tokens[idx].attrSet('rel', 'noopener noreferrer')
      return self.renderToken(tokens, idx, options)
    }
  }, [mdTheme])

  // 监听主题变化
  useEffect(() => {
    if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setMdTheme('dark')
      } else {
        setMdTheme('light')
      }
    } else {
      setMdTheme(theme as ThemeType)
    }
  }, [theme])

  // 解析文本，提取代码块
  useEffect(() => {
    if (!text) {
      setCodeBlocks([])
      return
    }

    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    const blocks: Array<{ id: number; code: string; html: string; lang: string }> = []
    let match
    let id = 0

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const lang = match[1] || 'text'
      const code = match[2]

      let html = code
      if (lang && hljs.getLanguage(lang)) {
        try {
          html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch {}
      }

      blocks.push({ id: id++, code, html, lang })
    }

    setCodeBlocks(blocks)
  }, [text])

  // 处理复制
  const handleCopy = useCallback(async (id: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  // 双击切换模式
  const handleDoubleClick = useCallback(() => {
    if (mode === 'preview') {
      setMode('edit')
      setEditText(text)
      // 延迟聚焦，确保 textarea 已渲染
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [mode, text])

  // 处理文本变化
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value)
  }, [])

  // 保存并切换到预览
  const handleSaveAndPreview = useCallback(() => {
    if (onTextChange && editText !== text) {
      onTextChange(editText)
    }
    setMode('preview')
  }, [editText, text, onTextChange])

  // 按 Escape 键切换到预览模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'edit') {
        handleSaveAndPreview()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, handleSaveAndPreview])

  if (!text || !text.trim()) {
    return null
  }

  const getThemeClass = () => {
    return mdTheme === 'dark' ? 'markdown-body markdown-dark' : 'markdown-body'
  }

  // 渲染带复制按钮的代码块
  const renderContent = () => {
    if (!md.current) return null

    let processedText = text
    let index = 0

    // 替换代码块为占位符
    processedText = processedText.replace(/```(\w*)\n[\s\S]*?```/g, () => {
      return `__CODE_BLOCK_${index++}__`
    })

    const parts = processedText.split(/(__CODE_BLOCK_\d+__)/g)
    const codeBlocksCopy = [...codeBlocks]

    return (
      <>
        {parts.map((part, i) => {
          const codeMatch = part.match(/__CODE_BLOCK_(\d+)__/)
          if (codeMatch) {
            const blockIndex = parseInt(codeMatch[1])
            const block = codeBlocksCopy[blockIndex]
            if (block) {
              const themeClass = mdTheme === 'dark' ? 'hljs-dark' : 'hljs-light'
              return (
                <div key={`code-${i}`} className="relative group my-2">
                  {/* 复制按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                    onClick={() => handleCopy(block.id, block.code)}
                  >
                    {copiedId === block.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <pre className={`hljs ${themeClass} rounded-md p-3 pt-8 overflow-x-auto text-xs`}>
                    <code dangerouslySetInnerHTML={{ __html: block.html }} />
                  </pre>
                </div>
              )
            }
          }

          // 渲染普通 Markdown
          if (part.trim()) {
            return (
              <div
                key={`text-${i}`}
                className={getThemeClass()}
                dangerouslySetInnerHTML={{ __html: md.current!.render(part) }}
              />
            )
          }

          return null
        })}
      </>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* 模式切换按钮 */}
      {showModeToggle && (
        <div className="absolute top-1 right-1 z-10 flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 transition-opacity ${mode === 'edit' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={mode === 'preview' ? handleDoubleClick : handleSaveAndPreview}
                >
                  {mode === 'preview' ? (
                    <Pencil className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{mode === 'preview' ? '双击编辑' : '预览'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <AnimatePresence mode="wait">
        {mode === 'preview' ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="group cursor-text"
            onDoubleClick={handleDoubleClick}
          >
            {/* 标题 */}
            {title && (
              <h3 className="text-base font-semibold mb-2 text-foreground border-b pb-1.5">
                {title}
              </h3>
            )}

            {/* Markdown 内容 */}
            <div
              className={`markdown-preview text-${textSize} overflow-auto`}
              style={{ maxHeight }}
            >
              {renderContent()}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-2"
          >
            <Textarea
              ref={textareaRef}
              value={editText}
              onChange={handleTextChange}
              onBlur={handleSaveAndPreview}
              placeholder="输入 Markdown 内容..."
              className={`min-h-[120px] resize-none text-${textSize}`}
              style={{ maxHeight }}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>按 Esc 保存并返回预览</span>
              <Button size="sm" variant="outline" onClick={handleSaveAndPreview}>
                保存
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MarkdownPreviewEdit
