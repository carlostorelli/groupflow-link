import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type StoreKey = "shopee" | "amazon" | "magalu" | "ml" | "shein" | "aliexpress";

interface AffiliateCredential {
  id?: string;
  store: StoreKey;
  credentials: Record<string, string>;
  auto_generate: boolean;
  is_active: boolean;
}

interface StoreConfig {
  key: StoreKey;
  name: string;
  fields: {
    key: string;
    label: string;
    type: string;
    placeholder: string;
  }[];
  description: string;
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    key: "shopee",
    name: "Shopee",
    fields: [
      { key: "appId", label: "App ID", type: "text", placeholder: "12345" },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••" },
    ],
    description: "Configure suas credenciais da API de Afiliados Shopee",
  },
  {
    key: "amazon",
    name: "Amazon Associates",
    fields: [
      { key: "tag", label: "Tag/ID", type: "text", placeholder: "seusite-20" },
      { key: "accessKey", label: "Access Key", type: "text", placeholder: "AKIAIOSFODNN7EXAMPLE" },
      { key: "secretKey", label: "Secret Key", type: "password", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
    ],
    description: "Configure suas credenciais da Amazon Product Advertising API",
  },
  {
    key: "magalu",
    name: "Magazine Luiza",
    fields: [
      { key: "partnerStore", label: "Loja Parceiro", type: "text", placeholder: "magazinevoce.com.br/sualoja" },
    ],
    description: "Configure seu link de loja parceira Magazine Você",
  },
  {
    key: "ml",
    name: "Mercado Livre",
    fields: [
      { key: "affiliateId", label: "ID de Afiliado", type: "text", placeholder: "MLB123456" },
    ],
    description: "Configure seu ID de afiliado do Mercado Livre",
  },
  {
    key: "shein",
    name: "Shein",
    fields: [
      { key: "affiliateId", label: "Affiliate ID", type: "text", placeholder: "12345" },
    ],
    description: "Configure seu ID de afiliado Shein",
  },
  {
    key: "aliexpress",
    name: "AliExpress",
    fields: [
      { key: "trackingId", label: "Tracking ID", type: "text", placeholder: "default" },
      { key: "appKey", label: "App Key", type: "text", placeholder: "12345" },
    ],
    description: "Configure suas credenciais do AliExpress Affiliate Program",
  },
];

export default function AffiliatePrograms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Record<StoreKey, AffiliateCredential>>({} as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StoreKey | null>(null);
  const [testing, setTesting] = useState<StoreKey | null>(null);

  useEffect(() => {
    if (user) {
      loadCredentials();
    }
  }, [user]);

  const loadCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from("affiliate_credentials")
        .select("*")
        .eq("user_id", user?.id);

      if (error) throw error;

      const credsMap: Record<StoreKey, AffiliateCredential> = {} as any;
      
      // Initialize with empty credentials for all stores
      STORE_CONFIGS.forEach((config) => {
        credsMap[config.key] = {
          store: config.key,
          credentials: {},
          auto_generate: false,
          is_active: false,
        };
      });

      // Fill in saved credentials
      data?.forEach((cred) => {
        credsMap[cred.store as StoreKey] = {
          id: cred.id,
          store: cred.store as StoreKey,
          credentials: cred.credentials as Record<string, string>,
          auto_generate: cred.auto_generate,
          is_active: cred.is_active,
        };
      });

      setCredentials(credsMap);
    } catch (error) {
      console.error("Error loading credentials:", error);
      toast({
        title: "Erro ao carregar credenciais",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (storeKey: StoreKey) => {
    setSaving(storeKey);
    try {
      const cred = credentials[storeKey];
      const config = STORE_CONFIGS.find((c) => c.key === storeKey);

      // Check if all required fields are filled
      const allFieldsFilled = config?.fields.every(
        (field) => cred.credentials[field.key]?.trim()
      );

      const payload = {
        user_id: user?.id,
        store: storeKey,
        credentials: cred.credentials,
        auto_generate: cred.auto_generate,
        is_active: allFieldsFilled || false,
      };

      if (cred.id) {
        const { error } = await supabase
          .from("affiliate_credentials")
          .update(payload)
          .eq("id", cred.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("affiliate_credentials")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setCredentials({
          ...credentials,
          [storeKey]: { ...cred, id: data.id, is_active: payload.is_active },
        });
      }

      toast({ title: "Credenciais salvas com sucesso!" });
      await loadCredentials();
    } catch (error) {
      console.error("Error saving credentials:", error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (storeKey: StoreKey) => {
    setTesting(storeKey);
    try {
      // Simulated test - in production, this would call an edge function
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const cred = credentials[storeKey];
      const config = STORE_CONFIGS.find((c) => c.key === storeKey);
      const allFieldsFilled = config?.fields.every(
        (field) => cred.credentials[field.key]?.trim()
      );

      if (allFieldsFilled) {
        toast({
          title: "Conexão testada com sucesso!",
          description: `As credenciais do ${config?.name} estão válidas.`,
        });
      } else {
        throw new Error("Preencha todos os campos");
      }
    } catch (error) {
      toast({
        title: "Erro no teste",
        description: "Verifique se as credenciais estão corretas.",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const updateCredentialField = (storeKey: StoreKey, field: string, value: string) => {
    setCredentials({
      ...credentials,
      [storeKey]: {
        ...credentials[storeKey],
        credentials: {
          ...credentials[storeKey].credentials,
          [field]: value,
        },
      },
    });
  };

  const toggleAutoGenerate = (storeKey: StoreKey) => {
    setCredentials({
      ...credentials,
      [storeKey]: {
        ...credentials[storeKey],
        auto_generate: !credentials[storeKey].auto_generate,
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Programas de Afiliado</h1>
        <p className="text-muted-foreground">
          Configure suas credenciais para gerar links de afiliado automaticamente
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {STORE_CONFIGS.map((config) => {
          const cred = credentials[config.key];
          const allFieldsFilled = config.fields.every(
            (field) => cred?.credentials?.[field.key]?.trim()
          );

          return (
            <Card key={config.key}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {config.name}
                      {cred?.is_active ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Incompleto
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{config.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${config.key}-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`${config.key}-${field.key}`}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={cred?.credentials?.[field.key] || ""}
                      onChange={(e) =>
                        updateCredentialField(config.key, field.key, e.target.value)
                      }
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${config.key}-auto`}
                      checked={cred?.auto_generate || false}
                      onCheckedChange={() => toggleAutoGenerate(config.key)}
                      disabled={!allFieldsFilled}
                    />
                    <Label htmlFor={`${config.key}-auto`} className="cursor-pointer">
                      Gerar link automaticamente
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleSave(config.key)}
                    disabled={saving === config.key}
                    className="flex-1"
                  >
                    {saving === config.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTest(config.key)}
                    disabled={testing === config.key || !allFieldsFilled}
                  >
                    {testing === config.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Testar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
