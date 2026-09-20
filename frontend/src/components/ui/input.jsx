import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-[#DDE7DF] bg-white px-3.5 py-2 text-base text-[#17211B] shadow-sm transition-all outline-none placeholder:text-[#6B7B73] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#17211B] focus-visible:border-[#166534] focus-visible:ring-3 focus-visible:ring-[#166534]/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F3F5F3] disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-3 aria-invalid:ring-red-100 md:text-sm",
        className
      )}
      {...props} />
  );
}

export { Input }
