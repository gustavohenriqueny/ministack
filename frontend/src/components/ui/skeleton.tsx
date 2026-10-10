import * as React from "react"
import { cn } from "src/lib/utils"

interface SkeletonProps extends React.ComponentProps<"div"> {
  variant?: 'text' | 'circular' | 'rectangular';
}

function Skeleton({
  className,
  variant = 'rectangular',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: "h-3 w-full rounded-md",
    circular: "rounded-full",
    rectangular: "rounded-lg"
  };

  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-muted/40 animate-pulse",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
