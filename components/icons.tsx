"use client";

import * as React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  TriangleAlertIcon as TriangleAlertSourceIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  BookHeartIcon,
  BookOpen01Icon,
  CalendarClockIcon,
  CalendarDaysIcon,
  Camera01Icon,
  ColorsIcon as ColorsSourceIcon,
  ComputerIcon as ComputerSourceIcon,
  CircleIcon as CircleSourceIcon,
  GripVerticalIcon as GripVerticalSourceIcon,
  ImageAdd01Icon,
  InformationCircleIcon,
  KeyRoundIcon as KeyRoundSourceIcon,
  LoaderCircleIcon as LoaderCircleSourceIcon,
  Location01Icon,
  LockKeyholeIcon as LockKeyholeSourceIcon,
  MinusSignIcon,
  Moon02Icon as MoonSourceIcon,
  MoreHorizontalIcon as MoreHorizontalSourceIcon,
  OctagonXIcon as OctagonXSourceIcon,
  PanelLeftIcon as PanelLeftSourceIcon,
  PencilEdit01Icon,
  ScanFaceIcon as ScanFaceSourceIcon,
  Share01Icon as ShareSourceIcon,
  ShieldCheckIcon as ShieldCheckSourceIcon,
  StarIcon as StarSourceIcon,
  Sun03Icon as SunSourceIcon,
  Tick02Icon,
  UserGroupIcon,
  UserSwitchIcon as UserSwitchSourceIcon,
} from "@hugeicons/core-free-icons";
import { Archive02Icon } from "@/components/ui/archive-02";
import { ArrowLeft02Icon } from "@/components/ui/arrow-left-02";
import { ArrowRight02Icon } from "@/components/ui/arrow-right-02";
import { CalendarAdd01Icon } from "@/components/ui/calendar-add-01";
import { Cancel01Icon } from "@/components/ui/cancel-01";
import { ChevronDownIcon as AnimatedChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronRightIcon as AnimatedChevronRightIcon } from "@/components/ui/chevron-right";
import { CircleCheckIcon as AnimatedCircleCheckIcon } from "@/components/ui/circle-check";
import { CloudDownloadIcon } from "@/components/ui/cloud-download";
import { CompassIcon } from "@/components/ui/compass";
import { Delete02Icon } from "@/components/ui/delete-02";
import { ExternalLinkIcon as AnimatedExternalLinkIcon } from "@/components/ui/external-link";
import { FullScreenIcon } from "@/components/ui/full-screen";
import { HistoryIcon } from "@/components/ui/history";
import { Logout01Icon } from "@/components/ui/logout-01";
import { Notification03Icon } from "@/components/ui/notification-03";
import { PlusSignIcon } from "@/components/ui/plus-sign";
import { Search01Icon } from "@/components/ui/search-01";
import { UserAdd01Icon } from "@/components/ui/user-add-01";
import { UserCheck01Icon } from "@/components/ui/user-check-01";
import { UserIcon } from "@/components/ui/user";
import { cn } from "@/lib/utils";

export type IconProps = Omit<React.ComponentPropsWithoutRef<"svg">, "ref"> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};

type AnimatedSource = React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & { size?: number }
>;

function createStaticIcon(icon: IconSvgElement, displayName: string) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, strokeWidth, ...props }, ref) => (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        data-icon=""
        size={size}
        strokeWidth={typeof strokeWidth === "string" ? Number(strokeWidth) : strokeWidth}
        {...props}
      />
    ),
  );
  Icon.displayName = displayName;
  return Icon;
}

