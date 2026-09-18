# Simple Portal

Sökportal för arkivobjekt (AIP) via ETERNA V2 API.

Byggd med **Astro 6**, **React 19** och **ren CSS**. Digi Design System (Arbetsförmedlingens designsystem) används för formulärkomponenter och UI-feedback. Ingen separat backend krävs — all konfiguration sparas i en enda `config.json`.

Portalen är ett fristående repo och byggs oberoende av ETERNA. Kopplingen sker
enbart över ETERNA:s V2 REST API — en körande ETERNA-instans krävs i drift, men
inte för att bygga eller köra testsviten.

---

## Snabbstart

```bash
# 1. Klona repot
git clone https://github.com/ETERNA-earkiv/eterna-simple-portal.git
cd eterna-simple-portal

# 2. Installera beroenden
bun install

# 3. Konfigurera miljövariabler
cp .env.example .env
# Redigera .env med rätt ETERNA-credentials och URL

# 4. Starta dev-server
bun dev
```

Portalen startar på `http://localhost:4321`.

### Miljövariabler

| Variabel | Beskrivning | Default |
|---|---|---|
| `ETERNA_API_URL` | ETERNA backend-URL | `http://localhost:8080` |
| `PORTAL_SERVICE_USER` | ETERNA-konto som anonyma besökare söker som | — (obligatorisk) |
| `PORTAL_SERVICE_PASSWORD` | Lösenord för kontot | — (obligatorisk) |

Utan service-kontot kan portalen inte söka: varje anrop failar med
`EnvInvalidVariables: PORTAL_SERVICE_USER is missing` i serverloggen. Det finns
ingen tyst fallback till gäst-åtkomst. Kontot avgör vad en besökare utan
inloggning kan se — ge det minsta möjliga roller i ETERNA: `aip.read`,
`descriptive_metadata.read` och `representation.read`
(Administration → Användare och grupper).

> Använd aldrig ett administratörskonto. Varje anonym besökare får kontots
> läsrättigheter via portalens vitlistade sökvägar.

---

## Kommandon

| Kommando | Beskrivning |
|---|---|
| `bun dev` | Starta dev-server (port 4321) |
| `bun run build` | Bygg för produktion |
| `bun run preview` | Förhandsgranska produktionsbygge |
| `bun run check` | Typkontroll (Astro + TypeScript) |
| `bun run test` | Kör testsvit (Vitest) |

---

## Docker och release

Imagen publiceras till `ghcr.io/eterna-earkiv/eterna-simple-portal`.

```bash
docker run -p 4321:4321 \
  -e ETERNA_API_URL=https://<din-eterna> \
  -e PORTAL_SERVICE_USER=<konto> \
  -e PORTAL_SERVICE_PASSWORD=<lösenord> \
  ghcr.io/eterna-earkiv/eterna-simple-portal:latest
```

Credentials sätts som miljövariabler vid drift — de bakas aldrig in i imagen.

| Workflow | Trigger | Resultat |
|---|---|---|
| `Test Image` | Manuellt (Actions → Run workflow) | `:dev` och `:sha-<commit>`, linux/amd64 |
| `Release` | Push av tagg `v*` | `:1.2.3`, `:1.2`, `:latest`, linux/amd64 + arm64 |

Båda kör testsvit och typkontroll före bygget. `Release` stoppar dessutom om
taggen inte matchar `version` i `package.json`, och kan köras som dry run via
`workflow_dispatch` för att bygga utan att publicera.

### Släppa en version

```bash
# 1. Sätt versionen i package.json, commita
# 2. Tagga och pusha
git tag v1.2.3
git push origin v1.2.3
```

---

## Funktioner

### Sökning (utan inloggning)
- Fulltextsökning mot ETERNA V2 API som portalens service-konto
- Besökare behöver **inte** logga in — credentials finns bara server-side
- Expanderbara resultatkort med metadata och filer inline (lazy-loaded)
- Avancerade filter: beskrivningsnivå, typ, datum, fritext
- Filgrid med thumbnails, hover-overlay (förhandsgranska / ladda ner)
- Filvisare med stöd för bild, PDF, text, video, audio (lazy-loaded)
- Navigering mellan filer (piltangenter + pilar)
- Paginering
- Sökfält som inte finns i Solr-indexet hanteras gracefully (0 träffar, inte krasch)

### Paketnedladdning
- "Öppna och ladda ner fil" skapar en ZIP med:
  - `_metadata.pdf` — alla metadatafält i PDF (kort namn: mapp-/zipnamnet kortas till 50 tecken så Windows sökvägsgräns på 260 tecken inte spräcks)
  - Alla filer från representationerna (med bevarad mappstruktur)
