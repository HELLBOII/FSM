"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ children, ...props }) {
  return (
    <TooltipPrimitive.Provider {...props}>
      {children}
    </TooltipPrimitive.Provider>
  )
}
TooltipProvider.displayName = TooltipPrimitive.Provider.displayName

const TooltipContent = React.forwardRef(({ className, sideOffset = 5, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-[10002] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

const TooltipArrow = React.forwardRef(({ className, ...props }, ref) => (
  <TooltipPrimitive.Arrow
    ref={ref}
    className={cn("fill-popover", className)}
    {...props}
  />
))
TooltipArrow.displayName = TooltipPrimitive.Arrow.displayName

/**
 * Compositional API aligned with Radix docs, e.g.:
 * <Tooltip.Provider>
 *   <Tooltip.Root>
 *     <Tooltip.Trigger asChild>...</Tooltip.Trigger>
 *     <Tooltip.Portal>
 *       <Tooltip.Content sideOffset={5}>
 *         Label
 *         <Tooltip.Arrow />
 *       </Tooltip.Content>
 *     </Tooltip.Portal>
 *   </Tooltip.Root>
 * </Tooltip.Provider>
 */
const Tooltip = {
  Provider: TooltipProvider,
  Root: TooltipPrimitive.Root,
  Trigger: TooltipPrimitive.Trigger,
  Portal: TooltipPrimitive.Portal,
  Content: TooltipContent,
  Arrow: TooltipArrow,
}

export { Tooltip, TooltipProvider }
