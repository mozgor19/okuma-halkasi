"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Maximize2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PhotoLightboxProps = {
  src: string;
  alt: string;
  caption?: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
  action?: {
    label: string;
    onSelect: () => void;
  };
  destructiveAction?: {
    label: string;
    disabled?: boolean;
    onSelect: () => boolean | Promise<boolean>;
  };
};

export function PhotoLightbox({
  src,
  alt,
  caption,
  detail,
  children,
  className,
  action,
  destructiveAction,
}: PhotoLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("photo-lightbox-trigger", className)}
          aria-label={`${alt} - büyüt`}
        >
          <img src={src} alt={alt} />
          {children}
          <i className="photo-zoom-indicator" aria-hidden="true">
            <Maximize2 size={17} />
          </i>
        </button>
      </DialogTrigger>
      <DialogContent className="photo-lightbox">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          Fotoğrafın büyütülmüş görünümü.
        </DialogDescription>
        <div className="photo-lightbox-stage">
          <img src={src} alt={alt} />
        </div>
        {(caption || detail || action || destructiveAction) && (
          <div className="photo-lightbox-meta">
            <div className="photo-lightbox-copy">
              {caption && <strong>{caption}</strong>}
              {detail && <span>{detail}</span>}
            </div>
            <div className="photo-lightbox-actions">
              {destructiveAction && (
                <button
                  type="button"
                  className="photo-delete-action"
                  disabled={destructiveAction.disabled}
                  onClick={async () => {
                    if (await destructiveAction.onSelect()) setOpen(false);
                  }}
                >
                  <Trash2 size={16} />
                  {destructiveAction.label}
                </button>
              )}
              {action && (
                <button type="button" onClick={action.onSelect}>
                  {action.label}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
