"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) =>
<SelectPrimitive.Trigger data-source-location="components/ui/select:16:2" data-dynamic-content="true"
ref={ref}
className={cn(
  "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  className
)}
{...props}>
    {children}
    <SelectPrimitive.Icon data-source-location="components/ui/select:24:4" data-dynamic-content="false" asChild>
      <ChevronDown data-source-location="components/ui/select:25:6" data-dynamic-content="false" className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) =>
<SelectPrimitive.ScrollUpButton data-source-location="components/ui/select:32:2" data-dynamic-content="false"
ref={ref}
className={cn("flex cursor-default items-center justify-center py-1", className)}
{...props}>
    <ChevronUp data-source-location="components/ui/select:36:4" data-dynamic-content="false" className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
);
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) =>
<SelectPrimitive.ScrollDownButton data-source-location="components/ui/select:42:2" data-dynamic-content="false"
ref={ref}
className={cn("flex cursor-default items-center justify-center py-1", className)}
{...props}>
    <ChevronDown data-source-location="components/ui/select:46:4" data-dynamic-content="false" className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
);
SelectScrollDownButton.displayName =
SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) =>
<SelectPrimitive.Portal data-source-location="components/ui/select:53:2" data-dynamic-content="true">
    <SelectPrimitive.Content data-source-location="components/ui/select:54:4" data-dynamic-content="true"
  ref={ref}
  className={cn(
    "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
    position === "popper" &&
    "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
    className
  )}
  position={position}
  {...props}>
      <SelectScrollUpButton data-source-location="components/ui/select:64:6" data-dynamic-content="false" />
      <SelectPrimitive.Viewport data-source-location="components/ui/select:65:6" data-dynamic-content="true"
    className={cn("p-1", position === "popper" &&
    "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton data-source-location="components/ui/select:70:6" data-dynamic-content="false" />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef(({ className, ...props }, ref) =>
<SelectPrimitive.Label data-source-location="components/ui/select:77:2" data-dynamic-content="false"
ref={ref}
className={cn("px-2 py-1.5 text-sm font-semibold", className)}
{...props} />
);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) =>
<SelectPrimitive.Item data-source-location="components/ui/select:85:2" data-dynamic-content="true"
ref={ref}
className={cn(
  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  className
)}
{...props}>
    <span data-source-location="components/ui/select:92:4" data-dynamic-content="false" className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator data-source-location="components/ui/select:93:6" data-dynamic-content="false">
        <Check data-source-location="components/ui/select:94:8" data-dynamic-content="false" className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText data-source-location="components/ui/select:97:4" data-dynamic-content="true">{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) =>
<SelectPrimitive.Separator data-source-location="components/ui/select:103:2" data-dynamic-content="false"
ref={ref}
className={cn("-mx-1 my-1 h-px bg-muted", className)}
{...props} />
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton };