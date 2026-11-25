import type { RoomId } from "./types";

export type Room = {
  id: RoomId;
  name: string;
  shortName: string;
  capacity: string;
  location: string;
  /** Optional room logo shown instead of the initials badge */
  logo?: string;
  /** Tailwind colour tokens used by the board */
  accent: {
    bg: string;
    bgSoft: string;
    border: string;
    text: string;
    ring: string;
  };
};

export const ROOMS: Room[] = [
  {
    id: "room10",
    name: "ห้องประชุมกาลพฤกษ์ 10",
    shortName: "กาลพฤกษ์ 10",
    capacity: "10 ที่นั่ง",
    location: "กองทรัพยากรบุคคล",
    accent: {
      bg: "bg-brand-700",
      bgSoft: "bg-brand-50",
      border: "border-brand-200",
      text: "text-brand-700",
      ring: "ring-brand-500",
    },
  },
  {
    id: "smart",
    name: "ห้อง SMART Meeting",
    shortName: "SMART Meeting",
    capacity: "6 ที่นั่ง",
    location: "กองทรัพยากรบุคคล",
    logo: "/smart-hr.png",
    accent: {
      bg: "bg-brand-700",
      bgSoft: "bg-brand-50",
      border: "border-brand-200",
      text: "text-brand-700",
      ring: "ring-brand-500",
    },
  },
];

export function getRoom(id: string): Room | undefined {
  return ROOMS.find((room) => room.id === id);
}

export function isRoomId(value: string): value is RoomId {
  return value === "room10" || value === "smart";
}
