import * as React from "react"
import { cn } from "../../lib/utils"

export interface SkeletonProps {
  className?: string
}

const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  )
}

export { Skeleton }