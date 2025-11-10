import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Trash2, Eye, Search, Check, AlertCircle, ArrowUp, ArrowDown, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableGroupRow } from "@/components/SortableGroupRow";

interface Group {
  id: string;
  name: string;
  wa_group_id: string;
  invite_code?: string;
  members_count: number;
  member_limit: number;
  priority?: number;
  click_limit?: number;
  is_favorite?: boolean;
}

export default function RedirectLink() {
  const [slug, setSlug] = useState("");
  const [linkName, setLinkName] = useState("");
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [groupPriorities, setGroupPriorities] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [savedLinks, setSavedLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distributionStrategy, setDistributionStrategy] = useState<'member_limit' | 'click_limit'>('member_limit');
  const [editingLink, setEditingLink] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      loadSavedLinks();
      loadGroups();
      // Gerar slug aleatória ao carregar
      generateRandomSlug();
    }
  }, [user]);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, wa_group_id, invite_code, members_count, member_limit, is_favorite')
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setAllGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar grupos",
        description: "Não foi possível carregar seus grupos",
      });
    }
  };

  const loadSavedLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_redirect_links')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedLinks(data || []);
    } catch (error) {
      console.error('Error loading saved links:', error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGroupPriorities((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          priority: index + 1,
        }));

        toast({
          title: "Ordem atualizada",
          description: "A prioridade dos grupos foi alterada",
        });

        return updatedItems;
      });
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const applyGroupSelection = () => {
    const selectedGroups = allGroups
      .filter(g => selectedGroupIds.includes(g.id))
      .map((g, index) => ({
        ...g,
        priority: index + 1
      }));
    setGroupPriorities(selectedGroups);
    setSelectedGroupIds(selectedGroups.map(g => g.id));
    setDialogOpen(false);
    toast({
      title: "Grupos atualizados",
      description: `${selectedGroups.length} grupo(s) selecionado(s) para este link`,
    });
  };

  const generateRandomSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomSlug = '';
    for (let i = 0; i < 8; i++) {
      randomSlug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSlug(randomSlug);
  };

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

  const handleCreateLink = async () => {
    if (!linkName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Por favor, dê um nome para seu redirecionamento",
      });
      return;
    }

    if (!slug.trim()) {
      toast({
        variant: "destructive",
        title: "Slug obrigatório",
        description: "Por favor, insira um slug para seu link",
      });
      return;
    }

    if (groupPriorities.length === 0) {
      toast({
        variant: "destructive",
        title: "Grupos obrigatórios",
        description: "Selecione pelo menos um grupo",
      });
      return;
    }

    // Validar slug (apenas letras minúsculas, números e hífens)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      toast({
        variant: "destructive",
        title: "Slug inválido",
        description: "Use apenas letras minúsculas, números e hífens",
      });
      return;
    }

    setLoading(true);
    try {
      // Verificar se slug já existe
      const { data: existing } = await supabase
        .from('saved_redirect_links')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        toast({
          variant: "destructive",
          title: "Slug já existe",
          description: "Escolha outro nome para seu link",
        });
        setLoading(false);
        return;
      }

      // Validar limites de cliques se usando estratégia click_limit
      if (distributionStrategy === 'click_limit') {
        const hasInvalidLimits = groupPriorities.some(g => 
          !g.click_limit || g.click_limit <= 0
        );
        
        if (hasInvalidLimits) {
          toast({
            variant: "destructive",
            title: "Limites de cliques obrigatórios",
            description: "Configure quantos cliques cada grupo deve receber",
          });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('saved_redirect_links')
        .insert({
          user_id: user?.id,
          name: linkName.trim(),
          slug: slug.toLowerCase(),
          distribution_strategy: distributionStrategy,
          group_priorities: groupPriorities.map(g => ({
            id: g.id,
            name: g.name,
            wa_group_id: g.wa_group_id,
            invite_code: g.invite_code,
            members_count: g.members_count,
            member_limit: g.member_limit,
            priority: g.priority,
            click_limit: g.click_limit || 0
          })),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Limpar form e gerar nova slug
      setLinkName("");
      setSlug("");
      setGroupPriorities([]);
      setSelectedGroupIds([]);
      generateRandomSlug();
      
      await loadSavedLinks();
      
      toast({
        title: "Link criado!",
        description: "Seu link de redirecionamento foi salvo com sucesso",
      });
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível criar o link",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('saved_redirect_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      await loadSavedLinks();
      toast({
        title: "Link excluído",
        description: "O link foi removido com sucesso",
      });
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o link",
      });
    }
  };

  const startEditLink = (link: any) => {
    setEditingLink(link);
    setLinkName(link.name || '');
    setSlug(link.slug);
    setDistributionStrategy(link.distribution_strategy || 'click_limit');
    
    // Carregar grupos do link
    const linkGroups = link.group_priorities as any[];
    setGroupPriorities(linkGroups.map((g: any) => ({
      ...g,
      is_favorite: allGroups.find(ag => ag.id === g.id)?.is_favorite || false
    })));
    setSelectedGroupIds(linkGroups.map((g: any) => g.id));
    
    // Scroll para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    toast({
      title: "Editando link",
      description: "Altere as informações e clique em 'Atualizar Link'",
    });
  };

  const cancelEdit = () => {
    setEditingLink(null);
    setLinkName("");
    setSlug("");
    setGroupPriorities([]);
    setSelectedGroupIds([]);
    generateRandomSlug();
    
    toast({
      title: "Edição cancelada",
      description: "Formulário resetado",
    });
  };

  const handleUpdateLink = async () => {
    if (!editingLink) return;

    setLoading(true);
    try {
      // Validações
      if (!linkName.trim()) {
        toast({
          variant: "destructive",
          title: "Nome obrigatório",
          description: "Por favor, dê um nome para seu redirecionamento",
        });
        setLoading(false);
        return;
      }

      if (groupPriorities.length === 0) {
        toast({
          variant: "destructive",
          title: "Grupos obrigatórios",
          description: "Selecione pelo menos um grupo",
        });
        setLoading(false);
        return;
      }

      if (distributionStrategy === 'click_limit') {
        const hasInvalidLimits = groupPriorities.some(g => 
          !g.click_limit || g.click_limit <= 0
        );
        
        if (hasInvalidLimits) {
          toast({
            variant: "destructive",
            title: "Limites de cliques obrigatórios",
            description: "Configure quantos cliques cada grupo deve receber",
          });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('saved_redirect_links')
        .update({
          name: linkName.trim(),
          distribution_strategy: distributionStrategy,
          group_priorities: groupPriorities.map(g => ({
            id: g.id,
            name: g.name,
            wa_group_id: g.wa_group_id,
            invite_code: g.invite_code,
            members_count: g.members_count,
            member_limit: g.member_limit,
            priority: g.priority,
            click_limit: g.click_limit || 0
          })),
        })
        .eq('id', editingLink.id);

      if (error) throw error;

      cancelEdit();
      await loadSavedLinks();
      
      toast({
        title: "Link atualizado!",
        description: "As alterações foram salvas com sucesso",
      });
    } catch (error: any) {
      console.error('Error updating link:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível atualizar o link",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (editingLink) {
      await handleUpdateLink();
    } else {
      await handleCreateLink();
    }
  };

  const copyToClipboard = (linkSlug: string) => {
    const link = `${window.location.origin}/r/${linkSlug}`;
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
            <CardTitle>{editingLink ? 'Editar Link' : 'Configurar Link'}</CardTitle>
            <CardDescription>
              {editingLink ? 'Altere as informações do seu link' : 'Personalize seu link de redirecionamento'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingLink && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Editando link existente</span>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>IMPORTANTE:</strong> Use apenas grupos onde você é Admin. Grupos sem permissão de admin podem não funcionar corretamente.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="linkName">Nome do Redirecionamento</Label>
              <Input
                id="linkName"
                placeholder="Ex: Campanha Black Friday 2025"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nome para identificar facilmente seu link
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug do Link (gerada automaticamente)</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-secondary rounded-l-lg text-muted-foreground">
                  /r/
                </span>
                <Input
                  id="slug"
                  placeholder="slug-aleatoria"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 rounded-l-none"
                  disabled={!!editingLink}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {editingLink ? 'A slug não pode ser alterada após criar o link' : 'Slug gerada automaticamente. Você pode editá-la se quiser.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estratégia de Distribuição</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="click_limit"
                    name="strategy"
                    value="click_limit"
                    checked={distributionStrategy === 'click_limit'}
                    onChange={() => setDistributionStrategy('click_limit')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="click_limit" className="font-normal cursor-pointer">
                    Limite de Cliques
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="member_limit"
                    name="strategy"
                    value="member_limit"
                    checked={distributionStrategy === 'member_limit'}
                    onChange={() => setDistributionStrategy('member_limit')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="member_limit" className="font-normal cursor-pointer">
                    Vagas Disponíveis
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {distributionStrategy === 'click_limit' 
                  ? "Configure quantos cliques cada grupo deve receber antes de passar para o próximo" 
                  : "Distribui baseado em vagas disponíveis (membros vs limite)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Grupos da Campanha</Label>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Selecionar Grupos ({selectedGroupIds.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Selecionar Grupos</DialogTitle>
                    <DialogDescription>
                      Escolha os grupos que farão parte desta campanha
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="Buscar grupos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                    <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                      {searchTerm === '' && allGroups.length > 0 && (
                        <>
                          {allGroups.filter(g => g.is_favorite).length > 0 && (
                            <>
                              <p className="text-xs font-semibold text-muted-foreground mb-2">⭐ Favoritos</p>
                              {allGroups.filter(g => g.is_favorite).map((group) => (
                                <div key={group.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`link-group-${group.id}`}
                                    checked={selectedGroupIds.includes(group.id)}
                                    onCheckedChange={() => toggleGroupSelection(group.id)}
                                  />
                                  <Label
                                    htmlFor={`link-group-${group.id}`}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    {group.name}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({group.members_count}/{group.member_limit})
                                    </span>
                                  </Label>
                                </div>
                              ))}
                              <div className="border-t my-2"></div>
                            </>
                          )}
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Todos os Grupos</p>
                        </>
                      )}
                      {allGroups
                        .filter(g => searchTerm === '' || g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .filter(g => searchTerm !== '' || !g.is_favorite)
                        .map((group) => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`link-group-${group.id}`}
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={() => toggleGroupSelection(group.id)}
                          />
                          <Label
                            htmlFor={`link-group-${group.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {group.name}
                            <span className="text-xs text-muted-foreground ml-2">
                              ({group.members_count}/{group.member_limit})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Button onClick={applyGroupSelection} className="w-full">
                      Aplicar Seleção
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <p className="text-xs text-muted-foreground">
                {selectedGroupIds.length} grupo(s) selecionado(s) para esta campanha
              </p>
            </div>

            <Button 
              onClick={handleCreateOrUpdate} 
              disabled={loading || !linkName.trim() || !slug.trim() || groupPriorities.length === 0} 
              className="w-full"
            >
              {loading ? "Salvando..." : editingLink ? "Atualizar Link" : "Criar e Salvar Link"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-card to-secondary/20">
          <CardHeader>
            <CardTitle>Links Salvos</CardTitle>
            <CardDescription>
              Seus links de redirecionamento criados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedLinks.length > 0 ? (
              savedLinks.map((link) => (
                <div key={link.id} className="p-4 bg-background rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm mb-1">{link.name || 'Sem nome'}</h3>
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs text-muted-foreground">/r/{link.slug}</code>
                        {link.is_active && (
                          <Badge variant="outline" className="text-xs">Ativo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {link.total_clicks} clique(s) • {new Date(link.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => copyToClipboard(link.slug)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => startEditLink(link)}
                      title="Editar link"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => window.open(`/r/${link.slug}`, '_blank')}
                      title="Abrir link"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteLink(link.id)}
                      title="Excluir link"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum link salvo ainda</p>
                <p className="text-xs mt-1">Crie seu primeiro link ao lado</p>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ordem</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Link WhatsApp</TableHead>
                  {distributionStrategy === 'click_limit' && (
                    <TableHead>Limite Cliques</TableHead>
                  )}
                  {distributionStrategy === 'member_limit' && (
                    <TableHead>Membros</TableHead>
                  )}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={groupPriorities.map(g => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {groupPriorities.map((group, index) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        #{group.priority || index + 1}
                      </TableCell>
                      <TableCell>{group.name}</TableCell>
                      <TableCell>
                        {group.invite_code ? (
                          <Badge variant="outline" className="text-xs">
                            <Check className="mr-1 h-3 w-3" />
                            Configurado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Sem link
                          </Badge>
                        )}
                      </TableCell>
                      {distributionStrategy === 'click_limit' && (
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Ex: 50"
                            value={group.click_limit || ''}
                            onChange={(e) => {
                              const newLimit = parseInt(e.target.value) || 0;
                              setGroupPriorities(prev =>
                                prev.map(g =>
                                  g.id === group.id ? { ...g, click_limit: newLimit } : g
                                )
                              );
                            }}
                            className="w-24"
                          />
                        </TableCell>
                      )}
                      {distributionStrategy === 'member_limit' && (
                        <TableCell>
                          {group.members_count}/{group.member_limit}
                        </TableCell>
                      )}
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
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
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
              <li>Cada clique é contabilizado automaticamente</li>
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