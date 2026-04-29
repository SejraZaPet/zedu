import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import NotificationComposer from "./NotificationComposer";

type ReceiverType = "all" | "all_teachers" | "all_students" | "class" | "user";

interface Props {
  /** "teacher" nebo "admin" */
  mode?: "admin" | "teacher";
  /** Předvyplněný titulek */
  title?: string;
  /** Předvyplněný text */
  content?: string;
  /** Cílová skupina */
  receiverType?: ReceiverType;
  receiverIds?: string[];
  /** Volitelný odkaz */
  link?: string;
  /** Velikost tlačítka */
  size?: "sm" | "default" | "icon";
  /** Variant tlačítka */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Vlastní label (jinak "Připomenout") */
  label?: string;
}

/**
 * Tlačítko 🔔 Připomenout — otevře dialog s NotificationComposerem
 * předvyplněným kontextem (úkol, třída apod.).
 */
export default function RemindButton({
  mode = "teacher",
  title,
  content,
  receiverType = "class",
  receiverIds = [],
  link,
  size = "sm",
  variant = "outline",
  label = "Připomenout",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Bell className="w-4 h-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Poslat připomenutí</DialogTitle>
        </DialogHeader>
        <NotificationComposer
          mode={mode}
          defaults={{
            title,
            content,
            receiverType,
            receiverIds,
            type: "reminder",
            link,
          }}
          onSent={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
