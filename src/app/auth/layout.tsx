import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Log in",
    template: "%s | ColdPilot",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}