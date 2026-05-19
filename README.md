# Privacy Tracker Detector

O **Privacy Tracker Detector** é uma extensão para Firefox criada para ajudar o usuário a entender melhor o que acontece nos bastidores enquanto navega pela web.

A ideia da ferramenta é simples: ao acessar uma página, a extensão observa conexões externas, cookies, armazenamento local, sinais de fingerprinting e possíveis comportamentos suspeitos. Depois, essas informações são organizadas em uma interface visual, permitindo avaliar o quanto aquele site pode estar rastreando o usuário.

## O que a extensão analisa

A extensão monitora diferentes vetores de privacidade durante a navegação:

| Área analisada | O que é verificado |
|---|---|
| **Domínios de terceiros** | Identifica domínios externos contactados pela página, como scripts, imagens, iframes e outros recursos |
| **Cookies** | Classifica cookies entre primeira e terceira parte, além de diferenciar cookies de sessão e persistentes |
| **Supercookies e cookie syncing** | Busca sinais de rastreamento mais persistente, como uso de ETags e sincronização de identificadores entre domínios |
| **Web Storage** | Exibe dados armazenados em `localStorage`, `sessionStorage` e `IndexedDB`, incluindo chave, tamanho e domínio responsável |
| **Fingerprinting** | Detecta chamadas a APIs frequentemente usadas para identificação do navegador, como Canvas, WebGL e AudioContext |
| **Hijacking e redirects** | Sinaliza scripts externos suspeitos e redirecionamentos entre domínios que podem indicar comportamento abusivo |
| **Privacy Score** | Calcula uma pontuação de privacidade da página com base nos riscos encontrados |

## Como instalar no Firefox

Como a extensão está em modo de desenvolvimento, ela deve ser carregada manualmente no Firefox:

1. Abra o Firefox.
2. Acesse `about:debugging`.
3. Clique em "Este Firefox".
4. Clique em "Carregar extensão temporária".
5. Selecione o arquivo `manifest.json` dentro da pasta do projeto.
6. O ícone da extensão aparecerá na barra de ferramentas do navegador.

## Como usar

Depois de instalar a extensão:

1. Acesse qualquer site.
2. Clique no ícone da extensão na barra de ferramentas.
3. Navegue pelas abas para visualizar os dados coletados.

As principais abas são:

- **Terceiros**: mostra os domínios externos contactados pela página, a quantidade de requisições e o tipo de recurso carregado.
- **Cookies**: apresenta cookies de primeira e terceira parte, cookies de sessão, cookies persistentes, possíveis supercookies e indícios de cookie syncing.
- **Storage**: lista dados encontrados em `localStorage`, `sessionStorage` e `IndexedDB`.
- **Fingerprint**: mostra chamadas a APIs como Canvas, WebGL e AudioContext, que podem ser usadas para identificar o navegador.
- **Hijacking**: destaca scripts externos suspeitos e redirecionamentos entre domínios.
- **Privacy Score**: resume os riscos encontrados em uma pontuação de 0 a 100.

## Como funciona o Privacy Score

O Privacy Score começa em **100 pontos**. Conforme a extensão encontra elementos que podem representar risco à privacidade, a pontuação é reduzida.

A lógica usada foi construída considerando a severidade de cada técnica de rastreamento. Técnicas mais difíceis de perceber ou remover, como fingerprinting e supercookies, recebem penalidades maiores. Já elementos mais comuns, como domínios de terceiros e cookies, também reduzem a pontuação, mas de forma proporcional.

| Vetor detectado | Penalidade | Limite máximo |
|---|---:|---:|
| Domínio de terceira parte | −3 | −30 |
| Rastreador conhecido | −5 | −15 |
| Cookie de terceira parte | −3 | −15 |
| Cookie persistente | −2 | −10 |
| Supercookie via ETag | −10 | −20 |
| Sinal de cookie syncing | −5 | −10 |
| Entrada em localStorage | −2 | −10 |
| Entrada em sessionStorage | −1 | −5 |
| Banco IndexedDB | −3 | −9 |
| Uso de Canvas para fingerprinting | −15 | −15 |
| Uso de WebGL para fingerprinting | −10 | −10 |
| Uso de AudioContext para fingerprinting | −10 | −10 |
| Script suspeito de hijacking | −10 | −20 |
| Redirecionamento entre domínios | −15 | −15 |

## Interpretação da pontuação

| Pontuação | Classificação |
|---|---|
| 80 a 100 | Boa privacidade |
| 50 a 79 | Privacidade moderada |
| 20 a 49 | Privacidade ruim |
| 0 a 19 | Privacidade crítica |

Essa pontuação não deve ser interpretada como uma verdade absoluta, mas como um indicador prático para comparar o comportamento de diferentes sites. O objetivo é tornar mais visível aquilo que normalmente acontece de forma silenciosa durante a navegação.

## Estrutura do projeto

```text
├── manifest.json        Manifesto da extensão para Firefox
├── background.js        Monitora requisições, cookies, redirects e dados por aba
├── content.js           Coleta dados de storage e intercepta APIs de fingerprinting
├── popup/
│   ├── popup.html       Estrutura da interface da extensão
│   ├── popup.js         Renderização dos dados e cálculo do Privacy Score
│   └── popup.css        Estilos visuais da interface
└── icons/
    └── icon.svg         Ícone da extensão
