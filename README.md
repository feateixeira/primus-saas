# PrimusDIstri

Sistema de gestão e PDV para distribuidoras de bebidas, construído com:

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth, banco de dados e realtime)

## Desenvolvimento local

Pré‑requisitos:

- Node.js LTS (recomendado via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Uma instância Supabase configurada

Passos:

```bash
git clone https://github.com/feateixeira/primus-saas.git
cd primus-saas
npm install
npm run dev
```

Crie um arquivo `.env` na raiz (não é commitado) com:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

As migrations SQL e funções do Supabase estão na pasta `supabase/`.
