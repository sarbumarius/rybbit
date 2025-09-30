"use client";

import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import GoalFormModal from "./GoalFormModal";

interface CreateGoalButtonProps {
  siteId: number;
}

export default function CreateGoalButton({ siteId }: CreateGoalButtonProps) {
  return (
    <>
      <GoalFormModal
        siteId={siteId}
        trigger={
          <Button className="flex items-center gap-1 fixed top-10 right-10 z-50" size="sm" variant="secondary">
            <Plus className="h-4 w-4" />

          </Button>
        }
      />
    </>
  );
}
