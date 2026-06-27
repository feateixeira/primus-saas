-- =============================================================================
-- LIMPEZA PERMANENTE — Ponto Certo / Bevenda Hub
-- =============================================================================
-- O que APAGA (exclusão definitiva, não tem volta):
--   vendas, itens de venda, caixa, movimentações de caixa,
--   produtos, estoque/movimentações, clientes, fornecedores
--
-- O que MANTÉM:
--   usuários de login (auth.users) e permissões (user_roles)
--
-- Como executar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cole este arquivo inteiro
--   3. Clique em Run
-- =============================================================================

BEGIN;

-- Filhos primeiro; CASCADE resolve dependências entre tabelas public.*
TRUNCATE TABLE
  public.cash_movements,
  public.sale_items,
  public.stock_movements,
  public.sales,
  public.cash_registers,
  public.products,
  public.clients,
  public.suppliers
RESTART IDENTITY CASCADE;

COMMIT;

-- Conferência (todas devem retornar 0)
SELECT 'cash_movements' AS tabela, COUNT(*) AS registros FROM public.cash_movements
UNION ALL SELECT 'sale_items', COUNT(*) FROM public.sale_items
UNION ALL SELECT 'stock_movements', COUNT(*) FROM public.stock_movements
UNION ALL SELECT 'sales', COUNT(*) FROM public.sales
UNION ALL SELECT 'cash_registers', COUNT(*) FROM public.cash_registers
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL SELECT 'suppliers', COUNT(*) FROM public.suppliers
UNION ALL SELECT 'user_roles (mantido)', COUNT(*) FROM public.user_roles;
