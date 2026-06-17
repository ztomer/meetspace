import { X } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";
import React from "react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

export { sonnerToast };

export interface ToastButtonProps {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface CustomToastProps {
  id: string | number;
  title: string;
  content?: React.ReactNode;
  buttons?: ToastButtonProps[];
  dismissible?: boolean;
  children?: React.ReactNode;
  duration?: number;
}

export function CustomToast(props: CustomToastProps) {
  const { id, title, content, buttons = [], dismissible, children } = props;

  return (
    <div className="relative flex flex-col gap-2 p-4">
      {dismissible && (
        <button
          onClick={() => sonnerToast.dismiss(id)}
          className="hover:bg-muted absolute top-2 right-2 cursor-pointer rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}

      <div className="font-medium">{title}</div>

      {content && (
        <div className="text-muted-foreground text-sm">{content}</div>
      )}

      {children}

      {buttons.length > 0 && (
        <div className="mt-2 flex gap-2">
          {buttons.map((button, index) => (
            <button
              key={index}
              onClick={() => {
                button.onClick();
                sonnerToast.dismiss(id);
              }}
              className={
                button.primary
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm"
                  : "bg-accent text-foreground hover:bg-accent/80 rounded-md px-3 py-1.5 text-sm"
              }
            >
              {button.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function toast(props: CustomToastProps) {
  return sonnerToast.custom(
    (id) => (
      <div className="group overflow-clip">
        <CustomToast
          id={id}
          title={props.title}
          content={props.content}
          buttons={props.buttons}
          dismissible={props.dismissible}
          children={props.children}
        />
      </div>
    ),
    {
      id: props.id,
      duration: props.dismissible === false ? Infinity : props.duration,
    },
  );
}

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({
  theme = "system",
  position = "bottom-right",
  richColors = true,
  style,
  ...props
}: ToasterProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Sonner
      theme={theme}
      position={position}
      richColors={richColors}
      className="toaster group"
      style={{ "--width": "300px", ...style } as CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:rounded-xl group-[.toaster]:overflow-clip group-[.toaster]:w-[300px] group-[.toaster]:p-3.5 group-[.toaster]:gap-3",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
