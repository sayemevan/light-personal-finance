"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SheetGrabber, useBackToClose } from "@/components/ui/mobile-sheet";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Centered modal on larger screens; on phones it becomes a bottom sheet with a
 * grab handle, swipe-to-dismiss and back-button-to-close.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Phone: bottom sheet.
        "fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] w-full gap-4 overflow-y-auto overscroll-contain rounded-t-[28px] border-t bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Tablet / desktop: centered dialog.
        "sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 sm:duration-200 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
        className,
      )}
      {...props}
    >
      <MobileSheetChrome>{children}</MobileSheetChrome>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Grab handle + close wiring shared by the dialog's mobile sheet form. */
function MobileSheetChrome({ children }: { children: React.ReactNode }) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLElement | null>(null);
  const close = React.useCallback(() => closeRef.current?.click(), []);
  // Resolved before useBackToClose's effect runs (layout effects run first).
  React.useLayoutEffect(() => {
    contentRef.current = handleRef.current?.parentElement ?? null;
  }, []);
  useBackToClose(close, contentRef);

  return (
    <>
      <div ref={handleRef} className="contents">
        <SheetGrabber targetRef={contentRef} onDismiss={close} />
      </div>
      {children}
      <DialogPrimitive.Close
        ref={closeRef}
        className="absolute right-4 top-4 hidden rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none sm:block"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </>
  );
}

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Pinned to the bottom of the sheet on phones so actions stay in reach.
      "sticky -bottom-[calc(1.25rem+env(safe-area-inset-bottom))] -mx-5 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-row gap-2 border-t bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 [&>*]:h-11 [&>*]:flex-1 [&>*]:rounded-full sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:border-0 sm:p-0 sm:[&>*]:h-9 sm:[&>*]:flex-none sm:[&>*]:rounded-md",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
