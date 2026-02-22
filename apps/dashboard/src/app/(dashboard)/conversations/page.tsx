"use client"

import { useState, useRef, useEffect, useReducer } from "react"
import { Bot, Check, CheckCheck, FlaskConical, Loader2, MessageSquare, User, Phone, Send, AlertCircle, X, FileText, Clock, Paperclip, ImageIcon, Mic, Plus, Minus } from "lucide-react"
import { ToolCallBubble, ToolResultBubble } from "@/components/chat/tool-bubbles"
import {
  useThreadsWithPreviews,
  useThreadWithMessages,
  useReplyToThread,
  useWhatsAppMessageStatuses,
  useWhatsAppTimeline,
  useWhatsAppConnections,
  useListWhatsAppTemplates,
  useSendWhatsAppTemplate,
  useSendWhatsAppMedia,
  useSendWhatsAppInteractive,
  useGenerateUploadUrl,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { useRoleContext } from "@/contexts/role-context"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

function formatRelativeTime(timestamp: number) {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str
  return str.slice(0, max) + "..."
}

function formatPhoneNumber(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "")
  if (cleaned.startsWith("+") && cleaned.length >= 11) {
    const cc = cleaned.slice(1, cleaned.length - 10)
    const area = cleaned.slice(-10, -7)
    const mid = cleaned.slice(-7, -4)
    const last = cleaned.slice(-4)
    return `+${cc} (${area}) ${mid}-${last}`
  }
  return phone
}

function MessageStatus({ status }: { status?: string }) {
  if (!status) return null
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 text-content-tertiary" />
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-content-tertiary" />
    case "read":
      return <CheckCheck className="h-3 w-3 text-ocean" />
    case "failed":
      return <X className="h-3 w-3 text-destructive" />
    default:
      return null
  }
}

function WindowIndicator({ lastInboundAt }: { lastInboundAt?: number }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  if (!lastInboundAt) return null

  const remaining = lastInboundAt + TWENTY_FOUR_HOURS - Date.now()
  const isOpen = remaining > 0
  const hoursRemaining = Math.max(0, Math.floor(remaining / 3600000))
  const minutesRemaining = Math.max(0, Math.floor((remaining % 3600000) / 60000))

  if (isOpen) {
    return (
      <Badge variant="success" className="text-[10px] gap-1">
        <Clock className="h-2.5 w-2.5" />
        Window open ({hoursRemaining}h {minutesRemaining}m)
      </Badge>
    )
  }

  return (
    <Badge variant="warning" className="text-[10px] gap-1">
      <Clock className="h-2.5 w-2.5" />
      Window expired
    </Badge>
  )
}

type TemplateItem = {
  name: string
  language: string
  category?: string
  components?: Array<{ type: string; text?: string; parameters?: Array<{ type: string }> }>
}

type TemplateState = {
  templates: TemplateItem[]
  loading: boolean
  error: string | null
  selectedTemplate: TemplateItem | null
  paramValues: Record<string, string>
  sending: boolean
}

type TemplateAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; templates: TemplateItem[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SELECT"; template: TemplateItem }
  | { type: "DESELECT" }
  | { type: "SET_PARAM"; key: string; value: string }
  | { type: "SEND_START" }
  | { type: "SEND_SUCCESS" }
  | { type: "SEND_ERROR"; error: string }

const templateInitialState: TemplateState = {
  templates: [],
  loading: false,
  error: null,
  selectedTemplate: null,
  paramValues: {},
  sending: false,
}

function templateReducer(state: TemplateState, action: TemplateAction): TemplateState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null }
    case "LOAD_SUCCESS":
      return { ...state, loading: false, templates: action.templates }
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error }
    case "SELECT":
      return { ...state, selectedTemplate: action.template, paramValues: {} }
    case "DESELECT":
      return { ...state, selectedTemplate: null, paramValues: {} }
    case "SET_PARAM":
      return { ...state, paramValues: { ...state.paramValues, [action.key]: action.value } }
    case "SEND_START":
      return { ...state, sending: true }
    case "SEND_SUCCESS":
      return { ...state, sending: false, selectedTemplate: null, paramValues: {} }
    case "SEND_ERROR":
      return { ...state, sending: false, error: action.error }
    default:
      return state
  }
}

