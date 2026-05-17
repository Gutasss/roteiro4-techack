# Privacy Tracker Detector

Extensão Firefox (WebExtension) para detecção e visualização de ameaças à privacidade e rastreamento na navegação web.

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Terceiros** | Lista todos os domínios de terceira parte contactados e o tipo de recurso (script, imagem, iframe…) |
| **Cookies** | Classifica cookies por origem (1ª/3ª parte), duração (sessão/persistente) e detecta supercookies via ETag e cookie syncing |
| **Web Storage** | Exibe entradas de `localStorage`, `sessionStorage` e bancos `IndexedDB` com chave, tamanho e domínio |
| **Fingerprinting** | Intercepta chamadas às APIs Canvas, WebGL e AudioContext usadas para browser fingerprinting |
| **Hijacking** | Detecta scripts suspeitos de rastreadores conhecidos e redirecionamentos entre domínios |
| **Privacy Score** | Pontuação 0–100 calculada a partir de todos os vetores acima, com detalhamento das penalidades |

## Instalação (modo desenvolvedor)

1. Abra o Firefox e acesse `about:debugging`
2. Clique em **Este Firefox** → **Carregar extensão temporária**
3. Selecione o arquivo `manifest.json` desta pasta
4. A extensão aparecerá na barra de ferramentas com o ícone de escudo

> Para instalação permanente, a extensão precisaria ser assinada pela Mozilla via [addons.mozilla.org](https://addons.mozilla.org).

## Uso

1. Navegue até qualquer site
2. Clique no ícone da extensão na barra de ferramentas
3. Explore as abas:
   - **Terceiros** — domínios externos contactados, número de requisições e tipo de recurso. Rastreadores conhecidos são destacados em vermelho
   - **Cookies** — resumo em grade (1ª parte, 3ª parte, sessão, persistente, supercookies), lista de cookies individuais, cookie syncing detectado e supercookies via ETag
   - **Storage** — chaves e tamanhos de `localStorage`/`sessionStorage` e nomes de bancos `IndexedDB`
   - **Fingerprint** — indica se Canvas, WebGL ou AudioContext foram invocados com fins de identificação, além do detalhamento do Privacy Score
   - **Hijacking** — scripts externos de domínios de rastreamento e redirecionamentos cross-domain

## Metodologia do Privacy Score

Ponto de partida: **100 pontos**. Penalidades são acumuladas conforme os vetores detectados:

| Vetor | Penalidade | Máximo |
|---|---|---|
| Cada domínio de terceira parte | −3 | −30 |
| Cada rastreador conhecido | −5 | −15 |
| Cada cookie de terceira parte | −3 | −15 |
| Cada cookie persistente | −2 | −10 |
| Cada supercookie (ETag) | −10 | −20 |
| Cada sinal de cookie syncing | −5 | −10 |
| Cada entrada no localStorage | −2 | −10 |
| Cada entrada no sessionStorage | −1 | −5 |
| Cada banco IndexedDB | −3 | −9 |
| Canvas fingerprinting (único) | −15 | −15 |
| WebGL fingerprinting (único) | −10 | −10 |
| AudioContext fingerprinting (único) | −10 | −10 |
| Cada script suspeito de hijacking | −10 | −20 |
| Cada redirecionamento cross-domain | −15 | −15 |

**Classificação:**

| Pontuação | Nível |
|---|---|
| 80–100 | Boa privacidade |
| 50–79 | Privacidade moderada |
| 20–49 | Privacidade ruim |
| 0–19 | Privacidade crítica |

**Justificativa da metodologia:** cada vetor é ponderado pela sua severidade real como técnica de rastreamento. Fingerprinting recebe penalidade maior (−15/−10) pois é resistente a modo privativo e limpeza de cookies. Supercookies via ETag recebem −10 cada por serem persistentes e pouco conhecidas. Rastreadores conhecidos somam penalidade extra sobre a contagem de domínios pois representam ameaça comprovada.

## Estrutura do projeto

```
├── manifest.json        Manifesto da extensão (MV2, Firefox)
├── background.js        Coleta dados via webRequest e gerencia estado por aba
├── content.js           Injeta interceptadores de API e coleta dados de storage
├── popup/
│   ├── popup.html       Interface do usuário
│   ├── popup.js         Lógica de renderização e cálculo do Privacy Score
│   └── popup.css        Estilos da interface
└── icons/
    └── icon.svg         Ícone da extensão
```

## Referências

- [WebExtensions — MDN](https://developer.mozilla.org/pt-BR/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension)
- [webRequest API — MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest)
- [Cover Your Tracks — EFF](https://coveryourtracks.eff.org)
- [Am I Unique?](https://amiunique.org)
