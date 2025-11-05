import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

export function CreateMultipleGroups() {
  const [quantity, setQuantity] = useState("1");
  const [admins, setAdmins] = useState<string[]>([""]);
  const { toast } = useToast();

  const addAdmin = () => {
    setAdmins([...admins, ""]);
  };

  const removeAdmin = (index: number) => {
    setAdmins(admins.filter((_, i) => i !== index));
  };

  const updateAdmin = (index: number, value: string) => {
    const newAdmins = [...admins];
    newAdmins[index] = value;
    setAdmins(newAdmins);
  };

  const handleCreate = () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "Insira um número entre 1 e 100",
      });
      return;
    }

    const validAdmins = admins.filter(admin => admin.trim() !== "");
    if (validAdmins.length === 0) {
      toast({
        variant: "destructive",
        title: "Adicione ao menos um admin",
        description: "Insira pelo menos um número de admin",
      });
      return;
    }

    toast({
      title: "Grupos criados!",
      description: `${qty} grupo(s) criado(s) com os nomes #1, #2, #3...`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Criar Vários Grupos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Múltiplos Grupos</DialogTitle>
          <DialogDescription>
            Crie vários grupos de uma vez com numeração automática
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantidade de Grupos</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="100"
              placeholder="Ex: 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Os grupos serão nomeados como: Grupo #1, Grupo #2, Grupo #3...
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Números dos Admins</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAdmin}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {admins.map((admin, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Ex: +5511999999999"
                    value={admin}
                    onChange={(e) => updateAdmin(index, e.target.value)}
                  />
                  {admins.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAdmin(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Adicione os números dos admins que serão adicionados aos grupos
            </p>
          </div>

          <Button onClick={handleCreate} className="w-full">
            Criar {quantity || "0"} Grupo(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
