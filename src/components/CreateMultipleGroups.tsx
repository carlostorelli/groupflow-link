import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateMultipleGroups() {
  const [quantity, setQuantity] = useState("1");
  const [groupName, setGroupName] = useState("Grupo");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGroupPhoto(file);
      toast({
        title: "Foto selecionada",
        description: file.name,
      });
    }
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

    if (validAdmins.length < 2) {
      toast({
        variant: "destructive",
        title: "⚠️ Atenção: Segurança",
        description: "Por segurança, recomendamos ter pelo menos 2 admins em cada grupo",
      });
      return;
    }

    toast({
      title: "Grupos criados!",
      description: `${qty} grupo(s) criado(s): #1 ${groupName}, #2 ${groupName}, #3 ${groupName}...`,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Múltiplos Grupos</DialogTitle>
          <DialogDescription>
            Crie vários grupos de uma vez com configurações personalizadas
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ Importante:</strong> Por segurança, adicione pelo menos <strong>2 admins</strong> em cada grupo para evitar perda de acesso.
            </AlertDescription>
          </Alert>

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
              Os grupos serão nomeados como: #1 {groupName}, #2 {groupName}, #3 {groupName}...
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupName">Nome Base dos Grupos</Label>
            <Input
              id="groupName"
              placeholder="Ex: Ofertas Shopee"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Este será o nome base. Cada grupo receberá um número no final.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição dos Grupos</Label>
            <Textarea
              id="description"
              placeholder="Ex: Grupo exclusivo para ofertas e descontos diários da Shopee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Esta descrição será aplicada a todos os grupos criados
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status dos Grupos</Label>
            <Select value={status} onValueChange={(value: "open" | "closed") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">🔓 Aberto - Qualquer pessoa pode entrar</SelectItem>
                <SelectItem value="closed">🔒 Fechado - Apenas com convite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPhoto">Foto dos Grupos</Label>
            <div className="flex gap-2">
              <Input
                id="groupPhoto"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="flex-1"
              />
              {groupPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setGroupPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {groupPhoto && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>{groupPhoto.name}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Esta foto será aplicada a todos os grupos criados
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Números dos Admins (mínimo 2)</Label>
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
              Adicione os números dos admins (com código do país). Recomendamos pelo menos 2 admins por segurança.
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