- Metadata filtreras enligt admin-konfigurerade synlighetsfält
- Fallback: `_metadata.html` om PDF-generering misslyckas
- Partiella filfel: ZIP laddas ner med `_misslyckade_filer.txt` + varning (inte krasch)
- jsPDF + JSZip lazy-loaded — laddas först vid nedladdning

### Inloggning (för admin)
- Basic Auth mot ETERNA (stödjer UTF-8 i lösenord)
- JSESSIONID-sessionscookie
- Automatisk redirect vid session-expired (enbart admin-sidor)

### Admin — Metadata och synlighet (`/admin/metadata`)
- Välj tillåtna beskrivningsnivåer (svenska labels: Arkivbestånd, Volym, etc.)
- Konfigurera sökfilter (aktivera/inaktivera, namnge, ordna, typ)
- Synliga metadatafält per standard (EAD 2002, EAD 3, Dublin Core)
  - Hämta fält från referens-AIP:er — nya fält plusas ihop
  - Alla kända fält sparas för framtida val (`knownMetadataFields`)
- XPath-regeleditor för metadata-baserad synlighet
  - Tre synlighetsnivåer: visa allt / enbart titel / dölj helt
  - Testa regler mot ETERNA i realtid

### Admin — Tema (`/admin/tema`)
- Byt portalnamn (visas i header, footer, sidtitel)
- Ladda upp logotyp
- Välj varumärkesfärg (10 WCAG AA-godkända presets)
- Förhandsvisning med knapp + länk + badge

### Admin — Konfiguration (`/admin/konfiguration`)
- Exportera/importera config.json

---

## Säkerhet

- **Proxy-härdning:** Anonyma requests begränsas till GET + vitlistade POST `/find`-endpoints. PUT/PATCH/DELETE kräver inloggning. Service-kontots roller i ETERNA är den auktoritativa spärren — proxyn är ett extra lager.
- **Service-sessionen läcker aldrig:** Kontots JSESSIONID hålls server-side och forwardas aldrig som Set-Cookie till browsern.
- **Middleware fail-closed:** Om ETERNA inte svarar returneras 503 (inte open access till admin).
- **XSS-skydd:** HTML från ETERNA saneras med DOMPurify innan rendering.
- **Request timeout:** 30s timeout på alla API-anrop via AbortController.
- **Användarvänliga felmeddelanden:** Alla HTTP-fel mappas till svenska meddelanden — inga råa statuskoder eller JSON i UI.

---

## Tester

Testsvit med **Vitest** (38 tester):

- **Proxy:** Auth mode detection, metod-begränsning för anonyma requests, vitlistade endpoints
- **Middleware:** Fail-closed beteende, session-validering, redirect vid expired
- **Sök-store:** Offset-reset vid ny query/filter, paginering, state management

```bash
bun run test
```

---

## Arkitektur

```text
Browser
  │
  ├── Publika sidor (sök, filvisning)
  │     └── /api/v2/* → Astro catch-all proxy → ETERNA
  │           Ingen JSESSIONID? → injicera service-kontots session
  │           401 från ETERNA? → invalidera session + ett omförsök
  │
  └── Admin-sidor (/admin/*)
        └── Kräver inloggning (ETERNA-konto)
              Har JSESSIONID → forward user session
```

### Autentisering — tre nivåer

| Besökare | Hur | Session |
|---|---|---|
| Anonym (sök) | Portalens service-konto, server-side | Ingen cookie sätts |
| Inloggad admin | Eget ETERNA-konto via login | Browser JSESSIONID |
| Login-försök | Basic Auth header | Forward direkt till ETERNA |

### En enda konfigurationskälla

All konfiguration (tema, synlighet, sökfält) sparas i `public/assets/config/config.json`.

- **Läsning:** Astro läser server-side. React hämtar via centraliserad `loadConfig()` (cachad).
- **Skrivning:** Admin sparar via `PUT /api/config` (kräver ETERNA-session) + `invalidateConfigCache()`.
- **Resultat:** Alla besökare ser samma tema och synlighetsregler.

### API-proxy

| API | Mål | Syfte |
|---|---|---|
| `/api/v2/*` | Astro catch-all → ETERNA | Sök, metadata, filer (med auth-injection) |
| `/api/config` | Astro API-endpoint | Läs/skriv config.json |

---

## Digi Design System

