import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Save } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_semester: number;
  price_annual: number;
  group_limit: number;
  storage_limit: number;
  features: string[];
  kiwify_product_id_monthly: string | null;
  kiwify_product_id_semester: string | null;
  kiwify_product_id_annual: string | null;
  is_active: boolean;
}

export default function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    price_monthly: "0",
    price_semester: "0",
    price_annual: "0",
    group_limit: "1",
    storage_limit: "1000000000",
    features: "",
    kiwify_product_id_monthly: "",
    kiwify_product_id_semester: "",
    kiwify_product_id_annual: "",
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      
      // Transform features from Json to string[]
      const transformedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features as string[] : []
      }));
      
      setPlans(transformedPlans);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || "",
        price_monthly: plan.price_monthly.toString(),
        price_semester: plan.price_semester.toString(),
        price_annual: plan.price_annual.toString(),
        group_limit: plan.group_limit.toString(),
        storage_limit: plan.storage_limit.toString(),
        features: plan.features.join("\n"),
        kiwify_product_id_monthly: plan.kiwify_product_id_monthly || "",
        kiwify_product_id_semester: plan.kiwify_product_id_semester || "",
        kiwify_product_id_annual: plan.kiwify_product_id_annual || "",
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        price_monthly: "0",
        price_semester: "0",
        price_annual: "0",
        group_limit: "1",
        storage_limit: "1000000000",
        features: "",
        kiwify_product_id_monthly: "",
        kiwify_product_id_semester: "",
        kiwify_product_id_annual: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSavePlan = async () => {
    try {
      const planData = {
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || null,
        price_monthly: parseFloat(formData.price_monthly),
        price_semester: parseFloat(formData.price_semester),
        price_annual: parseFloat(formData.price_annual),
        group_limit: parseInt(formData.group_limit),
        storage_limit: parseInt(formData.storage_limit),
        features: formData.features.split("\n").filter(f => f.trim()),
        kiwify_product_id_monthly: formData.kiwify_product_id_monthly || null,
        kiwify_product_id_semester: formData.kiwify_product_id_semester || null,
        kiwify_product_id_annual: formData.kiwify_product_id_annual || null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('plans')
          .insert([planData]);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      setIsDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error);
      toast.error(error.message || "Erro ao salvar plano");
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Plano excluído com sucesso!");
      fetchPlans();
    } catch (error: any) {
      console.error('Erro ao excluir plano:', error);
      toast.error(error.message || "Erro ao excluir plano");
    }
  };

  const formatStorage = (bytes: number) => {
    return `${(bytes / 1000000000).toFixed(0)}GB`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciamento de Planos</CardTitle>
              <CardDescription>
                Configure planos e conecte com produtos da Kiwify
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPlan ? "Editar Plano" : "Novo Plano"}
                  </DialogTitle>
                  <DialogDescription>
                    Configure as informações do plano e conecte com os produtos da Kiwify
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Plano</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({...formData, slug: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price_monthly">Preço Mensal (R$)</Label>
                      <Input
                        id="price_monthly"
                        type="number"
                        step="0.01"
                        value={formData.price_monthly}
                        onChange={(e) => setFormData({...formData, price_monthly: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price_semester">Preço Semestral (R$)</Label>
                      <Input
                        id="price_semester"
                        type="number"
                        step="0.01"
                        value={formData.price_semester}
                        onChange={(e) => setFormData({...formData, price_semester: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price_annual">Preço Anual (R$)</Label>
                      <Input
                        id="price_annual"
                        type="number"
                        step="0.01"
                        value={formData.price_annual}
                        onChange={(e) => setFormData({...formData, price_annual: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="group_limit">Limite de Grupos</Label>
                      <Input
                        id="group_limit"
                        type="number"
                        value={formData.group_limit}
                        onChange={(e) => setFormData({...formData, group_limit: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storage_limit">Armazenamento (bytes)</Label>
                      <Input
                        id="storage_limit"
                        type="number"
                        value={formData.storage_limit}
                        onChange={(e) => setFormData({...formData, storage_limit: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="features">Funcionalidades (uma por linha)</Label>
                    <Textarea
                      id="features"
                      rows={4}
                      value={formData.features}
                      onChange={(e) => setFormData({...formData, features: e.target.value})}
                      placeholder="Acesso básico&#10;5 grupos&#10;Suporte prioritário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">IDs dos Produtos Kiwify</Label>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kiwify_monthly">Produto Mensal</Label>
                        <Input
                          id="kiwify_monthly"
                          value={formData.kiwify_product_id_monthly}
                          onChange={(e) => setFormData({...formData, kiwify_product_id_monthly: e.target.value})}
                          placeholder="ID do produto mensal na Kiwify"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kiwify_semester">Produto Semestral</Label>
                        <Input
                          id="kiwify_semester"
                          value={formData.kiwify_product_id_semester}
                          onChange={(e) => setFormData({...formData, kiwify_product_id_semester: e.target.value})}
                          placeholder="ID do produto semestral na Kiwify"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kiwify_annual">Produto Anual</Label>
                        <Input
                          id="kiwify_annual"
                          value={formData.kiwify_product_id_annual}
                          onChange={(e) => setFormData({...formData, kiwify_product_id_annual: e.target.value})}
                          placeholder="ID do produto anual na Kiwify"
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSavePlan} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Plano
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço Mensal</TableHead>
                  <TableHead>Grupos</TableHead>
                  <TableHead>Armazenamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum plano cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>R$ {plan.price_monthly.toFixed(2)}</TableCell>
                      <TableCell>{plan.group_limit}</TableCell>
                      <TableCell>{formatStorage(plan.storage_limit)}</TableCell>
                      <TableCell>
                        {plan.is_active ? (
                          <Badge className="bg-green-500">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(plan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
