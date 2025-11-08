import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Key, Webhook, MessageSquare, BookOpen } from "lucide-react";

interface Setting {
  key: string;
  value: string | null;
  description: string | null;
}

export default function SettingsTab() {
  const [settings, setSettings] = useState({
    resend_api_key: "",
    kiwify_webhook_token: "",
    evolution_api_key: "",
    evolution_api_url: "",
    support_whatsapp: "",
    tutorial_link: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['resend_api_key', 'kiwify_webhook_token', 'evolution_api_key', 'evolution_api_url', 'support_whatsapp', 'tutorial_link']);

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc: any, setting: Setting) => {
        acc[setting.key] = setting.value || "";
        return acc;
      }, {});

      setSettings({
        resend_api_key: settingsMap.resend_api_key || "",
        kiwify_webhook_token: settingsMap.kiwify_webhook_token || "",
        evolution_api_key: settingsMap.evolution_api_key || "",
        evolution_api_url: settingsMap.evolution_api_url || "",
        support_whatsapp: settingsMap.support_whatsapp || "",
        tutorial_link: settingsMap.tutorial_link || "",
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const settingsToSave = [
        { key: 'resend_api_key', value: settings.resend_api_key, description: 'Chave da API Resend para envio de emails' },
        { key: 'kiwify_webhook_token', value: settings.kiwify_webhook_token, description: 'Token de segurança para webhooks Kiwify' },
        { key: 'evolution_api_key', value: settings.evolution_api_key, description: 'Chave da API Evolution' },
        { key: 'evolution_api_url', value: settings.evolution_api_url, description: 'URL da API Evolution' },
        { key: 'support_whatsapp', value: settings.support_whatsapp, description: 'Número do WhatsApp de suporte' },
        { key: 'tutorial_link', value: settings.tutorial_link, description: 'Link para os tutoriais da ferramenta' },
      ];

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: setting.key,
            value: setting.value,
            description: setting.description,
            updated_by: user?.id,
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resend API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Resend API</CardTitle>
          </div>
          <CardDescription>
            Configure a API do Resend para envio de emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resend_api_key">API Key</Label>
            <Input
              id="resend_api_key"
              type="password"
              placeholder="re_••••••••••••••••"
              value={settings.resend_api_key}
              onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave em: <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">https://resend.com/api-keys</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Kiwify Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <CardTitle>Kiwify Webhook</CardTitle>
          </div>
          <CardDescription>
            Token de segurança para validação de webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kiwify_webhook_token">Token de Segurança</Label>
            <Input
              id="kiwify_webhook_token"
              type="password"
              placeholder="••••••••••••"
              value={settings.kiwify_webhook_token}
              onChange={(e) => setSettings({...settings, kiwify_webhook_token: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Este token é usado para validar requisições de webhook da Kiwify. Configure o mesmo token no painel da Kiwify.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Evolution API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Evolution API</CardTitle>
          </div>
          <CardDescription>
            Configure a conexão com a Evolution API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolution_api_url">URL da API</Label>
            <Input
              id="evolution_api_url"
              type="url"
              placeholder="https://evolution-api.com"
              value={settings.evolution_api_url}
              onChange={(e) => setSettings({...settings, evolution_api_url: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evolution_api_key">API Key</Label>
            <Input
              id="evolution_api_key"
              type="password"
              placeholder="••••••••••••••••"
              value={settings.evolution_api_key}
              onChange={(e) => setSettings({...settings, evolution_api_key: e.target.value})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurações da Aplicação */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Configurações da Aplicação</CardTitle>
          </div>
          <CardDescription>
            Configure números de suporte e links de tutoriais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support_whatsapp">WhatsApp de Suporte</Label>
            <Input
              id="support_whatsapp"
              type="text"
              placeholder="5511999999999"
              value={settings.support_whatsapp}
              onChange={(e) => setSettings({...settings, support_whatsapp: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Digite o número com código do país sem espaços ou símbolos (ex: 5511999999999)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tutorial_link">Link dos Tutoriais</Label>
            <Input
              id="tutorial_link"
              type="url"
              placeholder="https://exemplo.com/tutoriais"
              value={settings.tutorial_link}
              onChange={(e) => setSettings({...settings, tutorial_link: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Link para a página de tutoriais da ferramenta
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
        {saving ? (
          <>Salvando...</>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </>
        )}
      </Button>
    </div>
  );
}
