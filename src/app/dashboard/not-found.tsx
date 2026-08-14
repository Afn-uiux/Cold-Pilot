import Link from "next/link";

import { SmileIcon } from "@/components/icons/smile";

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-cream-2 border border-border flex items-center justify-center mx-auto mb-4">
          <SmileIcon size={20} className="text-muted" />
        </div>
        <h2 className="text-xl font-medium mb-2">Page not found</h2>
        <p className="text-sm text-muted mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
      </div>
    </div>
  );
}
