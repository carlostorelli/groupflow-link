import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
}

export default function TeamTab() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Buscar roles de admin
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Buscar emails dos profiles
      const userIds = roles?.map(r => r.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combinar dados
      const emailMap = new Map(profiles?.map(p => [p.id, p.email]));
      const membersWithEmails = roles?.map(role => ({
        ...role,
        email: emailMap.get(role.user_id) || ''
      })) || [];

      setTeamMembers(membersWithEmails);
    } catch (error) {
      console.error('Erro ao buscar membros da equipe:', error);
      toast.error("Erro ao carregar membros da equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) {
      toast.error("Por favor, insira um email");
      return;
    }

    try {
      // Buscar o usuário pelo email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newAdminEmail)
        .single();

      if (profileError) {
        toast.error("Usuário não encontrado com este email");
        return;
      }

      // Adicionar role de admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: profile.id,
          role: 'admin'
        }]);

      if (roleError) {
        if (roleError.code === '23505') {
          toast.error("Este usuário já é um administrador");
        } else {
          throw roleError;
        }
        return;
      }

      toast.success("Administrador adicionado com sucesso!");
      setIsDialogOpen(false);
      setNewAdminEmail("");
      fetchTeamMembers();
    } catch (error: any) {
      console.error('Erro ao adicionar administrador:', error);
      toast.error(error.message || "Erro ao adicionar administrador");
    }
  };

  const handleRemoveAdmin = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja remover ${email} da equipe de administradores?`)) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Administrador removido com sucesso!");
      fetchTeamMembers();
    } catch (error: any) {
      console.error('Erro ao remover administrador:', error);
      toast.error(error.message || "Erro ao remover administrador");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciamento de Equipe</CardTitle>
              <CardDescription>
                Adicione e gerencie administradores do sistema
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Administrador</DialogTitle>
                  <DialogDescription>
                    Insira o email do usuário que deseja tornar administrador
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email do Usuário</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddAdmin} className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar como Administrador
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
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : teamMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum administrador cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge>Administrador</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(member.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveAdmin(member.id, member.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
