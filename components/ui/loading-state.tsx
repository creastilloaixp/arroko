import * as React from "react"

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full h-8 w-8 border-2 border-primary border-r-transparent ${className}`} />
  )
}

export function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <LoadingSpinner />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function ErrorState({
  message = "Ocurrió un error al cargar los datos",
  onRetry
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="text-red-500 text-xl">⚠️</div>
      <p className="text-sm text-muted-foreground text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
