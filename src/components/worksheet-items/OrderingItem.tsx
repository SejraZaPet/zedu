import { Input } from "@/components/ui/input";
import type { WorksheetItemProps } from "./types";

export default function OrderingItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const orderItems = item.orderItems ?? [];
  const currentOrder: string[] = Array.isArray(value) ? value : Array(orderItems.length).fill("");

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">Přiřaďte pořadí (1, 2, 3…) ke každé položce:</p>
      {orderItems.map((text, i) => (
        <div key={i} className="flex items-center gap-3">
          <Input
            className="w-14 h-8 text-center text-sm"
            type="number"
            min={1}
            max={orderItems.length}
            value={currentOrder[i] ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const next = [...currentOrder];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <span className="text-sm">{text}</span>
        </div>
      ))}
    </div>
  );
}
