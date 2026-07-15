# Il Faro

Sito vetrina statico per Il Faro International Baptist Church a Castel Volturno.

## Struttura

- `index.html`: shell semantico, metadati di base e collegamento agli asset.
- `assets/js/content.js`: unica fonte centralizzata per testi, contatti, navigazione, SEO e dati strutturati.
- `assets/js/classes.js`: registry centralizzato delle classi usate dal renderer.
- `assets/js/main.js`: rendering del sito, cambio lingua, menu mobile, feed YouTube e comportamento dell’header.
- `assets/css/styles.css`: UI responsive e direzione visiva.
- `assets/icons/favicon.svg`: favicon vettoriale coerente con il segno grafico del sito.

## Hero

La home usa una hero animata senza file video: immagine, camera drift, bagliore e fascio luminoso sono gestiti via CSS. L’animazione rispetta `prefers-reduced-motion` e viene disattivata per gli utenti che preferiscono meno movimento.

## Video YouTube

La sezione video legge gli ultimi tre contenuti dal feed pubblico del canale tramite `rss2json`, configurato in `assets/js/content.js`. Se il feed non risponde entro pochi secondi, vengono mostrati i tre link di fallback salvati nello stesso file.

## Note prima della pubblicazione

- Confermare il civico ufficiale: dalla ricerca pubblica risulta anche `Via Napoli 29b`.
- Confermare pastore/responsabili, email e calendario incontri.
