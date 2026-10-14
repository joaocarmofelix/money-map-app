# Gastos

App (PWA) para perceber para onde vai o dinheiro, a partir dos extratos do banco.

- **Importa** o PDF mensal do Millennium e o Excel do Bankinter. Os movimentos repetidos são ignorados, por isso podes importar ficheiros que se sobrepõem.
- **Aprende categorias**: categorizas um movimento e a app aplica a mesma categoria aos parecidos, agora e nas próximas importações.
- **Appartes e transferências entre as tuas contas** não contam como gastos. O saldo de cada apparte aparece em separado.
- **Comida fora do cartão refeição**: o número principal é quanto pagaste em comida com o cartão do banco. O objetivo é 0 €.
- **Gastos rápidos** com o botão +. Quando importares o extrato, o gasto apontado à mão junta-se ao movimento do banco (mesmo valor, até 4 dias de diferença).

Os dados ficam só no telemóvel (IndexedDB). Usa “Guardar cópia” em Mais para teres uma cópia de segurança.

## Desenvolvimento

```bash
npm install
npm run dev
npx vitest run      # testes
npm run build
```

Os testes com extratos reais só correm se `SAMPLES=/pasta/com/m.pdf+b.xls` estiver definido. **Nunca** coloques extratos reais no repositório.

## Instalar no Android

1. Abre o endereço do GitHub Pages no Chrome.
2. Menu ⋮ → **Instalar app** (ou “Adicionar ao ecrã principal”).
3. Carrega sem largar no ícone para o atalho **Adicionar gasto**.
