import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-[14px]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[14px]",
        outline: "border border-input bg-background hover:bg-muted hover:text-foreground rounded-[14px]",
        secondary: "border border-secondary bg-card text-primary hover:bg-muted rounded-[14px]",
        ghost: "hover:bg-muted hover:text-foreground rounded-[14px]",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-brand text-primary-foreground font-semibold hover:brightness-110 shadow-lg shadow-primary/15 rounded-[14px]",
        "outline-gold": "border border-primary/30 text-primary hover:bg-primary/5 hover:border-primary rounded-[14px]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-[12px] px-3",
        lg: "h-12 rounded-[14px] px-8 text-base",
        icon: "h-10 w-10 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
