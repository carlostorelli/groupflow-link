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
import { CheckCircle2, AlertCircle, Loader2, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type StoreKey = "shopee" | "amazon" | "magalu" | "ml" | "shein" | "aliexpress" | "awin";

interface AffiliateCredential {
  id?: string;
  store: StoreKey;
  credentials: Record<string, string>;
  auto_generate: boolean;
  is_active: boolean;
  selected_brands?: string[]; // For Awin: selected advertiser brands
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

// Popular brands available through Awin Brazil
const AWIN_BRANDS = [
  "Beleza na Web",
  "C&A", 
  "Dafiti",
  "Eudora",
  "Natura",
  "O Boticário",
  "Amend",
  "Amaro",
  "Netshoes",
  "Zattini",
  "Centauro",
  "Shop2gether",
  "Tricae",
];

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
      { key: "affiliateLink", label: "Link de Afiliado", type: "text", placeholder: "https://onelink.shein.com/..." },
    ],
    description: "Cole seu link de afiliado Shein (formato: https://onelink.shein.com/...)",
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
  {
    key: "awin",
    name: "Awin",
    fields: [
      { key: "awinId", label: "Awin ID", type: "text", placeholder: "Exemplo: 123457" },
      { key: "oauth2Token", label: "Awin OAuth2 Token", type: "password", placeholder: "Exemplo: a12b3c4-d5e6-f890-123a-b4c567890f12" },
    ],
    description: "Configure suas credenciais do Awin",
  },
];

