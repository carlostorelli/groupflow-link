-- Criar tabela de modelos de e-mail
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (somente admins)
CREATE POLICY "Admins can view all email templates"
ON public.email_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email templates"
ON public.email_templates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir modelos de e-mail padrão
INSERT INTO public.email_templates (name, subject, description, content) VALUES
('Reset Password', 'Redefinição De Senha', 'E-mail enviado quando o usuário solicita redefinição de senha', '<h1>Redefinição de Senha</h1><p>Você solicitou a redefinição de sua senha.</p><p>Clique no link abaixo para criar uma nova senha:</p><p><a href="{{reset_link}}">Redefinir Senha</a></p>'),
('Password Reset Notification', 'Sua Senha Foi Redefinida', 'Notificação enviada após senha ser redefinida com sucesso', '<h1>Senha Redefinida</h1><p>Sua senha foi alterada com sucesso.</p><p>Se você não realizou esta alteração, entre em contato conosco imediatamente.</p>'),
('Registration', 'Bem Vindo Ao {{company_name}}', 'E-mail de boas-vindas enviado após cadastro', '<h1>Bem-vindo!</h1><p>Obrigado por se cadastrar em nossa plataforma.</p><p>Estamos felizes em ter você conosco!</p>'),
('Invite', 'Você Foi Convidado Para Entrar Em {{team_name}}', 'Convite para entrar em uma equipe ou grupo', '<h1>Você foi convidado!</h1><p>{{inviter_name}} convidou você para participar de {{team_name}}.</p><p><a href="{{invite_link}}">Aceitar Convite</a></p>'),
('Verify Email', 'Verificação De E-Mail', 'E-mail para verificar endereço de e-mail do usuário', '<h1>Verificação de E-mail</h1><p>Por favor, verifique seu endereço de e-mail clicando no link abaixo:</p><p><a href="{{verification_link}}">Verificar E-mail</a></p>'),
('Payment Success', 'Pagamento Recebido Com Sucesso', 'Confirmação de pagamento bem-sucedido', '<h1>Pagamento Confirmado!</h1><p>Recebemos seu pagamento com sucesso.</p><p>Detalhes da transação:</p><ul><li>Valor: {{amount}}</li><li>Plano: {{plan_name}}</li></ul>'),
('Payment Failed', 'Não Foi Possível Processar O Pagamento', 'Notificação de falha no pagamento', '<h1>Falha no Pagamento</h1><p>Não conseguimos processar seu pagamento.</p><p>Por favor, verifique seus dados de pagamento e tente novamente.</p>'),
('Subscription Renewal', 'Assinatura Renovada Com Sucesso', 'Confirmação de renovação de assinatura', '<h1>Assinatura Renovada</h1><p>Sua assinatura do plano {{plan_name}} foi renovada com sucesso.</p><p>Próxima cobrança: {{next_billing_date}}</p>'),
('Subscription Plan Purchase', 'Acesso Ao Painel - {{plan_name}} - {{company_name}}', 'Confirmação de compra de novo plano', '<h1>Bem-vindo ao {{plan_name}}!</h1><p>Obrigado por assinar nosso plano {{plan_name}}.</p><p>Agora você tem acesso a todos os recursos premium!</p>');