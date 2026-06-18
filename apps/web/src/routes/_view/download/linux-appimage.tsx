import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_view/download/linux-appimage")({
  beforeLoad: async () => {
    throw redirect({
      href: "https://desktop2.meetspace.com/download/latest/appimage-x86_64?channel=stable",
    } as any);
  },
});
