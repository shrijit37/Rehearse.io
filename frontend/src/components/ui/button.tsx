import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-180 ease-in-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        /* Jelly Mint Pill — primary CTA */
        default:
          "bg-[#3cffd0] text-[#131313] rounded-[24px] hover:bg-white/20 hover:text-black hover:ring-1 hover:ring-[#c2c2c2] active:bg-[rgba(140,140,140,0.87)] active:opacity-50 active:ring-[#8c8c8c] focus-visible:bg-[#1eaedb] focus-visible:text-white focus-visible:border focus-visible:border-[#0500ff] focus-visible:ring-2 focus-visible:ring-white/30",
        /* Dark Slate Pill — secondary */
        secondary:
          "bg-[#2d2d2d] text-[#e9e9e9] rounded-[24px] hover:bg-white/20 hover:text-black hover:ring-1 hover:ring-[#c2c2c2] active:bg-[rgba(140,140,140,0.87)] active:opacity-50 active:ring-[#8c8c8c] focus-visible:bg-[#1eaedb] focus-visible:text-white focus-visible:border focus-visible:border-[#0500ff] focus-visible:ring-2 focus-visible:ring-white/30",
        /* Destructive — Ultraviolet fill for destructive actions */
        destructive:
          "bg-[#5200ff] text-white rounded-[24px] hover:bg-white/20 hover:text-black hover:ring-1 hover:ring-[#c2c2c2] focus-visible:bg-[#1eaedb] focus-visible:text-white focus-visible:border focus-visible:border-[#0500ff] focus-visible:ring-2 focus-visible:ring-white/30",
        /* Outlined Mint — tertiary, larger pill, mono text */
        outline:
          "bg-transparent text-[#3cffd0] border border-[#3cffd0] rounded-[40px] font-mono text-xs uppercase tracking-[1.5px] hover:bg-[#3cffd0] hover:text-black focus-visible:bg-[#1eaedb] focus-visible:text-white focus-visible:border-[#0500ff] focus-visible:ring-2 focus-visible:ring-white/30",
        /* Outlined Ultraviolet — promotional */
        ultraviolet:
          "bg-transparent text-[#5200ff] border border-[#5200ff] rounded-[30px] hover:bg-[#5200ff] hover:text-white focus-visible:bg-[#1eaedb] focus-visible:text-white focus-visible:border-[#0500ff] focus-visible:ring-2 focus-visible:ring-white/30",
        /* Ghost — bare text, shifts to deep link blue */
        ghost:
          "text-foreground rounded-[24px] hover:text-[#3860be] focus-visible:text-[#3860be]",
        /* Link — color shift to deep link blue, no underline */
        link: "text-foreground hover:text-[#3860be] focus-visible:text-[#3860be]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-7 py-3 has-[>svg]:px-5",
        /* Pill size: spacious for prominent CTAs */
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
