import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lock, Unlock, MessageSquare, FileEdit } from "lucide-react";

// Dados de exemplo
const mockGroups = [
  { id: "1", name: "Grupo VIP 1", members: 245, limit: 500, status: "open" },
  { id: "2", name: "Grupo VIP 2", members: 487, limit: 500, status: "open" },
  { id: "3", name: "Grupo Premium", members: 500, limit: 500, status: "full" },
  { id: "4", name: "Suporte Clientes", members: 156, limit: 300, status: "closed" },
];

export default function Groups() {
  const [groups] = useState(mockGroups);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map((g) => g.id));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum grupo selecionado",
        description: "Selecione pelo menos um grupo para executar esta ação",
      });
      return;
    }

    toast({
      title: "Ação executada",
      description: `${action} aplicado em ${selectedGroups.length} grupo(s)`,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      open: { label: "Aberto", className: "bg-gradient-success" },
      closed: { label: "Fechado", className: "bg-destructive" },
      full: { label: "Cheio", className: "bg-primary" },
    };

    const variant = variants[status] || variants.open;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Gestão de Grupos</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todos os seus grupos do WhatsApp em um só lugar
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Ações em Massa</CardTitle>
          <CardDescription>
            {selectedGroups.length} grupo(s) selecionado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleBulkAction("Fechar grupos")}
          >
            <Lock className="mr-2 h-4 w-4" />
            Fechar Grupos
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction("Abrir grupos")}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Abrir Grupos
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Enviar Mensagem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Mensagem</DialogTitle>
                <DialogDescription>
                  Envie uma mensagem para os grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    placeholder="Digite sua mensagem..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Enviar mensagem")}
                >
                  Enviar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileEdit className="mr-2 h-4 w-4" />
                Alterar Descrição
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Descrição</DialogTitle>
                <DialogDescription>
                  Atualize a descrição dos grupos selecionados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Nova Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Digite a nova descrição..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBulkAction("Alterar descrição")}
                >
                  Atualizar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Seus Grupos</CardTitle>
          <CardDescription>
            Lista completa de grupos importados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedGroups.length === groups.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nome do Grupo</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.members}</TableCell>
                  <TableCell>{group.limit}</TableCell>
                  <TableCell>{getStatusBadge(group.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
