import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[#E8F7ED] text-[#166534] [a]:hover:bg-[#DDF3E4]",
        secondary:
          "bg-[#F0F9F2] text-[#17211B] [a]:hover:bg-[#E8F7ED]",
        destructive:
          "bg-red-50 text-red-600 focus-visible:ring-red-200 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-red-100",
        outline:
          "border-[#DDE7DF] bg-white text-[#17211B] [a]:hover:bg-[#F0F9F2] [a]:hover:text-[#166534]",
        ghost:
          "bg-transparent text-[#17211B] hover:bg-[#F0F9F2] hover:text-[#166534] dark:hover:bg-muted/50",
        link: "text-[#166534] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps({
      className: cn(badgeVariants({ variant }), className),
    }, props),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants }
