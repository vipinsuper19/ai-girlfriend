import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surfaces";

export function NoCompanion({
  title = "She's not here yet",
  description = "Finish creating her whenever you're ready. You can keep looking around in the meantime.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Button asChild>
          <Link href="/onboarding">Create companion</Link>
        </Button>
      }
    />
  );
}
