import * as React from "react"
import { cn } from "../../lib/utils"

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning'

type ToastEvent = {
  message: string
  variant?: ToastVariant
}

const variantClasses: Record<ToastVariant, string> = {
  default: "bg-card text-foreground border border-border",
  success: "bg-[color-mix(in_oklab,var(--color-success),black_85%)] text-[color-mix(in_oklab,var(--color-success),white_25%)]",
  destructive: "bg-[color-mix(in_oklab,var(--color-destructive),black_85%)] text-[color-mix(in_oklab,var(--color-destructive),white_25%)]",
  warning: "bg-[color-mix(in_oklab,var(--color-warning),black_85%)] text-[color-mix(in_oklab,var(--color-warning),white_25%)]",
}

export const showToast = (message: string, variant: ToastVariant = 'default') => {
  window.dispatchEvent(new CustomEvent<ToastEvent>('toast', { detail: { message, variant } as any }))
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = React.useState<{ id: number; message: string; variant: ToastVariant }[]>([])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<ToastEvent>
      const id = Date.now() + Math.floor(Math.random() * 1000)
      const variant = evt.detail?.variant || 'default'
      const message = evt.detail?.message || ''
      setToasts(prev => [...prev, { id, message, variant }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }
    window.addEventListener('toast', handler as any)
    return () => window.removeEventListener('toast', handler as any)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={cn("px-4 py-2 rounded-md shadow-lg", variantClasses[t.variant])}>{t.message}</div>
      ))}
    </div>
  )
}