Portalen använder [Arbetsförmedlingens Digi designsystem](https://designsystem.arbetsformedlingen.se/) (`@designsystem-se/af-react` v35.2.0) för formulärkomponenter.

### Används via Portal UI-wrappers (`src/components/portal-ui/`)
- `PortalButton` — knappar (primary, secondary, function)
- `PortalInput` — textfält, lösenord, datum, e-post
- `PortalSelect` — dropdown-menyer
- `PortalCheckbox` — kryssrutor
- `PortalAccordion` — expanderbara sektioner (metadata-standarder)
- `PortalAlert` — felmeddelanden, varningar, status
- `PortalSpinner` — laddningsindikatorer
- `PortalPagination` — sidnavigering
- `PortalLink` — länkar
- `PortalErrorMessage`, `PortalEmptyState` — feedback

### Digi CSS
- Laddas via `<link>` i `<head>` (**inte** via frontmatter-import — kraschar Vite HMR)
- Sätter `--digi--*` tokens som Shadow DOM-komponenterna kräver
- Portalens `--brand1` mappas till `--digi--natthimmel--*` för brand color

### Native HTML där Digi inte passar
- Sökfältet (custom layout med ikon + clear)
- Inline tabell-inputs i SearchFieldConfig (Shadow DOM-labels spränger kompakt grid)
- Chip-editor i XpathRuleEditor
- File-inputs (hidden, triggas via PortalButton)

---

## i18n — Svenska labels

Portalen har inbyggda svenska översättningar för:
- Beskrivningsnivåer: fonds → Arkivbestånd, file → Volym, item → Handling, etc.
- Sökfält: Title → Titel, Description → Beskrivning, Level → Beskrivningsnivå
- Metadata-standarder: ead_2002.xml → Encoded Archival Description 2002

ETERNA kan overrida via `i18n.level.*` i shared-properties. Svenska inbyggda labels har prioritet över engelska remote-labels.

---

## Projektstruktur

```text
src/
  layouts/
    PortalLayout.astro         Huvudlayout (config server-side, Digi CSS via <link>)
    AdminLayout.astro          Admin med sidebar

  pages/
    index.astro                / → redirect till /sok
    sok.astro                  Söksida
    logga-in.astro             Inloggning
    admin/index.astro          → redirect till /admin/metadata
    admin/metadata.astro       Metadata + synlighet + sökfält
    admin/tema.astro           Tema (namn, logga, färg)
    admin/konfiguration.astro  Export/import config
    api/config.ts              GET/PUT config.json
    api/v2/[...path].ts        Catch-all proxy till ETERNA (auth-injection)

  components/
    portal-ui/                 Digi-wrappers (PortalButton, PortalInput, etc.)
    layout/                    Header, Footer, AdminSidebar (Astro)
    search/                    SearchPage, SearchResultCard, FileGrid, FileViewer
    admin/                     ThemeSettings, MetadataConfig, LevelSelector, etc.
    login/                     LoginForm

  lib/
    server/                    Server-only (env.ts, service-session.ts, user-session.ts)
    api/                       Fetch-klient + API-funktioner
    stores/                    Nanostores (search, config, user)
    theme/                     Tema-logik
    types/                     TypeScript-typer (ETERNA V2 API)
    utils/                     metadata-parser, xpath, i18n, package

  styles/
    global.css                 Reset, fokus, skip-link, a11y
    tokens.css                 CSS custom properties (--portal-* + Digi overrides)

  middleware.ts                Auth guard för /admin

public/
  assets/config/config.json    All konfiguration
  digi/                        Digi CSS + fonts
```

---

## Styling

- **Ren CSS** — ingen Tailwind, ingen SCSS, inget CSS-in-JS
- **CSS custom properties** i `tokens.css` (prefixade `--portal-*`)
- **`--brand1`** styr alla accentfärger + mappas till Digi-tokens
- **Digi Shadow DOM** — komponenterna stylar sig själva, extern CSS påverkar dem inte
- **WCAG 2.1 AA** — alla färgpresets har >=4.5:1 kontrast

---

## Tillgänglighet (WCAG 2.1 AA)

- Skip-link ("Hoppa till huvudinnehåll")
- Landmarks: `banner`, `main`, `contentinfo`, `nav` med `aria-label`
- Rubrikhierarki utan hopp (h1 -> h2 -> h3)
- Alla inputs har labels, alla knappar har `aria-label` vid behov
- `focus-visible` med 3px outline
- `prefers-reduced-motion: reduce`
- Felmeddelanden med `role="alert"`, status med `role="status"` + `aria-live`
- Touch targets >= 44x44px
