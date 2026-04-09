'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, CopySlash, Mic, Scan, Image as ImageIcon, Link, FileCheck, CheckSquare, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import useEdgeModeStore from '@/stores/edge-mode'
import useMarkStore from '@/stores/mark'
import { Mark } from '@/db/marks'
import { useTranslations } from 'next-intl'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { LocalImage } from '@/components/local-image'
import { AudioPlayer } from '@/components/audio-player'
import { Textarea } from '@/components/ui/textarea'
import { getMarkTypeListBadgeClasses } from '@/app/core/main/mark/mark-type-meta'
import { getMarkListItemContent } from '@/app/core/main/mark/mark-list-item-content'
import { TodoItemContent } from '@/app/core/main/mark/todo-item-content'
import { MarkdownPreviewEdit } from '@/components/markdown-preview-edit'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window'
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import emitter from '@/lib/emitter'

dayjs.extend(relativeTime)

// 边缘模式对话框状态管理
let dialogOpenCount = 0
const dialogStateListeners = new Set<(count: number) => void>()

function notifyDialogStateChange(open: boolean) {
  if (open) {
    dialogOpenCount++
  } else {
    dialogOpenCount = Math.max(0, dialogOpenCount - 1)
  }
  dialogStateListeners.forEach(listener => listener(dialogOpenCount))
}

// 监听对话框打开/关闭事件
emitter.on('edge-dialog-open', () => notifyDialogStateChange(true))
emitter.on('edge-dialog-close', () => notifyDialogStateChange(false))

// 左侧拖拽调整面板宽度组件
const PanelResizeHandle = () => {
  const { setPanelWidth } = useEdgeModeStore()
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    // 从 store 获取当前宽度作为起始值
    const state = useEdgeModeStore.getState()
    startWidth.current = state.panelWidth
    currentWidth.current = state.panelWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      if (!isDragging.current) return

      const deltaX = startX.current - e.clientX
      const newWidth = Math.min(Math.max(startWidth.current + deltaX, 280), 600)

      if (newWidth !== currentWidth.current) {
        currentWidth.current = newWidth

        // 实时更新窗口大小
        try {
          const window = getCurrentWindow()
          const monitor = await primaryMonitor()
          if (monitor) {
            const screenHeight = monitor.size.height
            const panelHeight = Math.floor(screenHeight * 0.85)
            const panelX = monitor.size.width - newWidth
            const panelY = Math.floor((screenHeight - panelHeight) / 2)

            await window.setSize(new PhysicalSize(newWidth, panelHeight))
            await window.setPosition(new PhysicalPosition(panelX, panelY))
          }
        } catch (error) {
          console.error('Failed to resize panel:', error)
        }
      }
    }

    const handleMouseUp = async () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        // 只在拖拽结束时保存最终宽度
        if (currentWidth.current !== startWidth.current) {
          await setPanelWidth(currentWidth.current)
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setPanelWidth])

  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize group z-50"
      onMouseDown={handleMouseDown}
    >
      {/* 拖拽指示器 */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-primary/30 transition-colors" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex h-16 w-6 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex h-10 w-5 items-center justify-center rounded-r-lg border-l-2 border-y border-primary/50 bg-background/90 shadow-md">
          <GripVertical className="h-5 w-4 text-primary" />
        </div>
      </div>
    </div>
  )
}