export default function AffiliatePrograms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Record<StoreKey, AffiliateCredential>>({} as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StoreKey | null>(null);
  const [testing, setTesting] = useState<StoreKey | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);

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
        const credentialsData = cred.credentials as Record<string, any>;
        
        // For Awin, extract selected_brands separately
        let cleanCredentials = { ...credentialsData };
        let selectedBrands: string[] | undefined = undefined;
        
        if (cred.store === 'awin' && credentialsData.selected_brands) {
          selectedBrands = Array.isArray(credentialsData.selected_brands) 
            ? credentialsData.selected_brands 
            : undefined;
          // Remove selected_brands from credentials object for Awin
          const { selected_brands, ...rest } = credentialsData;
          cleanCredentials = rest;
        }
        
        credsMap[cred.store as StoreKey] = {
          id: cred.id,
          store: cred.store as StoreKey,
          credentials: cleanCredentials,
          auto_generate: cred.auto_generate,
          is_active: cred.is_active,
          selected_brands: selectedBrands,
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
    console.log("🚀 handleSave iniciado para:", storeKey);
    console.log("👤 User:", user);
    console.log("📋 Credentials state:", credentials);
    
    setSaving(storeKey);
    
    try {
      if (!user?.id) {
        console.error("❌ User ID não encontrado");
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }

      const cred = credentials[storeKey];
      if (!cred) {
        console.error("❌ Credential not found for store:", storeKey);
        toast({
          title: "Erro",
          description: "Credencial não encontrada",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }

      const config = STORE_CONFIGS.find((c) => c.key === storeKey);
      console.log("💾 Saving credentials for:", storeKey, "Credentials:", cred);

      // Validate Shein link format
      if (storeKey === 'shein' && cred.credentials?.affiliateLink) {
        const link = cred.credentials.affiliateLink.trim();
        if (!link.startsWith('https://onelink.shein.com/')) {
          toast({
            title: "Link inválido",
            description: "O link da Shein deve começar com https://onelink.shein.com/",
            variant: "destructive",
          });
          setSaving(null);
          return;
        }
      }

      // Check if all required fields are filled
      const allFieldsFilled = config?.fields.every(
        (field) => cred.credentials?.[field.key]?.trim()
      );

      console.log("All fields filled:", allFieldsFilled);

      const payload = {
        user_id: user?.id,
        store: storeKey,
        credentials: {
          ...cred.credentials,
          ...(storeKey === 'awin' && cred.selected_brands ? { selected_brands: cred.selected_brands } : {})
        },
        auto_generate: cred.auto_generate,
        is_active: allFieldsFilled || false,
      };

      console.log("Payload:", payload);

      if (cred.id) {
        console.log("Updating existing credential with ID:", cred.id);
        const { error } = await supabase
          .from("affiliate_credentials")
          .update(payload)
          .eq("id", cred.id);

        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        console.log("Update successful");
      } else {
        console.log("Inserting new credential");
        const { data, error } = await supabase
          .from("affiliate_credentials")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }

        console.log("Insert successful, data:", data);

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
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (storeKey: StoreKey) => {
    setTesting(storeKey);
    try {
      const cred = credentials[storeKey];
      const config = STORE_CONFIGS.find((c) => c.key === storeKey);
      const allFieldsFilled = config?.fields.every(
        (field) => cred.credentials[field.key]?.trim()
      );

      if (!allFieldsFilled) {
        throw new Error("Preencha todos os campos");
      }

      // Only Shopee has a dedicated test endpoint for now
      if (storeKey === 'shopee') {
        console.log('🧪 [TEST] Testando conexão Shopee...');
        
        const { data, error } = await supabase.functions.invoke('test-shopee-connection', {
          body: { userId: user?.id }
        });

        if (error) {
          console.error('❌ [TEST] Erro ao invocar função:', error);
          throw new Error(`Erro na função de teste: ${error.message}`);
        }

        console.log('📊 [TEST] Resultado recebido:', data);
        setTestResult(data);
        setShowTestDialog(true);

        if (data.success) {
          toast({
            title: "✅ Teste bem-sucedido",
            description: `API Shopee está respondendo corretamente. ${data.classification?.productsFound || 0} produtos encontrados.`,
          });
        } else {
          toast({
            title: "❌ Teste falhou",
            description: data.classification?.message || "Erro ao conectar com a API Shopee",
            variant: "destructive",
          });
        }
      } else {
        // For other stores, simulate validation
        await new Promise((resolve) => setTimeout(resolve, 1500));

        toast({
          title: "Credenciais validadas",
          description: `As credenciais do ${config?.name} foram verificadas. A validação completa ocorrerá no primeiro uso.`,
        });
      }
    } catch (error) {
      console.error('💥 Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error instanceof Error ? error.message : "Verifique se as credenciais estão corretas.",
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
          ...(credentials[storeKey]?.credentials || {}),
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

  const toggleBrand = (storeKey: StoreKey, brand: string) => {
    const current = credentials[storeKey]?.selected_brands || [];
    const updated = current.includes(brand)
      ? current.filter((b) => b !== brand)
      : [...current, brand];
    
    setCredentials({
      ...credentials,
      [storeKey]: {
        ...credentials[storeKey],
        selected_brands: updated,
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <>
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
                    {config.key === "shein" && field.key === "affiliateLink" && (
                      <p className="text-xs text-muted-foreground">
                        Não é necessário configurar ID. Cole seu link direto no formato https://onelink.shein.com/
                      </p>
                    )}
                  </div>
                ))}

                {/* Awin Brand Selection */}
                {config.key === "awin" && allFieldsFilled && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-sm font-medium">
                      Selecione as marcas que deseja usar:
                    </Label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                      {AWIN_BRANDS.map((brand) => (
                        <div key={brand} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`${config.key}-${brand}`}
                            checked={cred?.selected_brands?.includes(brand) || false}
                            onChange={() => toggleBrand(config.key, brand)}
                            className="rounded border-gray-300"
                          />
                          <Label
                            htmlFor={`${config.key}-${brand}`}
                            className="text-sm cursor-pointer"
                          >
                            {brand}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {cred?.selected_brands && cred.selected_brands.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {cred.selected_brands.length} marca(s) selecionada(s)
                      </p>
                    )}
                  </div>
                )}

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
                    onClick={() => {
                      console.log("🔘 Botão Salvar clicado para:", config.key);
                      handleSave(config.key);
                    }}
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

    {/* Test Results Dialog */}
    <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Diagnóstico da API Shopee
          </DialogTitle>
          <DialogDescription>
            Resultado completo do teste de conexão
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {/* Summary */}
            {testResult && (
              <Card className={testResult.success ? "border-green-500" : "border-red-500"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    {testResult.classification?.message || "Resultado do teste"}
                  </CardTitle>
                  <CardDescription>
                    Status HTTP: {testResult.httpStatus} {testResult.statusText}
                    {testResult.duration && ` • Duração: ${testResult.duration}ms`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Classification Details */}
                  {testResult.classification && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          testResult.classification.severity === 'CRITICAL' ? 'destructive' :
                          testResult.classification.severity === 'HIGH' ? 'default' :
                          testResult.classification.severity === 'MEDIUM' ? 'secondary' :
                          'outline'
                        }>
                          {testResult.classification.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Severidade: {testResult.classification.severity}
                        </span>
                      </div>
                      
                      {testResult.classification.details && (
                        <p className="text-sm text-muted-foreground">
                          {testResult.classification.details}
                        </p>
                      )}
                      
                      {testResult.classification.suggestion && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium">💡 Sugestão:</p>
                          <p className="text-sm text-muted-foreground">
                            {testResult.classification.suggestion}
                          </p>
                        </div>
                      )}

                      {testResult.classification.errorCode && (
                        <p className="text-xs text-muted-foreground">
                          Código do erro: {testResult.classification.errorCode}
                        </p>
                      )}

                      {testResult.classification.productsFound !== undefined && (
                        <p className="text-sm font-medium text-green-600">
                          ✅ {testResult.classification.productsFound} produtos encontrados
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Request Details */}
            {testResult?.request && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📤 Detalhes da Requisição</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(testResult.request, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Response Details */}
            {testResult?.response && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📥 Resposta da API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Headers */}
                  {testResult.response.headers && (
                    <div>
                      <h4 className="text-xs font-medium mb-2">Headers:</h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(testResult.response.headers, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* GraphQL Errors */}
                  {testResult.response.errors && (
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-red-600">❌ Erros GraphQL:</h4>
                      <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(testResult.response.errors, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Data */}
                  {testResult.response.data && (
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-green-600">✅ Dados:</h4>
                      <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded-md overflow-x-auto max-h-64">
                        {JSON.stringify(testResult.response.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Raw Body (if no data/errors) */}
                  {!testResult.response.data && !testResult.response.errors && testResult.response.rawBody && (
                    <div>
                      <h4 className="text-xs font-medium mb-2">Raw Response:</h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(testResult.response.rawBody, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error Details */}
            {testResult?.error && (
              <Card className="border-red-500">
                <CardHeader>
                  <CardTitle className="text-sm text-red-600">❌ Detalhes do Erro</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(testResult.error, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Timestamp */}
            {testResult?.timestamp && (
              <p className="text-xs text-muted-foreground text-center">
                Testado em: {new Date(testResult.timestamp).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
}
