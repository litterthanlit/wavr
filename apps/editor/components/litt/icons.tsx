"use client";
// @litt/icons 2026.10.24. What changed: https://littmd.vercel.app/changelog.md

/**
 * Icons: one set on one grid (litt.md components.md, Icons). 16 units, a 1.5 stroke, round caps and joins,
 * currentColor, so an icon takes the text color it sits in. Shapes are drawn square and the round join is their only
 * softening. Every icon fits the keylines: a circle of radius 6.25, a square of 11.5, a landscape box of 12.5 by 9.5,
 * or a portrait one of 9.5 by 12.5, so a circle and a box read the same size in a row. Arrows have 4.25 heads on their
 * own and 3 inside a mark. A point (the dot of an i) is a zero-length line; a row of dots is circles of 0.75, and a grid of six filled circles of 0.5 (a circle smaller than its stroke is filled, or some browsers draw a hole).
 * Decorative unless labelled: an icon-only button names itself with aria-label.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  /** Width and height in pixels. The drawing scales from its 16-unit grid and the stroke scales with it. */
  size?: number;
};

function Icon({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

/* Navigation: where you are and where you go. */
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="M10 3.5 5.5 8l4.5 4.5" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m6 3.5 4.5 4.5L6 12.5" /></Icon>;
export const ChevronUpIcon = (p: IconProps) => <Icon {...p}><path d="m3.5 10 4.5-4.5 4.5 4.5" /></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m3.5 6 4.5 4.5L12.5 6" /></Icon>;
export const ChevronsUpDownIcon = (p: IconProps) => <Icon {...p}><path d="m5 6.25 3-3 3 3M5 9.75l3 3 3-3" /></Icon>;
export const ArrowLeftIcon = (p: IconProps) => <Icon {...p}><path d="M13 8H3M7.25 3.75 3 8l4.25 4.25" /></Icon>;
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M3 8h10M8.75 3.75 13 8l-4.25 4.25" /></Icon>;
export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M8 13V3M3.75 7.25 8 3l4.25 4.25" /></Icon>;
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M8 3v10M3.75 8.75 8 13l4.25-4.25" /></Icon>;
export const ArrowUpRightIcon = (p: IconProps) => <Icon {...p}><path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" /></Icon>;
export const HomeIcon = (p: IconProps) => <Icon {...p}><path d="M2.25 7.25 8 2.25l5.75 5M3.5 6.25v7.5h9v-7.5M6.5 13.75v-3.5h3v3.5" /></Icon>;
export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></Icon>;
export const SidebarIcon = (p: IconProps) => <Icon {...p}><rect x="1.75" y="3.25" width="12.5" height="9.5" /><path d="M6.25 3.25v9.5" /></Icon>;
export const ExpandIcon = (p: IconProps) => <Icon {...p}><path d="M9.75 2.25h4v4M13.75 2.25l-4.5 4.5M6.25 13.75h-4v-4M2.25 13.75l4.5-4.5" /></Icon>;
export const ShrinkIcon = (p: IconProps) => <Icon {...p}><path d="M13.75 2.25l-4.5 4.5M9.25 2.75v4h4M2.25 13.75l4.5-4.5M6.75 13.25v-4h-4" /></Icon>;
export const UndoIcon = (p: IconProps) => <Icon {...p}><path d="M6 3.25 3 6.25l3 3M3 6.25h6.75a3.25 3.25 0 0 1 0 6.5H6" /></Icon>;
export const RedoIcon = (p: IconProps) => <Icon {...p}><path d="m10 3.25 3 3-3 3M13 6.25H6.25a3.25 3.25 0 0 0 0 6.5H10" /></Icon>;
export const RetryIcon = (p: IconProps) => <Icon {...p}><path d="M13.25 8a5.25 5.25 0 1 1-1.55-3.7M13.25 2.75v3h-3" /></Icon>;
export const LogOutIcon = (p: IconProps) => <Icon {...p}><path d="M7 2.75H2.75v10.5H7M6 8h7.75M10.75 5l3 3-3 3" /></Icon>;

/* Actions: what a control does. */
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="7" cy="7" r="4.75" /><path d="m10.5 10.5 3 3" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M8 3v10M3 8h10" /></Icon>;
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M3 8h10" /></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="m4 4 8 8M12 4l-8 8" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m3.5 8.5 3 3 6-7" /></Icon>;
export const EditIcon = (p: IconProps) => <Icon {...p}><path d="M10.75 2.75a1.77 1.77 0 0 1 2.5 2.5L5.5 13H3v-2.5z" /><path d="m9.5 4 2.5 2.5" /></Icon>;
export const CopyIcon = (p: IconProps) => <Icon {...p}><rect x="5.25" y="5.25" width="7.5" height="7.5" /><path d="M3.25 10.25V3.25h7" /></Icon>;
export const LinkIcon = (p: IconProps) => <Icon {...p}><path d="m7 5.25 1.5-1.5a2.83 2.83 0 0 1 4 4L11 9.25M9 10.75l-1.5 1.5a2.83 2.83 0 0 1-4-4L5 6.75M6.25 9.75l3.5-3.5" /></Icon>;
export const ShareIcon = (p: IconProps) => <Icon {...p}><path d="M8 9.75v-7.5M5 5.25l3-3 3 3M3.25 8.5v5h9.5v-5" /></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M8 2.25V10M5 7l3 3 3-3M3.25 8.5v5h9.5v-5" /></Icon>;
export const SendIcon = (p: IconProps) => <Icon {...p}><path d="M13.75 2.25 9.5 13.75 7.25 8.75 2.25 6.5z" /><path d="m13.75 2.25-6.5 6.5" /></Icon>;
export const PaperclipIcon = (p: IconProps) => <Icon {...p}><path d="m13 7.25-5.3 5.3a3.25 3.25 0 0 1-4.6-4.6l5.65-5.65a2.1 2.1 0 0 1 3 3L6.1 10.95a1 1 0 0 1-1.4-1.4l5.05-5.05" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 9h6.3l.6-9" /></Icon>;
export const ArchiveIcon = (p: IconProps) => <Icon {...p}><rect x="2.25" y="2.75" width="11.5" height="3" /><path d="M3.25 5.75v7.5h9.5v-7.5M6.5 8.5h3" /></Icon>;
export const FilterIcon = (p: IconProps) => <Icon {...p}><path d="M2.25 3.25h11.5L9.25 8.5v4.25l-2.5 1v-5.25z" /></Icon>;
export const SortIcon = (p: IconProps) => <Icon {...p}><path d="M5 13V3M2 6l3-3 3 3M11 3v10M8 10l3 3 3-3" /></Icon>;
export const SlidersIcon = (p: IconProps) => <Icon {...p}><path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7" /><circle cx="11" cy="4.5" r="1.5" /><circle cx="5" cy="11.5" r="1.5" /></Icon>;
export const SettingsIcon = (p: IconProps) => <Icon {...p}><path d="M6.43 3.68L6.59 1.91A6.25 6.25 0 0 1 9.41 1.91L9.57 3.68A4.6 4.6 0 0 1 10.96 4.48L12.57 3.74A6.25 6.25 0 0 1 13.98 6.17L12.53 7.2A4.6 4.6 0 0 1 12.53 8.8L13.98 9.83A6.25 6.25 0 0 1 12.57 12.26L10.96 11.52A4.6 4.6 0 0 1 9.57 12.32L9.41 14.09A6.25 6.25 0 0 1 6.59 14.09L6.43 12.32A4.6 4.6 0 0 1 5.04 11.52L3.43 12.26A6.25 6.25 0 0 1 2.02 9.83L3.47 8.8A4.6 4.6 0 0 1 3.47 7.2L2.02 6.17A6.25 6.25 0 0 1 3.43 3.74L5.04 4.48A4.6 4.6 0 0 1 6.43 3.68z" /><circle cx="8" cy="8" r="2" /></Icon>;
export const MoreIcon = (p: IconProps) => <Icon {...p}><circle cx="3.5" cy="8" r=".75" /><circle cx="8" cy="8" r=".75" /><circle cx="12.5" cy="8" r=".75" /></Icon>;
export const GripIcon = (p: IconProps) => <Icon {...p}><circle cx="6" cy="3.5" r=".5" fill="currentColor" /><circle cx="10" cy="3.5" r=".5" fill="currentColor" /><circle cx="6" cy="8" r=".5" fill="currentColor" /><circle cx="10" cy="8" r=".5" fill="currentColor" /><circle cx="6" cy="12.5" r=".5" fill="currentColor" /><circle cx="10" cy="12.5" r=".5" fill="currentColor" /></Icon>;
export const EyeIcon = (p: IconProps) => <Icon {...p}><path d="M1.75 8C3.25 5.25 5.4 3.75 8 3.75S12.75 5.25 14.25 8c-1.5 2.75-3.65 4.25-6.25 4.25S3.25 10.75 1.75 8z" /><circle cx="8" cy="8" r="2" /></Icon>;
export const EyeOffIcon = (p: IconProps) => <Icon {...p}><path d="M7.2 3.8C7.46 3.77 7.73 3.75 8 3.75C10.6 3.75 12.75 5.25 14.25 8C13.9 8.64 13.52 9.21 13.1 9.71M8.8 12.2C8.54 12.23 8.27 12.25 8 12.25C5.4 12.25 3.25 10.75 1.75 8C2.1 7.36 2.48 6.79 2.9 6.29" /><path d="m2.75 2.75 10.5 10.5" /></Icon>;
export const LockIcon = (p: IconProps) => <Icon {...p}><rect x="3.25" y="7.25" width="9.5" height="6.5" /><path d="M5.25 7.25V5a2.75 2.75 0 0 1 5.5 0v2.25" /></Icon>;
export const UnlockIcon = (p: IconProps) => <Icon {...p}><rect x="3.25" y="7.25" width="9.5" height="6.5" /><path d="M5.25 7.25V5a2.75 2.75 0 0 1 5.35-.9" /></Icon>;
export const StarIcon = (p: IconProps) => <Icon {...p}><path d="M8 2.2 9.82 6.09 14.09 6.62 10.95 9.56 11.76 13.78 8 11.7 4.24 13.78 5.05 9.56 1.91 6.62 6.18 6.09z" /></Icon>;
export const PinIcon = (p: IconProps) => <Icon {...p}><path d="M5.89 10.11 2.87 13.13M9.42 2.89l3.69 3.69M10.25 3.73 7.57 6.42l-3.19.16-1.01 1.01 5.04 5.04 1.01-1.01.16-3.19 2.69-2.68" /></Icon>;

/* Objects: the things people make and keep. */
export const FileIcon = (p: IconProps) => <Icon {...p}><path d="M4 1.75h5l3 3v9.5H4z" /><path d="M9 1.75v3h3" /></Icon>;
export const FolderIcon = (p: IconProps) => <Icon {...p}><path d="M1.75 3.25h4.5l1.5 1.5h6.5v8H1.75z" /></Icon>;
export const ImageIcon = (p: IconProps) => <Icon {...p}><rect x="2.25" y="2.75" width="11.5" height="10.5" /><circle cx="5.75" cy="6.25" r="1.25" /><path d="m2.25 11.75 3.5-3.5 2.75 2.75 1.75-1.75 3.5 3.5" /></Icon>;
export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M5.25 3.25v9.5L12.75 8z" /></Icon>;
export const PauseIcon = (p: IconProps) => <Icon {...p}><path d="M5.5 3.5v9M10.5 3.5v9" /></Icon>;
export const StopIcon = (p: IconProps) => <Icon {...p}><rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1" fill="currentColor" /></Icon>;
export const CodeIcon = (p: IconProps) => <Icon {...p}><path d="M5.75 4 1.75 8l4 4M10.25 4l4 4-4 4" /></Icon>;
export const TerminalIcon = (p: IconProps) => <Icon {...p}><path d="m2.75 4 4 4-4 4M8.75 12h4.5" /></Icon>;
export const MonitorIcon = (p: IconProps) => <Icon {...p}><rect x="1.75" y="2.75" width="12.5" height="8.5" /><path d="M8 11.25v2.5M5.5 13.75h5" /></Icon>;
export const GlobeIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="M1.75 8h12.5M8 1.75a2.75 6.25 0 0 0 0 12.5 2.75 6.25 0 0 0 0-12.5z" /></Icon>;
export const LayersIcon = (p: IconProps) => <Icon {...p}><path d="M8 2.75 14 6 8 9.25 2 6z" /><path d="m2 10 6 3.25L14 10" /></Icon>;
export const FrameIcon = (p: IconProps) => <Icon {...p}><path d="M4.25 1.75v12.5M11.75 1.75v12.5M1.75 4.25h12.5M1.75 11.75h12.5" /></Icon>;
export const CursorIcon = (p: IconProps) => <Icon {...p}><path d="M3 3 6.75 13.25l1.5-5 5-1.5z" /></Icon>;
export const GridIcon = (p: IconProps) => <Icon {...p}><rect x="2.75" y="2.75" width="3.5" height="3.5" /><rect x="9.75" y="2.75" width="3.5" height="3.5" /><rect x="2.75" y="9.75" width="3.5" height="3.5" /><rect x="9.75" y="9.75" width="3.5" height="3.5" /></Icon>;
export const ListIcon = (p: IconProps) => <Icon {...p}><path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.75 4v.01M2.75 8v.01M2.75 12v.01" /></Icon>;
export const BoxIcon = (p: IconProps) => <Icon {...p}><path d="M8 2.25 13.25 5v6L8 13.75 2.75 11V5z" /><path d="M2.75 5 8 7.75 13.25 5M8 7.75v6" /></Icon>;
export const DatabaseIcon = (p: IconProps) => <Icon {...p}><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" /></Icon>;
export const GitBranchIcon = (p: IconProps) => <Icon {...p}><circle cx="4.5" cy="3.75" r="1.75" /><circle cx="4.5" cy="12.25" r="1.75" /><circle cx="11.5" cy="3.75" r="1.75" /><path d="M4.5 5.5v5M11.5 5.5v.75a3 3 0 0 1-3 3h-1a3 3 0 0 0-3 3" /></Icon>;
export const CalendarIcon = (p: IconProps) => <Icon {...p}><rect x="2.25" y="3.25" width="11.5" height="10.5" /><path d="M2.25 6.75h11.5M5.5 1.75v3M10.5 1.75v3" /></Icon>;

/* Status and system: always beside their words. */
export const InfoIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v4M8 4.75v.01" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 4.75v4M8 11.25v.01" /></Icon>;
export const CheckCircleIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="m5.25 8.25 2 2 3.5-4.25" /></Icon>;
export const XCircleIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="m6 6 4 4m0-4-4 4" /></Icon>;
export const WarningIcon = (p: IconProps) => <Icon {...p}><path d="M8 2 14.25 13.25H1.75z" /><path d="M8 6.5v2.75M8 11.25v.01" /></Icon>;
export const HelpIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="M6.25 6.25a1.75 1.75 0 1 1 2.5 1.6c-.45.2-.75.65-.75 1.15v.25M8 11.25v.01" /></Icon>;
export const BellIcon = (p: IconProps) => <Icon {...p}><path d="M4 11.25V7a4 4 0 0 1 8 0v4.25l1 1H3zM6.5 13.75h3" /></Icon>;
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 4.75V8l2.25 1.5" /></Icon>;
export const HistoryIcon = (p: IconProps) => <Icon {...p}><path d="M2.75 8a5.25 5.25 0 1 0 1.55-3.7M2.75 2.75v3h3M8 5.5V8l1.75 1.25" /></Icon>;
export const ZapIcon = (p: IconProps) => <Icon {...p}><path d="M9 1.75 3.25 9.25H8l-1 5 5.75-7.5H8z" /></Icon>;
export const ActivityIcon = (p: IconProps) => <Icon {...p}><path d="M1.75 8h2.5l2-5.25 3.5 10.5 2-5.25h2.5" /></Icon>;
export const ShieldIcon = (p: IconProps) => <Icon {...p}><path d="M8 1.75 13 3.5v4.25c0 3-2.1 5-5 6.5-2.9-1.5-5-3.5-5-6.5V3.5z" /></Icon>;
export const KeyIcon = (p: IconProps) => <Icon {...p}><circle cx="5.25" cy="10.75" r="3" /><path d="m7.4 8.6 6.1-6.1M11.5 4.5l1.75 1.75M9.75 6.25 11 7.5" /></Icon>;
export const FlagIcon = (p: IconProps) => <Icon {...p}><path d="M3.25 14.25V2.25h9.5l-2.25 3.25 2.25 3.25h-9.5" /></Icon>;
export const CloudIcon = (p: IconProps) => <Icon {...p}><path d="M4.75 12.25A2.75 2.75 0 0 1 4.02 6.85A4 4 0 0 1 11.88 6.27A3 3 0 0 1 11.5 12.25z" /></Icon>;
export const SunIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" /></Icon>;
export const MoonIcon = (p: IconProps) => <Icon {...p}><path d="M13.25 9.4A5.5 5.5 0 0 1 6.6 2.75 5.5 5.5 0 1 0 13.25 9.4z" /></Icon>;
export const SparkleIcon = (p: IconProps) => <Icon {...p}><path d="M8 1.75c.5 3.4 2.85 5.75 6.25 6.25-3.4.5-5.75 2.85-6.25 6.25-.5-3.4-2.85-5.75-6.25-6.25C5.15 7.5 7.5 5.15 8 1.75z" /></Icon>;
export const LightbulbIcon = (p: IconProps) => <Icon {...p}><path d="M6 11v-.4c0-.9-.5-1.5-1.1-2.2A4.25 4.25 0 1 1 11.1 8.4c-.6.7-1.1 1.3-1.1 2.2v.4z" /><path d="M6.5 13.25h3" /></Icon>;

/* People and data. */
export const UserIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="5.5" r="2.75" /><path d="M2.75 13.75c.8-2.4 2.9-3.75 5.25-3.75s4.45 1.35 5.25 3.75" /></Icon>;
export const UsersIcon = (p: IconProps) => <Icon {...p}><circle cx="6" cy="5.5" r="2.5" /><path d="M1.75 13.25c.65-2.1 2.2-3.25 4.25-3.25s3.6 1.15 4.25 3.25M10.5 3.15a2.5 2.5 0 0 1 0 4.7M11.75 10.2c1.25.4 2.1 1.4 2.5 3.05" /></Icon>;
export const BuildingIcon = (p: IconProps) => <Icon {...p}><path d="M3.25 14.25V1.75h9.5v12.5M1.75 14.25h12.5M6.5 14.25v-2.75h3v2.75M6.25 4.5v.01M9.75 4.5v.01M6.25 8v.01M9.75 8v.01" /></Icon>;
export const MailIcon = (p: IconProps) => <Icon {...p}><rect x="1.75" y="3.25" width="12.5" height="9.5" /><path d="m2.25 3.75 5.75 4.5 5.75-4.5" /></Icon>;
export const InboxIcon = (p: IconProps) => <Icon {...p}><path d="M1.75 8.25v4.5h12.5v-4.5L12 3.25H4zM1.75 8.25h3.5l1 1.75h3.5l1-1.75h3.5" /></Icon>;
export const MessageIcon = (p: IconProps) => <Icon {...p}><path d="M1.75 2.75h12.5v8.5H6.5l-3 2.5v-2.5H1.75z" /></Icon>;
export const AtSignIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="8" r="2.5" /><path d="M10.5 5.5v3.25a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.35 4.77" /></Icon>;
export const HashIcon = (p: IconProps) => <Icon {...p}><path d="M6.75 2.75 5.25 13.25M10.75 2.75l-1.5 10.5M2.75 6h10.5M2.75 10h10.5" /></Icon>;
export const CommandIcon = (p: IconProps) => <Icon {...p}><path d="M9.75 4.75v6.5a1.75 1.75 0 1 0 1.75-1.75h-7a1.75 1.75 0 1 0 1.75 1.75v-6.5A1.75 1.75 0 1 0 4.5 6.5h7a1.75 1.75 0 1 0-1.75-1.75z" /></Icon>;
export const ChartBarIcon = (p: IconProps) => <Icon {...p}><path d="M3.5 13.25v-4.5M8 13.25V2.75M12.5 13.25v-7" /></Icon>;
export const ChartLineIcon = (p: IconProps) => <Icon {...p}><path d="M2.25 2.25v11.5h11.5M5 10.25 7.75 7l2.5 2 3.5-4.5" /></Icon>;
export const ChartPieIcon = (p: IconProps) => <Icon {...p}><path d="M7.25 3.25a5.5 5.5 0 1 0 5.5 5.5h-5.5z" /><path d="M9.25 1.75a5 5 0 0 1 5 5h-5z" /></Icon>;
export const TrendUpIcon = (p: IconProps) => <Icon {...p}><path d="m1.75 11.5 4.5-4.5 2.5 2.5 5.5-5.5M10.5 4h3.75v3.75" /></Icon>;
export const TrendDownIcon = (p: IconProps) => <Icon {...p}><path d="m1.75 4.5 4.5 4.5 2.5-2.5 5.5 5.5M10.5 12h3.75V8.25" /></Icon>;
export const CreditCardIcon = (p: IconProps) => <Icon {...p}><rect x="1.75" y="3.25" width="12.5" height="9.5" /><path d="M1.75 6.5h12.5M4.5 9.75h2" /></Icon>;
export const BagIcon = (p: IconProps) => <Icon {...p}><rect x="3.25" y="5.25" width="9.5" height="9" /><path d="M5.75 5.25V4a2.25 2.25 0 0 1 4.5 0v1.25" /></Icon>;

/** Where a step, a tool call or a task stands. The Timeline draws the same five marks. */
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

/**
 * The status mark for steps and tool calls: an empty circle (pending), a half-filled circle (running,
 * never spinning or pulsing), a check in a circle (done), an x in a circle (failed) and a dashed circle
 * (skipped). It takes the text color, so the caller sets the tone (--litt-fg for running, --litt-fg-muted for done,
 * --litt-danger for failed, --litt-fg-subtle for pending and skipped). Decorative: say the status in words beside it.
 */
export function StatusIcon({ status, ...p }: IconProps & { status: StepStatus }) {
  const skipped = status === "skipped";
  return (
    <Icon {...p}>
      <circle cx="8" cy="8" r="6.25" strokeDasharray={skipped ? "2.45" : undefined} strokeLinecap={skipped ? "butt" : undefined} />
      {status === "done" && <path d="m5.25 8.25 2 2 3.5-4.25" />}
      {status === "running" && <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />}
      {status === "failed" && <path d="m6 6 4 4m0-4-4 4" />}
    </Icon>
  );
}