// 便签列表项组件
const EdgeMarkItem = React.memo(({
  mark,
  isSelected,
  onClick
}: {
  mark: Mark
  isSelected: boolean
  onClick: () => void
}) => {
  const t = useTranslations('record.mark.type')
  const itemContent = useMemo(() => getMarkListItemContent(mark), [mark])

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-lg border p-3 transition-all duration-200
        ${isSelected
          ? 'border-primary/50 bg-primary/5 shadow-sm'
          : 'border-border/40 bg-background/50 hover:border-border hover:bg-accent/30'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <span className={getMarkTypeListBadgeClasses(mark.type, 'xs')}>
          {t(mark.type)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {itemContent.title || itemContent.preview || t(mark.type)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dayjs(mark.createdAt).fromNow()}
          </p>
        </div>
      </div>
    </motion.div>
  )
})
EdgeMarkItem.displayName = 'EdgeMarkItem'

// 便签详情组件
const EdgeMarkDetail = React.memo(({ mark }: { mark: Mark | null }) => {
  const t = useTranslations('record.mark')
  const typeT = useTranslations('record.mark.type')
  const { updateMark } = useMarkStore()
  const [content, setContent] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    if (mark) {
      setContent(mark.content || '')
      setDesc(mark.desc || '')
    }
  }, [mark])

  const handleDescChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDesc = e.target.value
    setDesc(newDesc)
    if (mark) {
      await updateMark({ ...mark, desc: newDesc })
    }
  }, [mark, updateMark])

  // 处理 Markdown 内容变化
  const handleContentChange = useCallback(async (newContent: string) => {
    setContent(newContent)
    if (mark) {
      await updateMark({ ...mark, content: newContent, desc: mark.type === 'text' ? newContent : desc })
    }
  }, [mark, desc, updateMark])

  if (!mark) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">选择一条便签查看详情</p>
      </div>
    )
  }

  const itemContent = getMarkListItemContent(mark)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <span className={getMarkTypeListBadgeClasses(mark.type, 'sm')}>
            {typeT(mark.type)}
          </span>
          <span className="text-xs text-muted-foreground">
            {dayjs(mark.createdAt).format('YYYY-MM-DD HH:mm')}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* 图片类型 */}
          {(mark.type === 'image' || mark.type === 'scan') && mark.url && (
            <div className="overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <LocalImage
                src={mark.url.includes('http') ? mark.url : `/${mark.type === 'scan' ? 'screenshot' : 'image'}/${mark.url}`}
                alt=""
                className="w-full object-contain"
              />
            </div>
          )}

          {/* 描述 */}
          {mark.type !== 'text' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t('desc')}</label>
              <Textarea
                value={desc}
                onChange={handleDescChange}
                placeholder="添加描述..."
                rows={2}
                className="resize-none"
              />
            </div>
          )}

          {/* 内容 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t('content')}</label>
            {mark.type === 'text' ? (
              <MarkdownPreviewEdit
                text={content}
                onTextChange={handleContentChange}
                maxHeight="300px"
                className="rounded-lg border bg-muted/30 p-3"
              />
            ) : mark.type === 'todo' ? (
              <TodoItemContent mark={mark} />
            ) : (
              <MarkdownPreviewEdit
                text={itemContent.preview || mark.content || ''}
                maxHeight="200px"
                showModeToggle={false}
                className="rounded-lg border bg-muted/30 p-3"
              />
            )}
          </div>

          {/* 链接 */}
          {mark.type === 'link' && mark.url && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <a
                href={mark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-blue-500 hover:underline"
              >
                {mark.url}
              </a>
            </div>
          )}

          {/* 录音 */}
          {mark.type === 'recording' && mark.url && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{typeT('recording')}</label>
              <AudioPlayer audioPath={mark.url} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
EdgeMarkDetail.displayName = 'EdgeMarkDetail'

// 工具栏按钮组件
const EdgeToolbarButton = React.memo(({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg"
        onClick={onClick}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
))
EdgeToolbarButton.displayName = 'EdgeToolbarButton'

// 磁吸条组件
const EdgeBar = ({ onHover }: { onHover: () => void }) => {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-l from-primary/30 via-primary/20 to-transparent cursor-pointer group"
      onMouseEnter={onHover}
    >
      {/* 装饰性指示器 */}
      <div className="flex flex-col gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <div className="w-1 h-8 rounded-full bg-primary/50" />
        <div className="w-1 h-8 rounded-full bg-primary/50" />
        <div className="w-1 h-8 rounded-full bg-primary/50" />
      </div>
    </div>
  )
}

// 主组件
export function EdgeModePanel() {
  const t = useTranslations()
  const {
    isEdgeMode,
    isPanelExpanded,
    expandPanel,
    collapsePanel,
    exitEdgeMode,
    selectedMarkId,
    setSelectedMarkId,
    innerPanelRatio,
    setInnerPanelRatio
  } = useEdgeModeStore()
  const { marks, fetchMarks } = useMarkStore()
  const [hasOpenDialog, setHasOpenDialog] = useState(false)

  // 监听对话框状态
  useEffect(() => {
    const listener = (count: number) => {
      setHasOpenDialog(count > 0)
    }
    dialogStateListeners.add(listener)
    return () => {
      dialogStateListeners.delete(listener)
    }
  }, [])

  // 获取选中的便签
  const selectedMark = useMemo(() =>
    marks.find(m => m.id === selectedMarkId) || null,
    [marks, selectedMarkId]
  )

  // 初始化加载数据
  useEffect(() => {
    if (isEdgeMode) {
      fetchMarks()
    }
  }, [isEdgeMode, fetchMarks])

  // 处理悬浮展开
  const handleHover = useCallback(() => {
    if (!isPanelExpanded) {
      expandPanel()
    }
  }, [isPanelExpanded, expandPanel])

  // 处理鼠标离开（收起面板）
  const handleMouseLeave = useCallback(() => {
    // 当有对话框打开时，不收缩面板
    if (hasOpenDialog) {
      return
    }
    if (isPanelExpanded) {
      collapsePanel()
      setSelectedMarkId(null)
    }
  }, [isPanelExpanded, collapsePanel, setSelectedMarkId, hasOpenDialog])

  // 处理恢复主界面
  const handleExpand = useCallback(async () => {
    await exitEdgeMode()
  }, [exitEdgeMode])

  if (!isEdgeMode) return null

  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-background">
        <AnimatePresence mode="wait">
          {!isPanelExpanded ? (
            // 磁吸条模式
            <motion.div
              key="bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <EdgeBar onHover={handleHover} />
            </motion.div>
          ) : (
            // 展开面板模式
            <motion.div
              key="panel"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full h-full bg-background border-l border-border shadow-2xl flex flex-col relative"
              onMouseLeave={handleMouseLeave}
            >
              {/* 左侧拖拽调整面板宽度 */}
              <PanelResizeHandle />
              {/* 顶部工具栏 */}
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-1">
                  {/* 快速记录按钮 */}
                  <EdgeToolbarButton
                    icon={<CopySlash className="size-4" />}
                    label={t('record.mark.type.text')}
                    onClick={() => emitter.emit('toolbar-shortcut-text')}
                  />
                  <EdgeToolbarButton
                    icon={<Mic className="size-4" />}
                    label={t('record.mark.type.recording')}
                    onClick={() => emitter.emit('toolbar-shortcut-recording')}
                  />
                  <EdgeToolbarButton
                    icon={<Scan className="size-4" />}
                    label={t('record.mark.type.scan')}
                    onClick={() => emitter.emit('toolbar-shortcut-scan')}
                  />
                  <EdgeToolbarButton
                    icon={<ImageIcon className="size-4" />}
                    label={t('record.mark.type.image')}
                    onClick={() => emitter.emit('toolbar-shortcut-image')}
                  />
                  <EdgeToolbarButton
                    icon={<Link className="size-4" />}
                    label={t('record.mark.type.link')}
                    onClick={() => emitter.emit('toolbar-shortcut-link')}
                  />
                  <EdgeToolbarButton
                    icon={<FileCheck className="size-4" />}
                    label={t('record.mark.type.file')}
                    onClick={() => emitter.emit('toolbar-shortcut-file')}
                  />
                  <EdgeToolbarButton
                    icon={<CheckSquare className="size-4" />}
                    label={t('record.mark.type.todo')}
                    onClick={() => emitter.emit('toolbar-shortcut-todo')}
                  />
                </div>

                {/* 右侧按钮 */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={handleExpand}
                      >
                        <Maximize2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('edgeMode.expandToMain')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* 二栏布局 - 可拖拽缩放 */}
              <ResizablePanelGroup
                direction="horizontal"
                className="flex-1"
                onLayout={(sizes) => {
                  // 保存左侧面板的比例
                  if (sizes[0] !== innerPanelRatio) {
                    setInnerPanelRatio(sizes[0])
                  }
                }}
              >
                {/* 左侧便签列表 */}
                <ResizablePanel defaultSize={innerPanelRatio} minSize={20} maxSize={50}>
                  <div className="h-full border-r flex flex-col">
                    <div className="px-3 py-2 border-b">
                      <h3 className="text-xs font-medium text-muted-foreground">
                        {t('edgeMode.markList')} ({marks.length})
                      </h3>
                    </div>
                    <ScrollArea className="flex-1 p-2">
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {marks.slice(0, 20).map((mark) => (
                            <EdgeMarkItem
                              key={mark.id}
                              mark={mark}
                              isSelected={selectedMarkId === mark.id}
                              onClick={() => setSelectedMarkId(mark.id)}
                            />
                          ))}
                        </AnimatePresence>
                        {marks.length === 0 && (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            {t('record.mark.empty.title')}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </ResizablePanel>

                {/* 拖拽手柄 */}
                <ResizableHandle withHandle />

                {/* 右侧详情 */}
                <ResizablePanel defaultSize={100 - innerPanelRatio} minSize={30}>
                  <div className="h-full overflow-hidden">
                    <EdgeMarkDetail mark={selectedMark} />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}

export default EdgeModePanel
