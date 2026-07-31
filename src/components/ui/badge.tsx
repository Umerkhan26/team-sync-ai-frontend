import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success:
          'border-transparent bg-success/15 text-success dark:bg-success/20 dark:text-emerald-300',
        warning:
          'border-transparent bg-warning/15 text-amber-800 dark:bg-warning/20 dark:text-amber-300',
        destructive:
          'border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
