import { create } from 'zustand'
import { Store } from '@tauri-apps/plugin-store'
import { getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window'
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'

// 边缘模式窗口尺寸
const EDGE_BAR_WIDTH = 1 // 磁吸条宽度
const DEFAULT_PANEL_WIDTH = 380 // 默认展开面板宽度
const MIN_PANEL_WIDTH = 280 // 最小面板宽度
const MAX_PANEL_WIDTH = 600 // 最大面板宽度
const EDGE_PANEL_HEIGHT_RATIO = 1 // 面板高度占屏幕比例

interface WindowSize {
  width: number
  height: number
}

interface WindowPosition {
  x: number
  y: number
}

interface EdgeModeState {
  // 边缘速记模式是否激活
  isEdgeMode: boolean
  isPanelExpanded: boolean
  setEdgeMode: (mode: boolean) => Promise<void>
  toggleEdgeMode: () => Promise<void>
  setPanelExpanded: (expanded: boolean) => void

  // 保存的窗口状态
  savedWindowSize: WindowSize | null
  savedWindowPosition: WindowPosition | null

  // 面板宽度记忆
  panelWidth: number
  setPanelWidth: (width: number) => Promise<void>

  // 内部两栏布局比例记忆
  innerPanelRatio: number
  setInnerPanelRatio: (ratio: number) => Promise<void>

  // 当前选中的便签 ID
  selectedMarkId: number | null
  setSelectedMarkId: (id: number | null) => void

  // 初始化
  initEdgeMode: () => Promise<void>

  // 窗口控制
  enterEdgeMode: () => Promise<void>
  exitEdgeMode: () => Promise<void>
  expandPanel: () => Promise<void>
  collapsePanel: () => Promise<void>
}

export const useEdgeModeStore = create<EdgeModeState>((set, get) => ({
  isEdgeMode: false,
  isPanelExpanded: false,

  setEdgeMode: async (mode: boolean) => {
    set({ isEdgeMode: mode })
    if (!mode) {
      set({ selectedMarkId: null, isPanelExpanded: false })
    }
    try {
      const store = await Store.load('store.json')
      await store.set('edgeMode', mode)
      await store.save()
    } catch (error) {
      console.error('Failed to save edge mode:', error)
    }
  },

  toggleEdgeMode: async () => {
    const { isEdgeMode, enterEdgeMode, exitEdgeMode } = get()
    if (isEdgeMode) {
      await exitEdgeMode()
    } else {
      await enterEdgeMode()
    }
  },

  setPanelExpanded: (expanded: boolean) => {
    set({ isPanelExpanded: expanded })
  },

  selectedMarkId: null,
  setSelectedMarkId: (id: number | null) => {
    set({ selectedMarkId: id })
  },

  savedWindowSize: null,
  savedWindowPosition: null,

  // 面板宽度记忆
  panelWidth: DEFAULT_PANEL_WIDTH,
  setPanelWidth: async (width: number) => {
    const clampedWidth = Math.min(Math.max(width, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH)
    set({ panelWidth: clampedWidth })
    try {
      const store = await Store.load('store.json')
      await store.set('edgePanelWidth', clampedWidth)
      await store.save()
    } catch (error) {
      console.error('Failed to save panel width:', error)
    }
  },

  // 内部两栏布局比例记忆
  innerPanelRatio: 35,
  setInnerPanelRatio: async (ratio: number) => {
    const clampedRatio = Math.min(Math.max(ratio, 20), 50)
    set({ innerPanelRatio: clampedRatio })
    try {
      const store = await Store.load('store.json')
      await store.set('edgeInnerPanelRatio', clampedRatio)
      await store.save()
    } catch (error) {
      console.error('Failed to save inner panel ratio:', error)
    }
  },

  initEdgeMode: async () => {
    try {
      const store = await Store.load('store.json')
      const savedMode = await store.get<boolean>('edgeMode')
      // 加载保存的面板宽度
      const savedWidth = await store.get<number>('edgePanelWidth')
      if (savedWidth !== null && savedWidth !== undefined) {
        set({ panelWidth: savedWidth })
      }
      // 加载保存的内部两栏布局比例
      const savedRatio = await store.get<number>('edgeInnerPanelRatio')
      if (savedRatio !== null && savedRatio !== undefined) {
        set({ innerPanelRatio: savedRatio })
      }

      if (savedMode === true) {
        // 如果之前处于边缘模式，需要重新进入边缘模式
        // 因为窗口大小可能已经被重置
        set({ isEdgeMode: true })
        // 延迟执行窗口调整，确保 UI 已渲染
        setTimeout(() => {
          get().enterEdgeMode()
        }, 100)
      }
    } catch (error) {
      console.error('Failed to load edge mode:', error)
    }
  },

  enterEdgeMode: async () => {
    try {
      const window = getCurrentWindow()

      // 保存当前窗口状态
      const currentSize = await window.innerSize()
      const currentPosition = await window.outerPosition()

      set({
        savedWindowSize: { width: currentSize.width, height: currentSize.height },
        savedWindowPosition: { x: currentPosition.x, y: currentPosition.y }
      })

      // 获取主显示器信息
      const monitor = await primaryMonitor()
      if (!monitor) {
        console.error('No primary monitor found')
        return
      }

      const { width: screenWidth, height: screenHeight } = monitor.size

      // 计算边缘条位置（屏幕最右侧）
      const barX = screenWidth - EDGE_BAR_WIDTH
      const barY = Math.floor((screenHeight - screenHeight * EDGE_PANEL_HEIGHT_RATIO) / 2)
      const barHeight = Math.floor(screenHeight * EDGE_PANEL_HEIGHT_RATIO)

      // 设置窗口为边缘条模式
      await window.setSize(new PhysicalSize(EDGE_BAR_WIDTH, barHeight))
      await window.setPosition(new PhysicalPosition(barX, barY))
      await window.setAlwaysOnTop(true)

      await get().setEdgeMode(true)
      set({ isPanelExpanded: false })
    } catch (error) {
      console.error('Failed to enter edge mode:', error)
    }
  },

  exitEdgeMode: async () => {
    try {
      const window = getCurrentWindow()
      const { savedWindowSize, savedWindowPosition } = get()

      // 恢复窗口状态
      if (savedWindowSize && savedWindowPosition) {
        await window.setSize(new PhysicalSize(savedWindowSize.width, savedWindowSize.height))
        await window.setPosition(new PhysicalPosition(savedWindowPosition.x, savedWindowPosition.y))
      } else {
        // 如果没有保存的窗口状态，使用默认值
        const monitor = await primaryMonitor()
        if (monitor) {
          const defaultWidth = Math.floor(monitor.size.width * 0.8)
          const defaultHeight = Math.floor(monitor.size.height * 0.8)
          const defaultX = Math.floor((monitor.size.width - defaultWidth) / 2)
          const defaultY = Math.floor((monitor.size.height - defaultHeight) / 2)
          await window.setSize(new PhysicalSize(defaultWidth, defaultHeight))
          await window.setPosition(new PhysicalPosition(defaultX, defaultY))
        }
      }

      await window.setAlwaysOnTop(false)
      await get().setEdgeMode(false)
    } catch (error) {
      console.error('Failed to exit edge mode:', error)
    }
  },

  expandPanel: async () => {
    try {
      const window = getCurrentWindow()
      const monitor = await primaryMonitor()
      if (!monitor) return

      const { width: screenWidth, height: screenHeight } = monitor.size
      const { panelWidth } = get()
      const panelHeight = Math.floor(screenHeight * EDGE_PANEL_HEIGHT_RATIO)
      const panelX = screenWidth - panelWidth
      const panelY = Math.floor((screenHeight - panelHeight) / 2)

      await window.setSize(new PhysicalSize(panelWidth, panelHeight))
      await window.setPosition(new PhysicalPosition(panelX, panelY))

      set({ isPanelExpanded: true })
    } catch (error) {
      console.error('Failed to expand panel:', error)
    }
  },

  collapsePanel: async () => {
    try {
      const window = getCurrentWindow()
      const monitor = await primaryMonitor()
      if (!monitor) return

      const { width: screenWidth, height: screenHeight } = monitor.size
      const barHeight = Math.floor(screenHeight * EDGE_PANEL_HEIGHT_RATIO)
      const barX = screenWidth - EDGE_BAR_WIDTH
      const barY = Math.floor((screenHeight - barHeight) / 2)

      await window.setSize(new PhysicalSize(EDGE_BAR_WIDTH, barHeight))
      await window.setPosition(new PhysicalPosition(barX, barY))

      set({ isPanelExpanded: false })
    } catch (error) {
      console.error('Failed to collapse panel:', error)
    }
  },
}))

export default useEdgeModeStore
