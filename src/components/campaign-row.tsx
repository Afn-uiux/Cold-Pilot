"use client";

import { useRouter } from "next/navigation";

export function CampaignRow({ id, name, leads, steps, status }: { id: string; name: string; leads: number; steps: number; status: string }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(`/dashboard/campaigns/${id}`)} className="cursor-pointer hover:bg-cream-2 transition-colors">
      <td className="font-medium">{name}</td>
      <td>{leads}</td>
      <td>{steps}</td>
      <td><span className={`badge ${status}`}>{status}</span></td>
    </tr>
  );
}