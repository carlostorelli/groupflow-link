import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableGroupRowProps {
  group: {
    id: string;
    name: string;
    priority: number;
    members: number;
    limit: number;
  };
  index: number;
  totalGroups: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function SortableGroupRow({ 
  group, 
  index, 
  totalGroups, 
  onMoveUp, 
  onMoveDown 
}: SortableGroupRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-opacity",
        isDragging && "opacity-50"
      )}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          {group.priority}
        </div>
      </TableCell>
      <TableCell>{group.name}</TableCell>
      <TableCell>
        {group.members}/{group.limit}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMoveDown(index)}
            disabled={index === totalGroups - 1}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