function createAnimatedIcon(Source: AnimatedSource, displayName: string) {
  function Icon({
    className,
    size,
    style,
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absoluteStrokeWidth,
    fill: _fill,
    ...props
  }: IconProps) {
    void _strokeWidth;
    void _absoluteStrokeWidth;
    void _fill;
    const dimension = typeof size === "number" ? `${size}px` : size;
    return (
      <Source
        data-icon=""
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center leading-none [&>svg]:size-full",
          className,
        )}
        style={{ ...style, width: dimension, height: dimension }}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const Archive = createAnimatedIcon(Archive02Icon, "Archive");
export const ArrowLeft = createAnimatedIcon(ArrowLeft02Icon, "ArrowLeft");
export const ArrowRight = createAnimatedIcon(ArrowRight02Icon, "ArrowRight");
export const CalendarPlus = createAnimatedIcon(CalendarAdd01Icon, "CalendarPlus");
export const ChevronDown = createAnimatedIcon(AnimatedChevronDownIcon, "ChevronDown");
export const ChevronRight = createAnimatedIcon(AnimatedChevronRightIcon, "ChevronRight");
export const Compass = createAnimatedIcon(CompassIcon, "Compass");
export const Download = createAnimatedIcon(CloudDownloadIcon, "Download");
export const ExternalLink = createAnimatedIcon(AnimatedExternalLinkIcon, "ExternalLink");
export const LogOut = createAnimatedIcon(Logout01Icon, "LogOut");
export const Maximize2 = createAnimatedIcon(FullScreenIcon, "Maximize2");
export const Plus = createAnimatedIcon(PlusSignIcon, "Plus");
export const RotateCcw = createAnimatedIcon(HistoryIcon, "RotateCcw");
export const Search = createAnimatedIcon(Search01Icon, "Search");
export const Trash2 = createAnimatedIcon(Delete02Icon, "Trash2");
export const UserCheck = createAnimatedIcon(UserCheck01Icon, "UserCheck");
export const UserPlus = createAnimatedIcon(UserAdd01Icon, "UserPlus");
export const UserRound = createAnimatedIcon(UserIcon, "UserRound");
export const X = createAnimatedIcon(Cancel01Icon, "X");
export const Bell = createAnimatedIcon(Notification03Icon, "Bell");
export const BellRing = Bell;

export const BookHeart = createStaticIcon(BookHeartIcon, "BookHeart");
export const BookOpen = createStaticIcon(BookOpen01Icon, "BookOpen");
export const CalendarClock = createStaticIcon(CalendarClockIcon, "CalendarClock");
export const CalendarDays = createStaticIcon(CalendarDaysIcon, "CalendarDays");
export const Camera = createStaticIcon(Camera01Icon, "Camera");
export const Colors = createStaticIcon(ColorsSourceIcon, "Colors");
export const Computer = createStaticIcon(ComputerSourceIcon, "Computer");
export const Check = createStaticIcon(Tick02Icon, "Check");
export const ImagePlus = createStaticIcon(ImageAdd01Icon, "ImagePlus");
export const KeyRound = createStaticIcon(KeyRoundSourceIcon, "KeyRound");
export const LoaderCircle = createStaticIcon(LoaderCircleSourceIcon, "LoaderCircle");
export const LockKeyhole = createStaticIcon(LockKeyholeSourceIcon, "LockKeyhole");
export const MapPin = createStaticIcon(Location01Icon, "MapPin");
export const Moon = createStaticIcon(MoonSourceIcon, "Moon");
export const Pencil = createStaticIcon(PencilEdit01Icon, "Pencil");
export const ScanFace = createStaticIcon(ScanFaceSourceIcon, "ScanFace");
export const Share = createStaticIcon(ShareSourceIcon, "Share");
export const ShieldCheck = createStaticIcon(ShieldCheckSourceIcon, "ShieldCheck");
export const Star = createStaticIcon(StarSourceIcon, "Star");
export const Sun = createStaticIcon(SunSourceIcon, "Sun");
export const Users = createStaticIcon(UserGroupIcon, "Users");
export const UserSwitch = createStaticIcon(UserSwitchSourceIcon, "UserSwitch");

export const ArrowDownIcon = createStaticIcon(ArrowDown01Icon, "ArrowDownIcon");
export const ChevronLeftIcon = createStaticIcon(ArrowLeft01Icon, "ChevronLeftIcon");
export const ChevronUpIcon = createStaticIcon(ArrowUp01Icon, "ChevronUpIcon");
export const CheckIcon = Check;
export const ChevronDownIcon = ChevronDown;
export const ChevronRightIcon = ChevronRight;
export const CircleIcon = createStaticIcon(CircleSourceIcon, "CircleIcon");
export const CircleCheckIcon = createAnimatedIcon(AnimatedCircleCheckIcon, "CircleCheckIcon");
export const GripVerticalIcon = createStaticIcon(GripVerticalSourceIcon, "GripVerticalIcon");
export const InfoIcon = createStaticIcon(InformationCircleIcon, "InfoIcon");
export const Loader2Icon = LoaderCircle;
export const MinusIcon = createStaticIcon(MinusSignIcon, "MinusIcon");
export const MoreHorizontal = createStaticIcon(MoreHorizontalSourceIcon, "MoreHorizontal");
export const MoreHorizontalIcon = MoreHorizontal;
export const OctagonXIcon = createStaticIcon(OctagonXSourceIcon, "OctagonXIcon");
export const PanelLeftIcon = createStaticIcon(PanelLeftSourceIcon, "PanelLeftIcon");
export const SearchIcon = Search;
export const TriangleAlertIcon = createStaticIcon(TriangleAlertSourceIcon, "TriangleAlertIcon");
export const XIcon = X;

