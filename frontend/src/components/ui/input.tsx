import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-[#131313] border-input flex h-9 w-full min-w-0 rounded-[2px] border px-3 py-1 text-base text-white transition-[border-color] duration-150 ease-in-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#3cffd0]",
        "aria-invalid:border-[#5200ff]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
