import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Edit, Plus, Trash2, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    const filtered = templates.filter(template =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTemplates(filtered);
  }, [searchTerm, templates]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
      setFilteredTemplates(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar modelos:', error);
      toast.error("Erro ao carregar modelos de e-mail");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          content: editingTemplate.content,
          description: editingTemplate.description,
          is_active: editingTemplate.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast.success("Modelo atualizado com sucesso!");
      setIsDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao salvar modelo:', error);
      toast.error("Erro ao salvar modelo");
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;

      toast.success(template.is_active ? "Modelo desativado" : "Modelo ativado");
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error("Erro ao atualizar status do modelo");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        Carregando modelos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Modelos de e-mail</CardTitle>
          </div>
          <CardDescription>
            Configurar modelos de e-mail
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aqui"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredTemplates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum modelo encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-blue-600">{template.subject}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={() => handleToggleActive(template)}
                          />
                          <Badge variant={template.is_active ? "default" : "secondary"}>
                            {template.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={isDialogOpen && editingTemplate?.id === template.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (!open) setEditingTemplate(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTemplate(template);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Editar Modelo de E-mail</DialogTitle>
                              <DialogDescription>
                                Modifique os campos do modelo de e-mail
                              </DialogDescription>
                            </DialogHeader>
                            {editingTemplate && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="name">Nome</Label>
                                  <Input
                                    id="name"
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({
                                      ...editingTemplate,
                                      name: e.target.value
                                    })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="subject">Assunto</Label>
                                  <Input
                                    id="subject"
                                    value={editingTemplate.subject}
                                    onChange={(e) => setEditingTemplate({
                                      ...editingTemplate,
                                      subject: e.target.value
                                    })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="description">Descrição</Label>
                                  <Textarea
                                    id="description"
                                    value={editingTemplate.description || ""}
                                    onChange={(e) => setEditingTemplate({
                                      ...editingTemplate,
                                      description: e.target.value
                                    })}
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="content">Conteúdo HTML</Label>
                                  <Textarea
                                    id="content"
                                    value={editingTemplate.content}
                                    onChange={(e) => setEditingTemplate({
                                      ...editingTemplate,
                                      content: e.target.value
                                    })}
                                    rows={10}
                                    className="font-mono text-sm"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Use variáveis como {"{{reset_link}}"}, {"{{company_name}}"}, {"{{plan_name}}"}, etc.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={editingTemplate.is_active}
                                    onCheckedChange={(checked) => setEditingTemplate({
                                      ...editingTemplate,
                                      is_active: checked
                                    })}
                                  />
                                  <Label>Modelo ativo</Label>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="outline" onClick={() => {
                                setIsDialogOpen(false);
                                setEditingTemplate(null);
                              }}>
                                Cancelar
                              </Button>
                              <Button onClick={handleSaveTemplate}>
                                Salvar Alterações
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
