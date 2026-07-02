import { EmptyState } from "@/components/ui/empty-state";
import { Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          This section is under development.
        </p>
      </div>
      <EmptyState
        icon={<Construction className="h-5 w-5" />}
        title={`${title} module coming soon`}
        description="This feature is being implemented and will be available in the next update."
      />
    </div>
  );
}
