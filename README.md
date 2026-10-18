# MoneyMap

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

## App Android (APK)

Cada push para `main` gera um APK assinado no GitHub Actions (`.github/workflows/android.yml`) e publica-o em **Releases**.

Configuração única, em **Settings → Secrets and variables → Actions**:

| Segredo | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o ficheiro `.jks` em base64 |
| `ANDROID_STORE_PASSWORD` | password do keystore |
| `ANDROID_KEY_PASSWORD` | password da chave (igual à anterior) |
| `ANDROID_KEY_ALIAS` | `moneymap` |

Usa sempre a mesma chave: é o que deixa o Android instalar cada versão nova por cima da anterior, sem perder dados. O `.jks` nunca vai para o repositório.

Instalar: no telemóvel, abre a página **Releases** do repositório, descarrega o `MoneyMap-1.0.N.apk` e abre-o (o Android pede para permitir instalar desta fonte).

Desenvolvimento local: `npm run build:native` constrói a app sem service worker e copia-a para `android/`; abre a pasta `android` no Android Studio para correr num telemóvel ligado por USB.

O que só existe na app Android: notificações dos lembretes do Pin, o widget do ecrã principal (gastos do mês + botão **+**), e partilhar ou guardar ficheiros (cópias, extratos) pelo menu do Android.

## Versão web (GitHub Pages)

1. Abre o endereço do GitHub Pages no Chrome.
2. Menu ⋮ → **Instalar app** (ou “Adicionar ao ecrã principal”).
3. Carrega sem largar no ícone para o atalho **Adicionar gasto**.

## Próximas versões

- **1.1:** mudar a ordem dos cartões de cada página (Início, Resumo, …), como já dá para fazer com as contas no Início.
- **1.2:** relatório do ano para exportar.
- **2.0:** acompanhar o crédito habitação: quanto já pagaste, quanto falta, juros vs capital.
