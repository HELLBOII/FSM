"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) =>
<SheetPrimitive.Overlay data-source-location="components/ui/sheet:18:2" data-dynamic-content="false"
className={cn(
  "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  className
)}
{...props}
ref={ref} />
);
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
        "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
        "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);

const SheetContent = React.forwardRef(({ side = "right", className, children, ...props }, ref) =>
<SheetPortal data-source-location="components/ui/sheet:48:2" data-dynamic-content="true">
    <SheetOverlay data-source-location="components/ui/sheet:49:4" data-dynamic-content="false" />
    <SheetPrimitive.Content data-source-location="components/ui/sheet:50:4" data-dynamic-content="true" ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close data-source-location="components/ui/sheet:51:6" data-dynamic-content="false"
    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X data-source-location="components/ui/sheet:53:8" data-dynamic-content="false" className="h-4 w-4" />
        <span data-source-location="components/ui/sheet:54:8" data-dynamic-content="false" className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}) =>
<div data-source-location="components/ui/sheet:66:2" data-dynamic-content="false"
className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
{...props} />;

SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}) =>
<div data-source-location="components/ui/sheet:76:2" data-dynamic-content="false"
className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
{...props} />;

SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef(({ className, ...props }, ref) =>
<SheetPrimitive.Title data-source-location="components/ui/sheet:83:2" data-dynamic-content="false"
ref={ref}
className={cn("text-lg font-semibold text-foreground", className)}
{...props} />
);
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef(({ className, ...props }, ref) =>
<SheetPrimitive.Description data-source-location="components/ui/sheet:91:2" data-dynamic-content="false"
ref={ref}
className={cn("text-sm text-muted-foreground", className)}
{...props} />
);
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription };