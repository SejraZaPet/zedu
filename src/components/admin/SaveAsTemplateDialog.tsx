import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { saveTextbookAsTemplate } from "@/lib/textbook-templates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  textbookId: string;
  textbookTitle: string;
  subjectSlug: string;
}

const SaveAsTemplateDialog = ({ open, onOpenChange, textbookId, textbookTitle, subjectSlug }: Props) => {
  const { toast } = useToast();
  const [name, setName] = useState(textbookTitle);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveTextbookAsTemplate({
        textbookId,
        subjectSlug,
        name: name.trim(),
        description: description.trim(),
        isPublic,
      });
      toast({ title: "Šablona uložena", description: isPublic ? "Šablona je sdílená." : "Šablona je soukromá." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message ?? "Nepodařilo se uložit šablonu.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uložit jako šablonu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            Šablona uloží strukturu kapitol a lekcí (bez konkrétního obsahu). Učitelé pak mohou
            podle této kostry vytvořit novou učebnici.
          </p>
          <div>
            <Label>Název šablony</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Popis (nepovinné)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="flex items-start gap-3 p-3 border border-border rounded-md bg-muted/30">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} id="is-public" />
            <div className="flex-1">
              <Label htmlFor="is-public" className="cursor-pointer text-sm font-medium">Sdílet veřejně</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pokud zapnuto, mohou šablonu používat všichni učitelé. Soukromá šablona zůstane jen vám.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Zrušit</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Uložit šablonu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
