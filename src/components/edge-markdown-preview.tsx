'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import markdown from 'highlight.js/lib/languages/markdown'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ThemeType = 'light' | 'dark'

interface EdgeMarkdownPreviewProps {
  text: string
  className?: string
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

  // 如果没有标题，取第一行非空内容作为标题（最多 50 字符）
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      // 移除 Markdown 格式符号
      const cleanText = trimmed
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')

      return cleanText.length > 50 ? cleanText.slice(0, 50) + '...' : cleanText
    }
  }

  return null
}

// 带代码复制功能的 Markdown 预览（使用 React 渲染）
export function EdgeMarkdownPreviewWithCopy({ text, className }: EdgeMarkdownPreviewProps) {
  const { theme } = useTheme()
  const [mdTheme, setMdTheme] = useState<ThemeType>('light')
  const [codeBlocks, setCodeBlocks] = useState<Array<{ id: number; code: string; html: string; lang: string }>>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const md = useRef<MarkdownIt | null>(null)

  // 提取标题
  const title = useMemo(() => extractTitle(text), [text])

  // 注册语言
  useEffect(() => {
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
    hljs.registerLanguage('md', markdown)
    hljs.registerLanguage('markdown', markdown)
  }, [])

  // 解析文本，提取代码块
  useEffect(() => {
    if (!text) {
      setCodeBlocks([])
      return
    }

    // 找出所有代码块
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
  }, [text, mdTheme])

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
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setMdTheme('dark')
      } else {
        setMdTheme('light')
      }
    } else {
      setMdTheme(theme as ThemeType)
    }
  }, [theme])

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
                <div key={`code-${i}`} className="relative group my-3">
                  {/* 复制按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                    onClick={() => handleCopy(block.id, block.code)}
                  >
                    {copiedId === block.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <pre className={`hljs ${themeClass} rounded-lg p-4 pt-8 overflow-x-auto text-xs`}>
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
    <div className={className}>
      {/* 标题 */}
      {title && (
        <h3 className="text-base font-semibold mb-3 text-foreground border-b pb-2">
          {title}
        </h3>
      )}

      {/* Markdown 内容 */}
      <div className="edge-markdown text-sm">
        {renderContent()}
      </div>
    </div>
  )
}

export default EdgeMarkdownPreviewWithCopy
