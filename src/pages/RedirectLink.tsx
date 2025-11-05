import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Settings, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockGroupsForRedirect = [
  { id: "1", name: "Grupo 1", priority: 1, members: 245, limit: 500 },
  { id: "2", name: "Grupo 2", priority: 2, members: 180, limit: 500 },
  { id: "3", name: "Grupo 3", priority: 3, members: 320, limit: 500 },
  { id: "4", name: "Grupo VIP", priority: 4, members: 89, limit: 500 },
];

export default function RedirectLink() {
  const [slug, setSlug] = useState("meu-grupo");
  const [hasLink, setHasLink] = useState(false);
  const [groupPriorities, setGroupPriorities] = useState(mockGroupsForRedirect);
  const { toast } = useToast();

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriorities = [...groupPriorities];
    [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    newPriorities.forEach((group, idx) => {
      group.priority = idx + 1;
    });
    setGroupPriorities(newPriorities);
    toast({
      title: "Prioridade atualizada",
      description: "A ordem dos grupos foi alterada",
    });
  };

  const moveDown = (index: number) => {
    if (index === groupPriorities.length - 1) return;
    const newPriorities = [...groupPriorities];
    [newPriorities[index + 1], newPriorities[index]] = [newPriorities[index], newPriorities[index + 1]];
    newPriorities.forEach((group, idx) => {
      group.priority = idx + 1;
    });
    setGroupPriorities(newPriorities);
    toast({
      title: "Prioridade atualizada",
      description: "A ordem dos grupos foi alterada",
    });
  };

  const handleCreateLink = () => {
    if (!slug.trim()) {
      toast({
        variant: "destructive",
        title: "Slug obrigatório",
        description: "Por favor, insira um slug para seu link",
      });
      return;
    }

    setHasLink(true);
    toast({
      title: "Link criado!",
      description: "Seu link de redirecionamento foi criado com sucesso",
    });
  };

  const copyToClipboard = () => {
    const link = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para sua área de transferência",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Link de Redirecionamento</h1>
        <p className="text-muted-foreground mt-2">
          Crie um link inteligente que distribui automaticamente novos membros
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Configurar Link</CardTitle>
            <CardDescription>
              Personalize seu link de redirecionamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug do Link</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-secondary rounded-l-lg text-muted-foreground">
                  /r/
                </span>
                <Input
                  id="slug"
                  placeholder="meu-grupo"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use apenas letras minúsculas, números e hífens
              </p>
            </div>

            {hasLink ? (
              <div className="space-y-3">
                <Badge className="bg-gradient-success">
                  Link Ativo
                </Badge>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setHasLink(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Editar Link
                </Button>
              </div>
            ) : (
              <Button onClick={handleCreateLink} className="w-full">
                Criar Link
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-card to-secondary/20">
          <CardHeader>
            <CardTitle>Seu Link</CardTitle>
            <CardDescription>
              Compartilhe este link para distribuir membros automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLink ? (
              <>
                <div className="p-4 bg-background rounded-lg border-2 border-primary/20">
                  <code className="text-sm break-all">
                    {window.location.origin}/r/{slug}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </Button>
                  <Button variant="outline" size="icon">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Configure o slug e crie seu link para visualizá-lo aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Prioridade de Inserção dos Grupos</CardTitle>
          <CardDescription>
            Arraste ou use as setas para definir a ordem de preenchimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Ordem</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupPriorities.map((group, index) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveDown(index)}
                        disabled={index === groupPriorities.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              O sistema de redirecionamento inteligente distribui automaticamente novos membros
              para grupos que ainda têm vagas disponíveis seguindo a ordem de prioridade:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Uma pessoa acessa seu link personalizado</li>
              <li>O sistema verifica qual grupo tem maior prioridade e ainda tem vagas</li>
              <li>A pessoa é redirecionada automaticamente para o WhatsApp do grupo</li>
              <li>Quando um grupo atinge o limite, o próximo na ordem de prioridade é usado</li>
            </ol>
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-sm">
                <strong>Dica:</strong> Organize a ordem acima para controlar qual grupo deve ser
                preenchido primeiro. Os grupos no topo da lista têm prioridade maior.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
