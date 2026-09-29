"use client";

import type { ReactNode } from "react";
import { ArrowRight, Maximize2 } from "lucide-react";
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
};

export function PhotoLightbox({
  src,
  alt,
  caption,
  detail,
  children,
  className,
  action,
}: PhotoLightboxProps) {
  return (
    <Dialog>
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
        {(caption || detail || action) && (
          <div className="photo-lightbox-meta">
            <div>
              {caption && <strong>{caption}</strong>}
              {detail && <span>{detail}</span>}
            </div>
            {action && (
              <button type="button" onClick={action.onSelect}>
                {action.label}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
