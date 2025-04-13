"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  PlusCircle,
  ChevronDown,
  ChevronRight,
  File,
  Hash,
  Trash,
  X,
  Plus,
  Search,
  Folder,
  FolderPlus,
  Save,
  AlertCircle,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

// 定义笔记类型
type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  notebookId: string
  timestamp: string
  preview?: string
  lastUpdated: number
}

// 定义标签类型
type Tag = {
  id: string
  name: string
}

// 定义笔记本类型
type Notebook = {
  id: string
  name: string
}

// 生成笔记预览
const generatePreview = (content: string, length = 60): string => {
  const plainText = content.replace(/#{1,6}\s/g, "").trim()
  return plainText.length > length ? plainText.substring(0, length) + "..." : plainText
}

// 更新时间戳
const updateTimestamp = (): string => {
  return "just now"
}

// 格式化日期
const formatDate = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  // 如果不到1分钟
  if (diff < 60 * 1000) {
    return "just now"
  }

  // 如果不到1小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  }

  // 如果不到24小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  }

  // 如果不到7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days} day${days > 1 ? "s" : ""} ago`
  }

  // 否则显示完整日期
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

// 自定义按钮组件
const CustomButton = ({
  children,
  onClick,
  variant = "default",
  className,
  ...props
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "default" | "outline" | "ghost" | "destructive"
  className?: string
  [key: string]: any
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-full transition-colors"
  const variantStyles = {
    default: "bg-black text-white hover:bg-gray-800",
    outline: "border border-gray-300 hover:bg-gray-100",
    ghost: "hover:bg-gray-100",
    destructive: "text-red-500 hover:bg-red-50 hover:text-red-600",
  }

  return (
    <button onClick={onClick} className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      {children}
    </button>
  )
}

export default function NotesApp() {
  // 所有可用标签
  const [availableTags, setAvailableTags] = useState<Tag[]>([])

  // 笔记本数据
  const [notebooks, setNotebooks] = useState<Notebook[]>([
    { id: "default", name: "默认笔记本" }
  ])

  // 笔记数据
  const [notes, setNotes] = useState<Note[]>([])

  const [selectedNote, setSelectedNote] = useState("")
  const [expandedSections, setExpandedSections] = useState({
    notebooks: true,
    tags: true,
  })

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [newTag, setNewTag] = useState("")

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"delete-note" | "new-notebook" | "delete-notebook">("delete-note")
  const [newNotebookName, setNewNotebookName] = useState("")
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null)

  // 自动保存计时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // 生成AI摘要和标签
  const [isGenerating, setIsGenerating] = useState(false)

  // 从localStorage加载数据
  useEffect(() => {
    const savedNotes = localStorage.getItem("notes")
    const savedTags = localStorage.getItem("tags")
    const savedNotebooks = localStorage.getItem("notebooks")
    const savedSelectedNote = localStorage.getItem("selectedNote")

    if (savedNotes) {
      setNotes(JSON.parse(savedNotes))
    }

    if (savedTags) {
      setAvailableTags(JSON.parse(savedTags))
    }

    if (savedNotebooks) {
      setNotebooks(JSON.parse(savedNotebooks))
    }

    if (savedSelectedNote) {
      setSelectedNote(savedSelectedNote)
    }
  }, [])

  // 保存数据到localStorage
  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(availableTags))
  }, [availableTags])

  useEffect(() => {
    localStorage.setItem("notebooks", JSON.stringify(notebooks))
  }, [notebooks])

  useEffect(() => {
    localStorage.setItem("selectedNote", selectedNote)
  }, [selectedNote])

  // 自动保存功能
  useEffect(() => {
    if (isEditing && editingNote) {
      // 清除之前的计时器
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      // 设置新的计时器，5秒后自动保存
      autoSaveTimerRef.current = setTimeout(() => {
        autoSave()
      }, 5000)
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [editingNote, isEditing])

  // 统计每个标签的使用次数
  const getTagCounts = () => {
    const counts: Record<string, number> = {}
    notes.forEach((note) => {
      note.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
    return counts
  }

  // 统计每个笔记本的笔记数量
  const getNotebookCounts = () => {
    const counts: Record<string, number> = {}
    notes.forEach((note) => {
      counts[note.notebookId] = (counts[note.notebookId] || 0) + 1
    })
    return counts
  }

  const tagCounts = getTagCounts()
  const notebookCounts = getNotebookCounts()

  // 过滤笔记
  const filteredNotes = notes
    .filter((note) => {
      // 如果有搜索查询
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
        )
      }

      // 如果有标签过滤
      if (activeFilter && activeFilter.startsWith("tag:")) {
        const tagName = activeFilter.substring(4)
        return note.tags.includes(tagName)
      }

      // 如果有笔记本过滤
      if (activeFilter && activeFilter.startsWith("notebook:")) {
        const notebookId = activeFilter.substring(9)
        return note.notebookId === notebookId
      }

      // 否则显示所有笔记
      return true
    })
    .sort((a, b) => b.lastUpdated - a.lastUpdated) // 按最后更新时间排序

  const toggleSection = (section: "notebooks" | "tags") => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    })
  }

  // 获取当前选中的笔记
  const currentNote = notes.find((note) => note.id === selectedNote) || {
    id: "",
    title: "新笔记",
    content: "",
    tags: [],
    notebookId: "default",
    timestamp: updateTimestamp(),
    preview: "",
    lastUpdated: Date.now(),
  }

  // 自动保存
  const autoSave = () => {
    if (!editingNote) return

    // 生成预览文本
    const preview = generatePreview(editingNote.content)

    // 更新时间戳和最后更新时间
    const now = Date.now()
    const updatedNote = {
      ...editingNote,
      preview,
      timestamp: updateTimestamp(),
      lastUpdated: now,
    }

    const updatedNotes = notes.map((note) => (note.id === updatedNote.id ? updatedNote : note))

    setNotes(updatedNotes)
    setLastSaved(`自动保存于 ${new Date().toLocaleTimeString()}`)

    // 不退出编辑模式，只更新编辑中的笔记
    setEditingNote(updatedNote)
  }

  // 开始编辑笔记
  const startEditing = () => {
    setEditingNote({ ...currentNote })
    setIsEditing(true)
    setLastSaved(null)
  }

  // 取消编辑
  const cancelEditing = () => {
    // 如果有未保存的更改，显示确认对话框
    if (JSON.stringify(currentNote) !== JSON.stringify(editingNote)) {
      if (window.confirm("您有未保存的更改，确定要放弃吗？")) {
        setIsEditing(false)
        setEditingNote(null)
        setLastSaved(null)
      }
    } else {
      setIsEditing(false)
      setEditingNote(null)
      setLastSaved(null)
    }
  }

  // 保存编辑后的笔记
  const saveNote = () => {
    if (!editingNote) return

    // 生成预览文本
    const preview = generatePreview(editingNote.content)

    // 更新时间戳和最后更新时间
    const now = Date.now()
    const updatedNote = {
      ...editingNote,
      preview,
      timestamp: updateTimestamp(),
      lastUpdated: now,
    }

    const updatedNotes = notes.map((note) => (note.id === updatedNote.id ? updatedNote : note))

    setNotes(updatedNotes)
    setIsEditing(false)
    setEditingNote(null)
    setLastSaved(null)

    // 更新标签系统 - 移除未使用的标签
    updateTagSystem()

    // 显示成功提示
    toast({
      title: "笔记已保存",
      description: "您的更改已成功保存。",
      duration: 3000,
    })
  }

  // 更新标签系统 - 检查并移除未使用的标签
  const updateTagSystem = () => {
    if (!editingNote) return

    // 获取所有笔记中使用的标签
    const usedTags = new Set<string>()

    // 添加当前编辑笔记的标签
    editingNote.tags.forEach((tag) => usedTags.add(tag))

    // 添加其他笔记的标签
    notes.forEach((note) => {
      if (note.id !== editingNote.id) {
        note.tags.forEach((tag) => usedTags.add(tag))
      }
    })

    // 过滤掉未使用的标签
    const updatedTags = availableTags.filter((tag) => usedTags.has(tag.name))

    setAvailableTags(updatedTags)
  }

  // 更新编辑中的笔记标题
  const updateNoteTitle = (title: string) => {
    if (!editingNote) return
    setEditingNote({ ...editingNote, title })
  }

  // 更新编辑中的笔记内容
  const updateNoteContent = (content: string) => {
    if (!editingNote) return
    setEditingNote({ ...editingNote, content })
  }

  // 更新编辑中的笔记所属笔记本
  const updateNoteNotebook = (notebookId: string) => {
    if (!editingNote) return
    setEditingNote({ ...editingNote, notebookId })
  }

  // 添加标签到编辑中的笔记
  const addTagToNote = (tag: string) => {
    if (!editingNote) return
    if (editingNote.tags.includes(tag)) return

    setEditingNote({
      ...editingNote,
      tags: [...editingNote.tags, tag],
    })
  }

  // 从编辑中的笔记移除标签
  const removeTagFromNote = (tag: string) => {
    if (!editingNote) return

    setEditingNote({
      ...editingNote,
      tags: editingNote.tags.filter((t) => t !== tag),
    })
  }

  // 添加新标签
  const addNewTag = () => {
    if (!newTag.trim() || availableTags.some((tag) => tag.name === newTag)) {
      setNewTag("")
      return
    }

    const newTagObj = {
      id: `tag-${Date.now()}`,
      name: newTag,
    }

    if (editingNote) {
      addTagToNote(newTag)
    }

    setNewTag("")
  }

  // 创建新笔记
  const createNewNote = () => {
    // 确定默认笔记本
    let defaultNotebookId = "default"
    if (activeFilter && activeFilter.startsWith("notebook:")) {
      defaultNotebookId = activeFilter.substring(9)
    }

    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: "新笔记",
      content: "",
      tags: [],
      notebookId: defaultNotebookId,
      timestamp: updateTimestamp(),
      preview: "",
      lastUpdated: Date.now(),
    }

    setNotes([newNote, ...notes])
    setSelectedNote(newNote.id)

    // 立即进入编辑模式
    setTimeout(() => {
      setEditingNote(newNote)
      setIsEditing(true)
    }, 100)

    // 显示成功提示
    toast({
      title: "已创建新笔记",
      description: "您可以开始编辑新笔记了。",
      duration: 3000,
    })
  }

  // 删除笔记
  const deleteNote = () => {
    setDialogType("delete-note")
    setDialogOpen(true)
  }

  // 确认删除笔记
  const confirmDeleteNote = () => {
    const updatedNotes = notes.filter((note) => note.id !== selectedNote)

    if (updatedNotes.length === 0) {
      // 如果删除后没有笔记，创建一个新的空笔记
      const emptyNote: Note = {
        id: `note-${Date.now()}`,
        title: "新笔记",
        content: "",
        tags: [],
        notebookId: "default",
        timestamp: updateTimestamp(),
        preview: "",
        lastUpdated: Date.now(),
      }
      setNotes([emptyNote])
      setSelectedNote(emptyNote.id)
    } else {
      setNotes(updatedNotes)
      setSelectedNote(updatedNotes[0].id)
    }

    setDialogOpen(false)

    // 更新标签系统
    const deletedNote = notes.find((note) => note.id === selectedNote)
    if (deletedNote) {
      const remainingNotes = notes.filter((note) => note.id !== selectedNote)
      updateTagsAfterNoteDeletion(deletedNote, remainingNotes)
    }

    // 显示成功提示
    toast({
      title: "笔记已删除",
      description: "笔记已成功删除。",
      duration: 3000,
    })
  }

  // 在删除笔记后更新标签
  const updateTagsAfterNoteDeletion = (deletedNote: Note, remainingNotes: Note[]) => {
    // 获取所有剩余笔记中使用的标签
    const usedTags = new Set<string>()

    remainingNotes.forEach((note) => {
      note.tags.forEach((tag) => usedTags.add(tag))
    })

    // 过滤掉未使用的标签
    const updatedTags = availableTags.filter((tag) => usedTags.has(tag.name))
    setAvailableTags(updatedTags)
  }

  // 创建新笔记本
  const createNewNotebook = () => {
    setDialogType("new-notebook")
    setNewNotebookName("")
    setDialogOpen(true)
  }

  // 确认创建新笔记本
  const confirmCreateNotebook = () => {
    if (!newNotebookName.trim()) {
      toast({
        title: "错误",
        description: "笔记本名称不能为空",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    // 检查是否已存在同名笔记本
    if (notebooks.some((nb) => nb.name === newNotebookName.trim())) {
      toast({
        title: "错误",
        description: "已存在同名笔记本",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const newNotebook: Notebook = {
      id: `notebook-${Date.now()}`,
      name: newNotebookName.trim(),
    }

    setNotebooks([...notebooks, newNotebook])
    setDialogOpen(false)

    // 显示成功提示
    toast({
      title: "笔记本已创建",
      description: `笔记本 "${newNotebookName}" 已成功创建。`,
      duration: 3000,
    })
  }

  // 删除笔记本
  const deleteNotebook = (notebookId: string) => {
    setDialogType("delete-notebook")
    setSelectedNotebook(notebookId)
    setDialogOpen(true)
  }

  // 确认删除笔记本
  const confirmDeleteNotebook = () => {
    if (!selectedNotebook) return

    // 检查是否有笔记使用此笔记本
    const notesInNotebook = notes.filter((note) => note.notebookId === selectedNotebook)

    // 更新这些笔记到默认笔记本
    const updatedNotes = notes.map((note) =>
      note.notebookId === selectedNotebook ? { ...note, notebookId: "default" } : note,
    )

    // 删除笔记本
    const updatedNotebooks = notebooks.filter((nb) => nb.id !== selectedNotebook)

    setNotes(updatedNotes)
    setNotebooks(updatedNotebooks)
    setDialogOpen(false)

    // 显示成功提示
    const notebookName = notebooks.find((nb) => nb.id === selectedNotebook)?.name || "笔记本"
    toast({
      title: "笔记本已删除",
      description: `笔记本 "${notebookName}" 已成功删除，其中的笔记已移至默认笔记本。`,
      duration: 3000,
    })
  }

  // 设置过滤器
  const setFilter = (type: "tag" | "notebook", id: string) => {
    if (type === "tag") {
      const tagName = availableTags.find((tag) => tag.id === id)?.name
      if (tagName) {
        setActiveFilter(`tag:${tagName}`)
        setSearchQuery("")
      }
    } else {
      setActiveFilter(`notebook:${id}`)
      setSearchQuery("")
    }
  }

  // 清除过滤器
  const clearFilter = () => {
    setActiveFilter(null)
    setSearchQuery("")
  }

  // 生成AI摘要和标签
  const generateAIContent = async () => {
    if (!currentNote.content) {
      console.log("错误：笔记内容为空");
      toast({
        title: "错误",
        description: "请先输入笔记内容",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    console.log("开始生成AI内容...");
    setIsGenerating(true)
    try {
      console.log("发送请求到AI服务...");
      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY}`
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-7B-Instruct",
          messages: [
            {
              role: "system",
              content: "你是一个专业的笔记助手。请根据用户提供的笔记内容生成一个简洁的摘要，并推荐3-5个相关的标签。请以JSON格式返回，格式如下：\n{\n  \"summary\": \"摘要内容\",\n  \"tags\": [\"标签1\", \"标签2\", \"标签3\"]\n}\n摘要应该突出笔记的主要观点和关键信息。标签应该是简洁的、相关的关键词。"
            },
            {
              role: "user",
              content: `请为以下笔记内容生成摘要和标签：\n\n${currentNote.content}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        console.error("AI服务响应错误:", response.status);
        throw new Error("生成失败")
      }

      const data = await response.json()
      console.log("收到AI响应:", data);
      const aiResponse = data.choices[0].message.content

      // 解析JSON响应
      let aiData;
      try {
        aiData = JSON.parse(aiResponse);
        console.log("解析后的AI数据:", aiData);
      } catch (error) {
        console.error("JSON解析错误:", error);
        throw new Error("AI响应格式错误");
      }

      const { summary, tags } = aiData;

      // 更新笔记内容，在顶部添加摘要
      if (isEditing && editingNote) {
        console.log("更新编辑中的笔记...");
        // 检查是否已经存在AI摘要部分
        const hasAISummary = editingNote.content.includes("## AI摘要");
        const updatedContent = hasAISummary
          ? editingNote.content.replace(/## AI摘要[\s\S]*?(?=## 笔记内容|$)/, `## AI摘要\n${summary}\n\n`)
          : `## AI摘要\n${summary}\n\n## 笔记内容\n${editingNote.content}`;

        setEditingNote({
          ...editingNote,
          content: updatedContent
        })

        // 添加新标签
        console.log("添加新标签...");
        tags.forEach((tag: string) => {
          if (!editingNote.tags.includes(tag)) {
            addTagToNote(tag)
          }
        })
      } else {
        console.log("创建新笔记...");
        const updatedContent = `## AI摘要\n${summary}\n\n## 笔记内容\n${currentNote.content}`
        startEditing()
        setEditingNote({
          ...currentNote,
          content: updatedContent,
          tags: [...currentNote.tags, ...tags.filter((tag: string) => !currentNote.tags.includes(tag))]
        })
      }

      console.log("生成完成");
      toast({
        title: "生成成功",
        description: "AI已生成摘要和标签",
        duration: 3000,
      })
    } catch (error) {
      console.error("生成过程中发生错误:", error);
      toast({
        title: "生成失败",
        description: "请稍后重试",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // 在 NotesApp 组件的开头添加一个新的 useEffect
  useEffect(() => {
    // 从所有笔记中收集标签
    const usedTags = new Set<string>()
    notes.forEach(note => {
      note.tags.forEach(tag => usedTags.add(tag))
    })

    // 创建或更新标签列表
    const updatedTags = Array.from(usedTags).map(tagName => {
      // 尝试找到现有的标签对象
      const existingTag = availableTags.find(t => t.name === tagName)
      return existingTag || { id: `tag-${Date.now()}-${tagName}`, name: tagName }
    })

    // 更新可用标签列表
    setAvailableTags(updatedTags)
  }, [notes]) // 当笔记发生变化时更新标签

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Left Sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-medium mb-4">笔记本</h1>
          <CustomButton onClick={createNewNote} className="w-full py-2 px-4 text-sm font-medium">
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>新建笔记</span>
          </CustomButton>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setActiveFilter(null)
              }}
              className="w-full pl-9 pr-3 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-3">
            <div className="mb-2">
              <button
                className={cn(
                  "flex items-center w-full px-3 py-2 rounded-full transition-colors text-sm",
                  activeFilter === null ? "bg-gray-100" : "hover:bg-gray-100",
                )}
                onClick={clearFilter}
              >
                <File className="h-4 w-4 mr-2" />
                <span>所有笔记</span>
                <span className="ml-auto text-xs text-gray-500">{notes.length}</span>
              </button>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  className="flex items-center text-gray-700 hover:text-gray-900"
                  onClick={() => toggleSection("notebooks")}
                >
                  {expandedSections.notebooks ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  <Folder className="h-4 w-4 mr-2" />
                  <span>笔记本</span>
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={createNewNotebook} className="p-1 rounded-full hover:bg-gray-100">
                        <FolderPlus className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>新建笔记本</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {expandedSections.notebooks && (
                <div className="ml-6 mt-1 space-y-1">
                  {notebooks.map((notebook) => (
                    <div key={notebook.id} className="flex items-center justify-between group">
                      <button
                        className={cn(
                          "flex items-center text-gray-600 hover:text-gray-900 py-1.5 px-3 rounded-full flex-grow transition-colors text-sm",
                          activeFilter === `notebook:${notebook.id}` && "bg-gray-100",
                        )}
                        onClick={() => setFilter("notebook", notebook.id)}
                      >
                        <span>{notebook.name}</span>
                        <span className="ml-2 text-xs text-gray-500">({notebookCounts[notebook.id] || 0})</span>
                      </button>
                      {notebook.id !== "default" && (
                        <button
                          onClick={() => deleteNotebook(notebook.id)}
                          className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-2">
              <button
                className="flex items-center text-gray-700 hover:text-gray-900 px-2 py-1"
                onClick={() => toggleSection("tags")}
              >
                {expandedSections.tags ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <Hash className="h-4 w-4 mr-2" />
                <span>标签</span>
              </button>

              {expandedSections.tags && (
                <div className="ml-6 mt-1 space-y-1">
                  {availableTags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between group">
                      <button
                        className={cn(
                          "flex items-center text-gray-600 hover:text-gray-900 py-1.5 px-3 rounded-full flex-grow transition-colors text-sm",
                          activeFilter === `tag:${tag.name}` && "bg-gray-100",
                        )}
                        onClick={() => setFilter("tag", tag.id)}
                      >
                        <span>{tag.name}</span>
                        <span className="ml-2 text-xs text-gray-500">({tagCounts[tag.name] || 0})</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section - Notes List */}
      <div className="w-72 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {activeFilter
              ? activeFilter.startsWith("tag:")
                ? `标签: ${activeFilter.substring(4)}`
                : `笔记本: ${notebooks.find((nb) => nb.id === activeFilter.substring(9))?.name || ""}`
              : searchQuery
                ? `搜索: ${searchQuery}`
                : "所有笔记"}
          </h2>
          {(activeFilter || searchQuery) && (
            <button onClick={clearFilter} className="p-1 rounded-full hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "p-4 border-b cursor-pointer transition-colors",
                  selectedNote === note.id ? "bg-gray-50" : "hover:bg-gray-50",
                )}
                onClick={() => setSelectedNote(note.id)}
              >
                <h3 className="font-medium">{note.title}</h3>
                {note.content && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {note.preview || generatePreview(note.content)}
                  </p>
                )}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap items-center mt-2 gap-1">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                        +{note.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <span className="ml-auto">{formatDate(note.lastUpdated)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-500">
              <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
              <p>没有找到匹配的笔记</p>
              <button
                onClick={clearFilter}
                className="mt-2 px-3 py-1 rounded-full text-sm bg-gray-100 hover:bg-gray-200"
              >
                清除过滤器
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Section - Note Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center p-4 border-b">
          <div className="flex space-x-2">
            <CustomButton 
              variant="outline" 
              className="flex items-center space-x-1 px-3 py-1.5 text-sm"
              onClick={generateAIContent}
              disabled={isGenerating}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 4V20M4 12H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{isGenerating ? "生成中..." : "AI 生成"}</span>
            </CustomButton>
            <CustomButton variant="outline" className="flex items-center space-x-1 px-3 py-1.5 text-sm">
              <Clock className="w-4 h-4" />
              <span>记忆</span>
            </CustomButton>
          </div>
          <div className="ml-4 font-medium">
            {isEditing ? (
              <input
                type="text"
                value={editingNote?.title || ""}
                onChange={(e) => updateNoteTitle(e.target.value)}
                className="border rounded-full px-3 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              />
            ) : (
              currentNote.title
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isEditing && lastSaved && <span className="text-xs text-gray-500">{lastSaved}</span>}
            {isEditing ? (
              <div className="flex space-x-2">
                <CustomButton variant="outline" onClick={cancelEditing} className="px-3 py-1.5 text-sm">
                  <X className="w-4 h-4 mr-1" />
                  <span>取消</span>
                </CustomButton>
                <CustomButton onClick={saveNote} className="px-3 py-1.5 text-sm">
                  <Save className="w-4 h-4 mr-1" />
                  <span>保存</span>
                </CustomButton>
              </div>
            ) : (
              <CustomButton variant="outline" onClick={startEditing} className="px-3 py-1.5 text-sm">
                <span>编辑</span>
              </CustomButton>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* 笔记本选择 (仅在编辑模式下显示) */}
          {isEditing && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">笔记本</label>
              <select
                value={editingNote?.notebookId || "default"}
                onChange={(e) => updateNoteNotebook(e.target.value)}
                className="w-full rounded-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              >
                {notebooks.map((notebook) => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 标签区域 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {isEditing ? (
              <>
                {editingNote?.tags.map((tag, index) => (
                  <div key={index} className="flex items-center px-3 py-1 rounded-full bg-gray-100">
                    <span>{tag}</span>
                    <button onClick={() => removeTagFromNote(tag)} className="ml-1 text-gray-500 hover:text-gray-700">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center">
                  <select
                    className="border rounded-full px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addTagToNote(e.target.value)
                        e.target.value = ""
                      }
                    }}
                  >
                    <option value="">添加标签...</option>
                    {availableTags
                      .filter((tag) => !editingNote?.tags.includes(tag.name))
                      .map((tag) => (
                        <option key={tag.id} value={tag.name}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex ml-2">
                    <input
                      type="text"
                      placeholder="新标签"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="w-24 text-sm rounded-l-full border border-r-0 px-3 py-1 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addNewTag()
                        }
                      }}
                    />
                    <button
                      onClick={addNewTag}
                      className="rounded-r-full border border-l-0 px-2 py-1 bg-gray-100 hover:bg-gray-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              currentNote.tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-gray-200"
                  onClick={() => setFilter("tag", availableTags.find((t) => t.name === tag)?.id || "")}
                >
                  {tag}
                </span>
              ))
            )}
          </div>

          {/* 笔记内容 */}
          {isEditing ? (
            <textarea
              value={editingNote?.content || ""}
              onChange={(e) => updateNoteContent(e.target.value)}
              className="w-full h-[calc(100%-120px)] border rounded-2xl p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
              placeholder="在此输入笔记内容..."
            />
          ) : (
            <div className="prose max-w-none">
              {currentNote.content ? (
                currentNote.content.split("\n\n").map((paragraph, index) => {
                  if (paragraph.startsWith("## ")) {
                    return (
                      <h2 key={index} className="mt-8">
                        {paragraph.substring(3)}
                      </h2>
                    )
                  } else {
                    return <p key={index}>{paragraph}</p>
                  }
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-sm text-gray-500">这个笔记还没有内容</p>
                  <CustomButton variant="outline" onClick={startEditing} className="mt-2 px-3 py-1.5 text-sm">
                    开始编辑
                  </CustomButton>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <CustomButton variant="destructive" onClick={deleteNote} className="px-3 py-1.5 text-sm">
            <Trash className="h-4 w-4 mr-2" />
            <span>删除</span>
          </CustomButton>
        </div>
      </div>

      {/* 对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {dialogType === "delete-note" && (
            <>
              <DialogHeader>
                <DialogTitle>删除笔记</DialogTitle>
                <DialogDescription>您确定要删除这个笔记吗？此操作无法撤销。</DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <CustomButton variant="outline" onClick={() => setDialogOpen(false)} className="px-3 py-1.5 text-sm">
                  取消
                </CustomButton>
                <CustomButton variant="destructive" onClick={confirmDeleteNote} className="px-3 py-1.5 text-sm">
                  删除
                </CustomButton>
              </DialogFooter>
            </>
          )}

          {dialogType === "new-notebook" && (
            <>
              <DialogHeader>
                <DialogTitle>新建笔记本</DialogTitle>
                <DialogDescription>创建一个新的笔记本来组织您的笔记。</DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="笔记本名称"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  className="w-full border rounded-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  autoFocus
                />
              </div>
              <DialogFooter className="mt-4">
                <CustomButton variant="outline" onClick={() => setDialogOpen(false)} className="px-3 py-1.5 text-sm">
                  取消
                </CustomButton>
                <CustomButton onClick={confirmCreateNotebook} className="px-3 py-1.5 text-sm">
                  创建
                </CustomButton>
              </DialogFooter>
            </>
          )}

          {dialogType === "delete-notebook" && (
            <>
              <DialogHeader>
                <DialogTitle>删除笔记本</DialogTitle>
                <DialogDescription>您确定要删除这个笔记本吗？笔记本中的笔记将被移动到默认笔记本。</DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <CustomButton variant="outline" onClick={() => setDialogOpen(false)} className="px-3 py-1.5 text-sm">
                  取消
                </CustomButton>
                <CustomButton variant="destructive" onClick={confirmDeleteNotebook} className="px-3 py-1.5 text-sm">
                  删除
                </CustomButton>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 提示消息 */}
      <Toaster />
    </div>
  )
}