function TemplatePicker({
  open,
  onOpenChange,
  onSend,
  connectionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (templateName: string, language: string, components?: unknown[]) => Promise<void>
  connectionId?: Id<"whatsappConnections">
}) {
  const { environment } = useEnvironment()
  const listTemplates = useListWhatsAppTemplates()
  const [state, dispatch] = useReducer(templateReducer, templateInitialState)
  const { templates, loading, error, selectedTemplate, paramValues, sending } = state

  useEffect(() => {
    if (open && templates.length === 0 && connectionId) {
      dispatch({ type: "LOAD_START" })
      listTemplates({ environment, connectionId })
        .then((result: any) => {
          const data = result?.data ?? result ?? []
          dispatch({ type: "LOAD_SUCCESS", templates: Array.isArray(data) ? data : [] })
        })
        .catch((err: Error) => dispatch({ type: "LOAD_ERROR", error: err.message }))
    }
  }, [open])

  const bodyComponent = selectedTemplate?.components?.find((c) => c.type === "BODY")
  const bodyText = bodyComponent?.text ?? ""
  const paramCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length

  const handleSend = async () => {
    if (!selectedTemplate) return
    dispatch({ type: "SEND_START" })
    try {
      const components: unknown[] = []
      if (paramCount > 0) {
        components.push({
          type: "body",
          parameters: Array.from({ length: paramCount }, (_, i) => ({
            type: "text",
            text: paramValues[`${i + 1}`] || "",
          })),
        })
      }
      await onSend(selectedTemplate.name, selectedTemplate.language, components.length > 0 ? components : undefined)
      onOpenChange(false)
      dispatch({ type: "SEND_SUCCESS" })
    } catch (err) {
      dispatch({ type: "SEND_ERROR", error: err instanceof Error ? err.message : "Failed to send template" })
    }
  }

  let previewText = bodyText
  for (let i = 1; i <= paramCount; i++) {
    previewText = previewText.replace(`{{${i}}}`, paramValues[`${i}`] || `{{${i}}}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Template Message</DialogTitle>
          <DialogDescription>
            Select an approved template to re-engage the customer
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !selectedTemplate && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {templates.length === 0 && !error && (
              <p className="text-sm text-content-secondary text-center py-4">No templates found</p>
            )}
            {templates.map((template) => (
              <button
                key={`${template.name}-${template.language}`}
                type="button"
                onClick={() => dispatch({ type: "SELECT", template })}
                className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-background-tertiary transition-colors ease-out-soft"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-content-primary">{template.name}</span>
                  <div className="flex items-center gap-2">
                    {template.category && (
                      <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">{template.language}</Badge>
                  </div>
                </div>
                {template.components?.find((c) => c.type === "BODY")?.text && (
                  <p className="text-xs text-content-secondary truncate">
                    {template.components.find((c) => c.type === "BODY")!.text}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => dispatch({ type: "DESELECT" })}
                className="text-xs text-content-secondary hover:text-content-primary"
              >
                &larr; Back to templates
              </button>
              <Badge variant="secondary" className="text-[10px]">{selectedTemplate.language}</Badge>
            </div>

            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <p className="text-sm text-content-primary whitespace-pre-wrap">{previewText}</p>
            </div>

            {paramCount > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-content-secondary font-medium">Parameters</p>
                {Array.from({ length: paramCount }, (_, i) => (
                  <Input
                    key={`param-${i + 1}`}
                    placeholder={`Parameter {{${i + 1}}}`}
                    value={paramValues[`${i + 1}`] ?? ""}
                    onChange={(e) => dispatch({ type: "SET_PARAM", key: `${i + 1}`, value: e.target.value })}
                    className="text-sm"
                  />
                ))}
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || (paramCount > 0 && Object.values(paramValues).some((v) => !v.trim()))}
              className="w-full"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type TimelineEntry = {
  id: string
  direction: "inbound" | "outbound"
  type?: string
  text?: string
  mediaUrl?: string | null
  mediaMimeType?: string
  mediaCaption?: string
  mediaFileName?: string
  interactiveData?: any
  status: string
  createdAt: number
}

function WhatsAppBubble({ entry }: { entry: TimelineEntry }) {
  const isOutbound = entry.direction === "outbound"
  const [imageOpen, setImageOpen] = useState(false)

  const renderMedia = () => {
    if ((entry.type === "image" || entry.type === "video") && entry.mediaUrl) {
      return (
        <div className="mb-1">
          <img
            src={entry.mediaUrl}
            alt={entry.mediaCaption ?? "Image"}
            className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity ease-out-soft"
            onClick={() => setImageOpen(true)}
          />
          {imageOpen && (
            <Dialog open={imageOpen} onOpenChange={setImageOpen}>
              <DialogContent className="max-w-3xl p-0 overflow-hidden">
                <img src={entry.mediaUrl} alt={entry.mediaCaption ?? "Image"} className="w-full h-auto" />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )
    }

    if ((entry.type === "image" || entry.type === "video") && !entry.mediaUrl) {
      return (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
          <span className="text-xs text-content-tertiary">Downloading {entry.type}...</span>
        </div>
      )
    }

    if (entry.type === "audio" && entry.mediaUrl) {
      return (
        <div className="mb-1 min-w-[200px]">
          <audio controls className="w-full h-8" preload="metadata">
            <source src={entry.mediaUrl} type={entry.mediaMimeType ?? "audio/ogg"} />
          </audio>
        </div>
      )
    }

    if (entry.type === "audio" && !entry.mediaUrl) {
      return (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
          <span className="text-xs text-content-tertiary">Downloading audio...</span>
        </div>
      )
    }

    if (entry.type === "document" && entry.mediaUrl) {
      return (
        <a
          href={entry.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 py-2 px-3 bg-black/10 rounded-lg mb-1 hover:bg-black/20 transition-colors ease-out-soft"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="text-sm truncate">{entry.mediaFileName ?? "Document"}</span>
        </a>
      )
    }

    return null
  }

  const renderInteractive = () => {
    if (!entry.interactiveData) return null

    if (isOutbound) {
      const buttons = (entry.interactiveData as any)?.action?.buttons
      if (buttons && Array.isArray(buttons)) {
        return (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {buttons.map((btn: any, i: number) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-success/30 text-success">
                {btn.reply?.title ?? btn.title ?? "Button"}
              </span>
            ))}
          </div>
        )
      }
    }

    if (!isOutbound) {
      const ir = entry.interactiveData as Record<string, any>
      if (ir.button_reply) {
        return (
          <div className="mt-1">
            <Badge variant="outline" className="text-[10px]">Button reply</Badge>
          </div>
        )
      }
      if (ir.list_reply) {
        return (
          <div className="mt-1">
            <Badge variant="outline" className="text-[10px]">List selection</Badge>
            {ir.list_reply.description && (
              <p className="text-xs text-content-tertiary mt-0.5">{ir.list_reply.description}</p>
            )}
          </div>
        )
      }
    }

    return null
  }

  return (
    <div className={cn("flex gap-3 max-w-3xl", isOutbound ? "ml-auto flex-row-reverse" : "")}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        isOutbound ? "bg-success text-white" : "bg-muted"
      )}>
        {isOutbound ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn(
        "rounded-lg px-4 py-2 max-w-[80%]",
        isOutbound ? "bg-success/10 border border-success/20 text-content-primary" : "bg-muted text-content-primary"
      )}>
        {renderMedia()}
        {entry.text && entry.type !== "audio" && (
          <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
        )}
        {entry.mediaCaption && entry.type !== "audio" && entry.text !== entry.mediaCaption && (
          <p className="text-xs text-content-secondary mt-1">{entry.mediaCaption}</p>
        )}
        {renderInteractive()}
        <div className={cn("flex items-center gap-1 mt-1", isOutbound ? "justify-end" : "")}>
          <p className="text-[10px] text-content-tertiary">
            {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {isOutbound && <MessageStatus status={entry.status} />}
        </div>
      </div>
    </div>
  )
}

function MediaAttachmentInput({
  threadId,
  onError,
}: {
  threadId: Id<"threads">
  onError: (msg: string) => void
}) {
  const [preview, setPreview] = useState<{ file: File; type: "image" | "audio" | "document"; url: string } | null>(null)
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const generateUploadUrl = useGenerateUploadUrl()
  const sendMedia = useSendWhatsAppMedia()

  const handleFileSelect = (accept: string, mediaType: "image" | "audio" | "document") => {
    const input = fileInputRef.current
    if (!input) return
    input.accept = accept
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setPreview({ file, type: mediaType, url: URL.createObjectURL(file) })
      setCaption("")
    }
    input.click()
  }

  const handleSend = async () => {
    if (!preview) return
    setUploading(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": preview.file.type },
        body: preview.file,
      })
      const { storageId } = await uploadResult.json()
      await sendMedia({
        threadId,
        storageId,
        mediaType: preview.type,
        caption: caption.trim() || undefined,
        fileName: preview.file.name,
      })
      handleCancel()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to send media")
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setCaption("")
  }

  if (preview) {
    return (
      <div className="border border-border/50 rounded-lg p-3 space-y-2">
        {preview.type === "image" && (
          <img src={preview.url} alt="Preview" className="max-h-40 rounded-lg object-contain" />
        )}
        {preview.type === "audio" && (
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <Mic className="h-4 w-4" />
            {preview.file.name}
          </div>
        )}
        {preview.type === "document" && (
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <FileText className="h-4 w-4" />
            {preview.file.name}
          </div>
        )}
        {preview.type !== "audio" && (
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="text-sm"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSend} disabled={uploading} className="gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" />
      </div>
    )
  }

  return (
    <>
      <input ref={fileInputRef} type="file" className="hidden" />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="outline" className="shrink-0 h-10 w-10" title="Attach media">
            <Paperclip className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start" side="top">
          <button
            type="button"
            onClick={() => handleFileSelect("image/*", "image")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            <ImageIcon className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            onClick={() => handleFileSelect("audio/*", "audio")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            <Mic className="h-4 w-4" />
            Audio
          </button>
        </PopoverContent>
      </Popover>
    </>
  )
}

function ButtonComposer({
  threadId,
  onSent,
  onError,
}: {
  threadId: Id<"threads">
  onSent: () => void
  onError: (msg: string) => void
}) {
  const [bodyText, setBodyText] = useState("")
  const [footerText, setFooterText] = useState("")
  const [buttons, setButtons] = useState([{ id: "btn_1", title: "" }])
  const [sending, setSending] = useState(false)
  const sendInteractive = useSendWhatsAppInteractive()

  const addButton = () => {
    if (buttons.length >= 3) return
    setButtons([...buttons, { id: `btn_${buttons.length + 1}`, title: "" }])
  }

  const removeButton = (index: number) => {
    if (buttons.length <= 1) return
    setButtons(buttons.filter((_, i) => i !== index))
  }

  const updateButton = (index: number, title: string) => {
    setButtons(buttons.map((b, i) => i === index ? { ...b, title } : b))
  }

  const handleSend = async () => {
    if (!bodyText.trim() || buttons.some((b) => !b.title.trim())) return
    setSending(true)
    try {
      await sendInteractive({
        threadId,
        bodyText: bodyText.trim(),
        buttons: buttons.map((b) => ({ id: b.id, title: b.title.trim() })),
        footerText: footerText.trim() || undefined,
      })
      setBodyText("")
      setFooterText("")
      setButtons([{ id: "btn_1", title: "" }])
      onSent()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to send interactive message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs font-medium text-content-secondary">Button Message</p>
      <Textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Message body..."
        className="min-h-[60px] max-h-[100px] resize-none text-sm"
        rows={2}
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-content-tertiary">Buttons (max 3)</p>
          {buttons.length < 3 && (
            <button type="button" onClick={addButton} className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
        {buttons.map((btn, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={btn.title}
              onChange={(e) => updateButton(i, e.target.value)}
              placeholder={`Button ${i + 1} title`}
              className="text-sm flex-1"
              maxLength={20}
            />
            {buttons.length > 1 && (
              <button type="button" onClick={() => removeButton(i)} className="text-content-tertiary hover:text-destructive">
                <Minus className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Input
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text (optional)"
        className="text-sm"
      />
      <Button
        size="sm"
        onClick={handleSend}
        disabled={sending || !bodyText.trim() || buttons.some((b) => !b.title.trim())}
        className="w-full gap-1"
      >
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        Send Buttons
      </Button>
    </div>
  )
}

type ThreadPreview = {
  _id: Id<"threads">
  agentId: string
  agentName: string
  participantName: string
  participantType?: string
  phoneNumber?: string
  businessPhoneNumber?: string
  connectionLabel?: string
  lastMessage?: { content: string; role: string; createdAt: number } | null
}

function ThreadView({
  threadId,
  preview,
}: {
  threadId: Id<"threads">
  preview?: ThreadPreview
}) {
  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const replyToThread = useReplyToThread()
  const sendTemplate = useSendWhatsAppTemplate()
  const selectedThread = useThreadWithMessages(threadId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isWhatsAppThread = preview?.participantType === "whatsapp"
  const whatsAppStatuses = useWhatsAppMessageStatuses(isWhatsAppThread ? threadId : null)
  const whatsAppTimeline = useWhatsAppTimeline(isWhatsAppThread ? threadId : null)

  const threadConnectionId = (() => {
    const externalId = selectedThread?.externalId as string | undefined
    if (!externalId) return undefined
    const match = externalId.match(/^whatsapp:([^:]+):/)
    return match ? match[1] as Id<"whatsappConnections"> : undefined
  })()

  const lastInboundAt = isWhatsAppThread
    ? (selectedThread?.metadata as Record<string, unknown> | undefined)?.lastInboundAt as number | undefined
    : undefined
  const isWithinWindow = lastInboundAt ? (Date.now() - lastInboundAt) < TWENTY_FOUR_HOURS : false

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedThread?.messages, whatsAppTimeline])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return
    setIsSending(true)
    setSendError(null)
    try {
      const result = await replyToThread({ threadId, message: messageInput.trim() })
      setMessageInput("")
      if (result.whatsappStatus === "failed") {
        setSendError("Message saved but WhatsApp delivery failed")
      }
    } catch {
      setSendError("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const handleSendTemplate = async (templateName: string, language: string, components?: unknown[]) => {
    await sendTemplate({ threadId, templateName, language, components })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (selectedThread === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (selectedThread === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <MessageSquare className="h-16 w-16 text-content-tertiary mb-4" />
        <p className="text-sm text-content-secondary">Thread not found</p>
      </div>
    )
  }

  const visibleMessages = selectedThread.messages?.filter(
    (m: { role: string }) => m.role !== "system"
  ) ?? []

  return (
    <>
      <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0 bg-background-secondary">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center",
            isWhatsAppThread
              ? "bg-success/10"
              : "bg-muted"
          )}
        >
          {isWhatsAppThread ? (
            <Phone className="h-5 w-5 text-success" />
          ) : (
            <User className="h-5 w-5 text-content-secondary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-content-primary text-sm truncate">
              {preview?.participantName ?? "Unknown"}
            </h2>
            {isWhatsAppThread && <WindowIndicator lastInboundAt={lastInboundAt} />}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-content-tertiary">
              via {preview?.agentName ?? "Agent"}
              {isWhatsAppThread && (preview?.connectionLabel || preview?.businessPhoneNumber) && (
                <span>
                  {" on "}
                  {preview?.connectionLabel ?? (preview?.businessPhoneNumber ? formatPhoneNumber(`+${preview.businessPhoneNumber}`) : "")}
                </span>
              )}
            </p>
            {isWhatsAppThread && preview?.phoneNumber && preview.participantName !== preview.phoneNumber && (
              <p className="text-xs text-content-tertiary">
                {formatPhoneNumber(preview.phoneNumber)}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isWhatsAppThread && whatsAppTimeline ? (
          whatsAppTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-content-secondary">No messages in this thread</p>
            </div>
          ) : (
            whatsAppTimeline.map((entry: TimelineEntry) => (
              <WhatsAppBubble key={entry.id} entry={entry} />
            ))
          )
        ) : (
          visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-content-secondary">No messages in this thread</p>
            </div>
          ) : (
            visibleMessages.map((message: { _id: string; role: string; content: string; createdAt: number; toolCalls?: Array<{ id: string; name: string; arguments: unknown }>; toolCallId?: string }) => {
              if (message.role === "tool") {
                return (
                  <ToolResultBubble
                    key={message._id}
                    toolCallId={message.toolCallId ?? ""}
                    content={message.content}
                    allMessages={visibleMessages}
                  />
                )
              }

              if (message.role === "assistant" && message.toolCalls?.length && !message.content) {
                return (
                  <div key={message._id} className="space-y-2">
                    {message.toolCalls.map((tc) => (
                      <ToolCallBubble key={tc.id} name={tc.name} arguments={tc.arguments} />
                    ))}
                  </div>
                )
              }

              if (message.role === "assistant" && message.toolCalls?.length && message.content) {
                return (
                  <div key={message._id} className="space-y-2">
                    <div className="flex gap-3 max-w-3xl ml-auto flex-row-reverse">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        "bg-primary text-primary-foreground"
                      )}>
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className={cn(
                        "rounded-lg px-4 py-2 max-w-[80%]",
                        "bg-primary text-primary-foreground"
                      )}>
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <p className="text-[10px] text-primary-foreground/70">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {message.toolCalls.map((tc) => (
                      <ToolCallBubble key={tc.id} name={tc.name} arguments={tc.arguments} />
                    ))}
                  </div>
                )
              }

              const isOutbound = message.role === "assistant"

              return (
                <div
                  key={message._id}
                  className={cn(
                    "flex gap-3 max-w-3xl",
                    isOutbound ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      isOutbound ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {isOutbound ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      isOutbound ? "bg-primary text-primary-foreground" : "bg-muted text-content-primary"
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    <div className={cn("flex items-center gap-1 mt-1", isOutbound ? "justify-end" : "")}>
                      <p className={cn("text-[10px]", isOutbound ? "text-primary-foreground/70" : "text-content-tertiary")}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <div className="px-4 py-2 flex items-center gap-2 text-sm text-warning bg-warning/10 border-t border-warning/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {sendError}
        </div>
      )}

      <div className="border-t p-3 shrink-0 bg-background-secondary space-y-2">
        {isWhatsAppThread && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-success flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {isWithinWindow
                ? "Reply will be sent via WhatsApp"
                : "24h window expired — use a template to re-engage"}
            </p>
            {!isWithinWindow && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTemplatePickerOpen(true)}
                className="text-xs h-7 gap-1"
              >
                <FileText className="h-3 w-3" />
                Send Template
              </Button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          {isWhatsAppThread && isWithinWindow && (
            <MediaAttachmentInput threadId={threadId} onError={(msg) => setSendError(msg)} />
          )}
          <Textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isWhatsAppThread && !isWithinWindow ? "Window expired — send a template first" : "Type a message..."}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isSending || (isWhatsAppThread && !isWithinWindow)}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || (isWhatsAppThread && !isWithinWindow)}
            className="shrink-0 h-10 w-10"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          {isWhatsAppThread && isWithinWindow && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="outline" className="shrink-0 h-10 w-10" title="Send button message">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="6" rx="1" />
                    <rect x="3" y="12" width="18" height="4" rx="1" />
                    <rect x="3" y="19" width="18" height="4" rx="1" />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end" side="top">
                <ButtonComposer
                  threadId={threadId}
                  onSent={() => setSendError(null)}
                  onError={(msg) => setSendError(msg)}
                />
              </PopoverContent>
            </Popover>
          )}
          {isWhatsAppThread && isWithinWindow && (
            <Button
              size="icon"
              variant="outline"
              onClick={() => setTemplatePickerOpen(true)}
              className="shrink-0 h-10 w-10"
              title="Send template message"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSend={handleSendTemplate}
        connectionId={threadConnectionId}
      />
    </>
  )
}

export default function ChatPage() {
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [connectionFilter, setConnectionFilter] = useState<string>("all")
  const [showEvals, setShowEvals] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null)
  const { isAdmin } = useRoleContext()

  const { environment } = useEnvironment()
  const filteredAgentId = agentFilter !== "all" ? (agentFilter as Id<"agents">) : undefined
  const threads = useThreadsWithPreviews(filteredAgentId, environment)
  const whatsappConnections = useWhatsAppConnections(environment)

  if (threads === undefined) {
    return (
      <div className="flex h-[calc(100dvh-49px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  const selectedConnection = connectionFilter !== "all"
    ? (whatsappConnections ?? []).find((c: any) => c._id === connectionFilter)
    : null

  const visibleThreads = (showEvals
    ? threads
    : threads.filter((t: typeof threads[number]) => !t.participantName.startsWith("eval:"))
  ).filter((t: typeof threads[number]) => {
    if (!selectedConnection) return true
    return t.businessPhoneNumber === selectedConnection.phoneNumber
  })

  const agentOptions = new Map<string, string>()
  for (const t of visibleThreads) {
    if (!agentOptions.has(t.agentId)) {
      agentOptions.set(t.agentId, t.agentName)
    }
  }

  const selectedPreview = threads.find((t: { _id: Id<"threads"> }) => t._id === selectedThreadId)

  return (
    <div className="flex h-[calc(100dvh-49px)]">
      <aside className="w-80 border-r bg-background-secondary backdrop-blur-sm flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {Array.from(agentOptions.entries()).map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {whatsappConnections && whatsappConnections.length > 0 && (
            <Select value={connectionFilter} onValueChange={setConnectionFilter}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="All numbers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All numbers</SelectItem>
                {whatsappConnections
                  .filter((c: any) => c.status === "connected")
                  .map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.label || (c.phoneNumber ? formatPhoneNumber(`+${c.phoneNumber}`) : "Unknown")}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <div className="flex items-center justify-between cursor-pointer">
              <label htmlFor="show-evals" className="flex items-center gap-1.5 text-xs text-content-secondary cursor-pointer">
                <FlaskConical className="h-3 w-3" />
                Show evals
              </label>
              <Switch id="show-evals" checked={showEvals} onCheckedChange={setShowEvals} className="scale-75" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="h-10 w-10 text-content-tertiary mb-3" />
              <p className="text-sm text-content-secondary">No conversations found</p>
            </div>
          ) : (
            <ul>
              {visibleThreads.map((thread: typeof visibleThreads[number]) => (
                <li key={thread._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread._id)}
                    className={cn(
                      "w-full text-left px-3 py-3 border-b border-border/50 transition-colors ease-out-soft",
                      selectedThreadId === thread._id
                        ? "bg-primary/10"
                        : "hover:bg-background-tertiary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          thread.participantType === "whatsapp"
                            ? "bg-success/10"
                            : "bg-muted"
                        )}
                      >
                        {thread.participantType === "whatsapp" ? (
                          <Phone className="h-4 w-4 text-success" />
                        ) : (
                          <User className="h-4 w-4 text-content-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-content-primary truncate">
                            {thread.participantName}
                          </span>
                          {thread.lastMessage && (
                            <span className="text-xs text-content-tertiary shrink-0">
                              {formatRelativeTime(thread.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        {thread.participantType === "whatsapp" && thread.phoneNumber && thread.participantName !== thread.phoneNumber && (
                          <p className="text-[10px] text-content-tertiary">
                            {formatPhoneNumber(thread.phoneNumber)}
                          </p>
                        )}
                        <p className="text-xs text-content-tertiary mt-0.5">
                          via {thread.agentName}
                          {thread.participantType === "whatsapp" && (thread.connectionLabel || thread.businessPhoneNumber) && (
                            <span className="text-content-tertiary">
                              {" on "}
                              {thread.connectionLabel ?? (thread.businessPhoneNumber ? formatPhoneNumber(`+${thread.businessPhoneNumber}`) : "")}
                            </span>
                          )}
                        </p>
                        {thread.lastMessage && (
                          <p className="text-xs text-content-secondary mt-1 truncate">
                            {thread.lastMessage.role === "assistant" && (
                              <span className="text-content-tertiary">Bot: </span>
                            )}
                            {truncate(thread.lastMessage.content, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background min-w-0">
        {!selectedThreadId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-16 w-16 text-content-tertiary mb-4" />
            <h2 className="text-lg font-medium font-display text-content-primary mb-2">
              Select a conversation
            </h2>
            <p className="text-sm text-content-secondary max-w-md">
              Choose a conversation from the left to view messages.
            </p>
          </div>
        ) : (
          <ThreadView key={selectedThreadId} threadId={selectedThreadId} preview={selectedPreview} />
        )}
      </main>
    </div>
  )
}
