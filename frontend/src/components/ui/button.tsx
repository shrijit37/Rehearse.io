/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils";

/* Signage buttons: a filled plate that inverts when activated, and an outlined
   plate with a rule edge. Focus is handled globally (a rule over an offset). */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        /* Wayfinding yellow plate — inverts to the sign's black when activated */
        default:
          "bg-primary text-primary-foreground rounded-md hover:bg-sign-black hover:text-sign-yellow active:bg-sign-black active:text-sign-yellow",
        /* Recessed plate */
        secondary:
          "bg-secondary text-secondary-foreground rounded-md border border-border hover:bg-surface-active",
        /* Prohibition red */
        destructive:
          "bg-destructive text-destructive-foreground rounded-md hover:bg-sign-black hover:text-sign-white",
        /* Outlined plate — the sign's ruled edge */
        outline:
          "bg-card text-foreground rounded-md border-2 border-foreground hover:bg-foreground hover:text-card",
        /* Bare text */
        ghost:
          "text-foreground rounded-md hover:bg-surface-active",
        /* Inline text action */
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-7 py-3 has-[>svg]:px-5",
        /* Plate size: the monumental call to action */
        pill: "h-12 px-8 py-3 text-base has-[>svg]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
