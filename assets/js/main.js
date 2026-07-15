const siteContent = window.IL_FARO_CONTENT;
const siteClasses = window.IL_FARO_CLASSES;

if (!siteContent) {
  throw new Error("Missing IL_FARO_CONTENT configuration.");
}

if (!siteClasses) {
  throw new Error("Missing IL_FARO_CLASSES configuration.");
}

const { states: STATE, buttons: BUTTON, utility: UTILITY } = siteClasses;
const C = siteClasses;

const SELECTORS = {
  skipLink: "[data-skip-link]",
  header: "[data-site-header]",
  pageRoot: "[data-page-root]",
  footer: "[data-site-footer]",
  nav: "[data-site-nav]",
  navToggle: "[data-nav-toggle]",
  languageButton: "[data-lang]",
  reveal: "[data-reveal]",
  youtubeGrid: "[data-youtube-grid]",
  youtubeStatus: "[data-youtube-status]",
  videoDialog: "[data-video-dialog]",
  videoDialogClose: "[data-video-dialog-close]",
  videoDialogDate: "[data-video-dialog-date]",
  videoDialogFrame: "[data-video-dialog-frame]",
  videoDialogLink: "[data-video-dialog-link]",
  videoDialogTitle: "[data-video-dialog-title]",
  videoTrigger: "[data-video-trigger]"
};

const STORAGE_KEY = "il-faro-language";
const HERO_ROTATION_INTERVAL = 7000;
const YOUTUBE_FETCH_TIMEOUT_MS = 4500;

let currentLanguage = siteContent.defaultLanguage;
let revealObserver = null;
let heroRotationTimer = null;
let youtubeFetchController = null;

const cx = (...values) => values.filter(Boolean).join(" ");
const modifier = (baseClass, value) => `${baseClass}-${value}`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const optionalAttributes = (attributes) =>
  Object.entries(attributes)
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join("");

const externalAttributes = (isExternal) =>
  optionalAttributes({
    target: isExternal ? "_blank" : "",
    rel: isExternal ? "noreferrer" : ""
  });

const readStoredLanguage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const persistLanguage = (lang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    return;
  }
};

const normalizeLanguage = (lang) =>
  siteContent.supportedLanguages.includes(lang) ? lang : siteContent.defaultLanguage;

const copyFor = (lang) => siteContent.copy[normalizeLanguage(lang)];

const localized = (value, lang) => {
  if (typeof value === "string") {
    return value;
  }

  return value?.[lang] ?? value?.[siteContent.defaultLanguage] ?? "";
};

const linesToHtml = (lines) => lines.map((line) => escapeHtml(line)).join("<br />");

const formatDate = (dateValue, lang) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(lang === "it" ? "it-IT" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
};

const ICONS = {
  "map-pin": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path>
      <circle cx="12" cy="10" r="2.5"></circle>
    </svg>
  `,
  phone: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"></path>
    </svg>
  `,
  instagram: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5"></rect>
      <circle cx="12" cy="12" r="4"></circle>
      <circle cx="17.5" cy="6.5" r="1"></circle>
    </svg>
  `,
  facebook: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.5l.5-4h-4V9c0-.7.3-1 1-1Z"></path>
    </svg>
  `,
  youtube: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21.2 7.2a3 3 0 0 0-2.1-2.1C17.2 4.6 12 4.6 12 4.6s-5.2 0-7.1.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2.3 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 7.1.5 7.1.5s5.2 0 7.1-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8Z"></path>
      <path class="${UTILITY.iconFill}" d="m10 15.2 5-3.2-5-3.2Z"></path>
    </svg>
  `
};

const renderIcon = (name) => ICONS[name] ?? "";

const initialsFor = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const setMetaContent = (selector, content) => {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("content", content);
  }
};

const updateMetadata = (lang) => {
  const seo = siteContent.seo[lang] ?? siteContent.seo[siteContent.defaultLanguage];

  document.title = seo.title;
  setMetaContent('meta[name="description"]', seo.description);
  setMetaContent('meta[property="og:title"]', seo.ogTitle);
  setMetaContent('meta[property="og:description"]', seo.ogDescription);
};

const updateStructuredData = () => {
  const { church } = siteContent;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: church.legalName,
    alternateName: `${church.name} - ${church.subtitle}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: church.address.street,
      addressLocality: "Castel Volturno",
      addressRegion: "CE",
      postalCode: "81030",
      addressCountry: "IT"
    },
    telephone: church.phone,
    logo: church.logoImage.src,
    sameAs: church.socialLinks.map((link) => link.href)
  };

  let script = document.querySelector("#church-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "church-schema";
    script.type = "application/ld+json";
    document.head.append(script);
  }

  script.textContent = JSON.stringify(schema);
};

const renderBrand = (lang, label) => {
  const { church } = siteContent;

  return `
    <a class="${C.brand.root}" href="#top" aria-label="${escapeHtml(label)}">
      <img
        class="${C.brand.logo}"
        src="${escapeHtml(church.logoImage.src)}"
        alt="${escapeHtml(localized(church.logoImage.alt, lang))}"
      />
    </a>
  `;
};

const renderNavigation = (lang, copy) => `
  <nav class="${C.header.nav}" id="site-nav" aria-label="${escapeHtml(copy.navLabel)}" data-site-nav>
    ${siteContent.navigation
      .map(
        (item) =>
          `<a href="${escapeHtml(item.href)}">${escapeHtml(localized(item.label, lang))}</a>`
      )
      .join("")}
  </nav>
`;

const renderLanguageSwitch = (lang, copy) => `
  <div class="${C.header.languageSwitch}" role="group" aria-label="${escapeHtml(copy.languageLabel)}">
    ${siteContent.supportedLanguages
      .map((language) => {
        const isActive = language === lang;
        return `
          <button
            type="button"
            class="${isActive ? STATE.active : ""}"
            data-lang="${escapeHtml(language)}"
            aria-pressed="${String(isActive)}"
          >
            ${escapeHtml(language.toUpperCase())}
          </button>
        `;
      })
      .join("")}
  </div>
`;

const renderHeader = (lang) => {
  const copy = copyFor(lang);

  return `
    ${renderBrand(lang, copy.homeLabel)}
    ${renderNavigation(lang, copy)}
    <div class="${C.header.actions}">
      ${renderLanguageSwitch(lang, copy)}
      <button class="${C.header.navToggle}" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span class="${C.header.navToggleLine}"></span>
        <span class="${C.header.navToggleLine}"></span>
        <span class="${C.header.navToggleLabel}">${escapeHtml(copy.menuLabel)}</span>
      </button>
    </div>
  `;
};

const renderActions = (actions) =>
  actions
    .map(
      (action) => `
        <a class="${BUTTON[action.variant] ?? BUTTON.secondary}" href="${escapeHtml(action.href)}">
          ${escapeHtml(action.label)}
        </a>
      `
    )
    .join("");

const renderHeroFacts = (facts, ariaLabel) => `
  <dl class="${C.hero.facts}" aria-label="${escapeHtml(ariaLabel)}" data-reveal>
    ${facts
      .map((fact) => {
        const value = linesToHtml(fact.value);
        return `
          <div>
            <dt>${escapeHtml(fact.label)}</dt>
            <dd>${fact.href ? `<a href="${escapeHtml(fact.href)}">${value}</a>` : value}</dd>
          </div>
        `;
      })
      .join("")}
  </dl>
`;

const renderHero = (lang) => {
  const { church } = siteContent;
  const { hero } = copyFor(lang);

  return `
    <section class="${C.hero.root}" id="top" aria-labelledby="hero-title" data-hero>
      <div
        class="${C.hero.media}"
        role="group"
        aria-label="${escapeHtml(hero.galleryAriaLabel)}"
        data-hero-slideshow
      >
        ${church.heroImages
          .map(
            (image, index) => `
              <img
                class="${cx(C.hero.image, index === 0 ? STATE.active : "")}"
                src="${escapeHtml(image.src)}"
                alt="${escapeHtml(localized(image.alt, lang))}"
                style="--hero-position: ${escapeHtml(image.position)}; --hero-position-mobile: ${escapeHtml(
                  image.mobilePosition
                )};"
                data-hero-slide
                aria-hidden="${String(index !== 0)}"
                decoding="async"
                ${index === 0 ? 'fetchpriority="high"' : 'loading="eager"'}
              />
            `
          )
          .join("")}
        <div class="${C.hero.scrim}" aria-hidden="true"></div>
      </div>
      <div class="${C.hero.grid}">
        <div class="${C.hero.copy}" data-reveal>
          <p class="${C.section.eyebrow}">${escapeHtml(hero.eyebrow)}</p>
          <h1 id="hero-title">${escapeHtml(hero.title)}</h1>
          <p class="${C.hero.lede}">${escapeHtml(hero.lede)}</p>
          <div class="${C.hero.actions}">${renderActions(hero.actions)}</div>
        </div>
        ${renderHeroFacts(hero.facts, hero.factsAriaLabel)}
      </div>
    </section>
  `;
};

const renderMissionGallery = (intro, lang) => {
  const images = siteContent.church.missionGallery;

  return `
    <div class="${C.intro.gallery}" role="group" aria-label="${escapeHtml(intro.galleryLabel)}" data-reveal>
      ${images
        .map(
          (image) => `
            <figure>
              <img
                src="${escapeHtml(image.src)}"
                alt="${escapeHtml(localized(image.alt, lang))}"
                loading="lazy"
              />
            </figure>
          `
        )
        .join("")}
    </div>
  `;
};

const renderIntro = (intro, lang) => `
  <section class="${C.intro.root}" aria-labelledby="mission-title">
    <div class="${cx(C.section.inner, C.intro.layout)}">
      <div class="${C.intro.copy}" data-reveal>
        <p class="${C.section.kicker}">${escapeHtml(intro.kicker)}</p>
        <h2 id="mission-title">${escapeHtml(intro.title)}</h2>
        <p>${escapeHtml(intro.statement)}</p>
      </div>
      ${renderMissionGallery(intro, lang)}
    </div>
  </section>
`;

const renderMediaImage = (imageKey, lang) => {
  const image = siteContent.church.media[imageKey];

  return `
    <figure class="${cx(C.media.frame, modifier(C.media.frame, escapeHtml(imageKey)))}" data-reveal>
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(localized(image.alt, lang))}" loading="lazy" />
    </figure>
  `;
};

const renderParagraphs = (paragraphs) =>
  paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");

const renderHistoryStep = (item, index) => `
  <li class="${C.history.step}" data-reveal>
    <span class="${C.history.marker}" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
    <figure class="${C.history.media}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" />
    </figure>
    <article class="${C.history.copy}">
      <span class="${C.history.period}">${escapeHtml(item.year)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
    </article>
  </li>
`;

const renderHistory = (history) => `
  <section class="${cx(C.section.root, C.history.root)}" id="${escapeHtml(
    history.id
  )}" aria-labelledby="${escapeHtml(history.id)}-title">
    <div class="${cx(C.section.inner, C.history.layout)}">
      <div class="${C.history.header}">
        <div data-reveal>
          <p class="${C.section.kicker}">${escapeHtml(history.kicker)}</p>
          <h2 id="${escapeHtml(history.id)}-title">${escapeHtml(history.title)}</h2>
        </div>
        <div class="${cx(C.section.copyStack, C.history.intro)}" data-reveal>
          ${renderParagraphs(history.paragraphs)}
        </div>
      </div>
      <ol class="${C.history.journey}" aria-label="${escapeHtml(history.trailLabel)}">
        ${history.timeline.map(renderHistoryStep).join("")}
      </ol>
    </div>
  </section>
`;

const renderConfession = (confession) => `
  <section class="${cx(C.section.root, C.confession.root)}" id="${escapeHtml(
    confession.id
  )}" aria-labelledby="${escapeHtml(confession.id)}-title">
    <div class="${C.section.inner}">
      <div class="${C.confession.header}" data-reveal>
        <div>
          <p class="${C.section.kicker}">${escapeHtml(confession.kicker)}</p>
          <h2 id="${escapeHtml(confession.id)}-title">${escapeHtml(confession.title)}</h2>
        </div>
        <p>${escapeHtml(confession.lede)}</p>
      </div>
      <div class="${C.confession.grid}">
        ${confession.points
          .map(
            (point, index) => `
              <article class="${C.confession.card}" data-reveal>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <h3>${escapeHtml(point.title)}</h3>
                <p>${escapeHtml(point.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  </section>
`;

const renderVision = (vision, lang) => `
  <section class="${cx(C.section.root, C.vision.root)}" id="${escapeHtml(
    vision.id
  )}" aria-labelledby="${escapeHtml(vision.id)}-title">
    <div class="${cx(C.section.inner, C.vision.layout)}">
      <div class="${cx(C.section.mediaLayout, C.vision.lead)}">
        ${renderMediaImage(vision.imageKey, lang)}
        <div class="${C.section.copy}" data-reveal>
          <p class="${C.section.kicker}">${escapeHtml(vision.kicker)}</p>
          <h2 id="${escapeHtml(vision.id)}-title">${escapeHtml(vision.title)}</h2>
          <div class="${C.section.copyStack}">${renderParagraphs(vision.paragraphs)}</div>
        </div>
      </div>
      <div class="${C.vision.agapeBlock}" data-reveal>
        <ol class="${C.vision.agapeList}" aria-label="AGAPE">
          ${vision.values
            .map(
              (value, index) => `
                <li class="${C.vision.agapeItem}" style="--agape-delay: ${index * 95}ms">
                  <span class="${C.vision.agapeLetter}" aria-hidden="true">${escapeHtml(
                    value.letter
                  )}</span>
                  <p class="${C.vision.agapeText}">${escapeHtml(value.text)}</p>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
    </div>
  </section>
`;

const renderStructure = (structure, lang) => `
  <section class="${cx(C.section.root, C.structure.root)}" id="${escapeHtml(
    structure.id
  )}" aria-labelledby="${escapeHtml(structure.id)}-title">
    <div class="${cx(C.section.inner, C.structure.layout)}">
      <div class="${C.structure.header}">
        <div data-reveal>
          <p class="${C.section.kicker}">${escapeHtml(structure.kicker)}</p>
          <h2 id="${escapeHtml(structure.id)}-title">${escapeHtml(structure.title)}</h2>
        </div>
        <p data-reveal>${escapeHtml(structure.lede)}</p>
      </div>
      ${renderMediaImage(structure.imageKey, lang)}
      <div class="${C.structure.leadershipBlock}" data-reveal>
        <div class="${C.structure.leadershipIntro}">
          <span class="${C.structure.label}">${escapeHtml(structure.council.title)}</span>
          <p>${escapeHtml(structure.council.body)}</p>
        </div>
        <ul class="${C.structure.elderList}">
          ${structure.council.members
            .map(
              (member) => `
                <li class="${C.structure.elderCard}">
                  <div class="${C.structure.elderPortrait}">
                    ${
                      member.photo
                        ? `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}" loading="lazy" />`
                        : `<span aria-hidden="true">${escapeHtml(initialsFor(member.name))}</span>`
                    }
                  </div>
                  <div class="${C.structure.elderMeta}">
                    <span>${escapeHtml(member.role)}</span>
                    <strong>${escapeHtml(member.name)}</strong>
                  </div>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
      <div class="${C.structure.ministriesBlock}">
        <div class="${C.structure.ministriesHeading}" data-reveal>
          <span class="${C.structure.label}">${escapeHtml(structure.ministries.title)}</span>
          <a
            class="${C.structure.link}"
            href="${escapeHtml(structure.ministries.partner.href)}"
            target="_blank"
            rel="noreferrer"
          >
            ${escapeHtml(structure.ministries.partner.label)}
          </a>
        </div>
        <div class="${C.structure.ministryGroups}">
          ${structure.ministries.groups
            .map(
              (group, index) => `
                <button
                  class="${C.structure.ministryCard}"
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="ministry-dialog-${index}"
                  data-ministry-trigger="ministry-dialog-${index}"
                  data-reveal
                >
                  <span class="${C.structure.ministryCardMedia}">
                    <img src="${escapeHtml(group.image)}" alt="" loading="lazy" />
                  </span>
                  <span class="${C.structure.ministryCardBody}">
                    <span class="${C.structure.ministryIndex}">${String(index + 1).padStart(2, "0")}</span>
                    <strong>${escapeHtml(group.title)}</strong>
                    <span class="${C.structure.ministrySummary}">${escapeHtml(group.summary)}</span>
                    <span class="${C.structure.ministryAction}">${escapeHtml(structure.ministries.openLabel)} <span aria-hidden="true">↗</span></span>
                  </span>
                </button>
              `
            )
            .join("")}
        </div>
        <div class="${C.structure.ministryDialogs}">
          ${structure.ministries.groups
            .map(
              (group, index) => `
                <dialog
                  class="${C.structure.ministryDialog}"
                  id="ministry-dialog-${index}"
                  aria-labelledby="ministry-dialog-title-${index}"
                  data-ministry-dialog
                >
                  <div class="${C.structure.ministryDialogShell}">
                    <button class="${C.structure.ministryDialogClose}" type="button" data-ministry-close>
                      <span aria-hidden="true">×</span>
                      <span class="${UTILITY.visuallyHidden}">${escapeHtml(structure.ministries.closeLabel)}</span>
                    </button>
                    <figure class="${C.structure.ministryDialogMedia}">
                      <img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.imageAlt)}" loading="lazy" />
                    </figure>
                    <div class="${C.structure.ministryDialogCopy}">
                      <span class="${C.structure.label}">${escapeHtml(structure.ministries.title)}</span>
                      <h3 id="ministry-dialog-title-${index}">${escapeHtml(group.title)}</h3>
                      <p>${escapeHtml(group.description)}</p>
                      <ul>
                        ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                      </ul>
                    </div>
                  </div>
                </dialog>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  </section>
`;

const normalizePublishedAt = (value) => {
  if (!value) {
    return "";
  }

  if (value.includes("T")) {
    return value;
  }

  return `${value.replace(" ", "T")}Z`;
};

const isYoutubeVideoId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value ?? "");

const extractYoutubeVideoId = (urlValue) => {
  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return isYoutubeVideoId(videoId) ? videoId : "";
    }

    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      const queryVideoId = url.searchParams.get("v");
      if (isYoutubeVideoId(queryVideoId)) {
        return queryVideoId;
      }

      const [, pathVideoId] = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/) ?? [];
      return isYoutubeVideoId(pathVideoId) ? pathVideoId : "";
    }
  } catch {
    return "";
  }

  return "";
};

const normalizeYoutubeVideo = (item) => {
  const url = item.link ?? item.url ?? siteContent.church.youtube.channelUrl;

  return {
    title: item.title ?? "",
    publishedAt: normalizePublishedAt(item.pubDate ?? item.publishedAt),
    videoId: extractYoutubeVideoId(url)
  };
};

const fallbackYoutubeVideos = () =>
  siteContent.church.youtube.fallbackVideos
    .slice(0, siteContent.church.youtube.maxVideos)
    .map(normalizeYoutubeVideo);

const renderVideoCard = (video, videos, lang) => {
  if (!video.videoId) {
    return "";
  }

  const publishedDate = formatDate(video.publishedAt, lang);
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  return `
    <button
      class="${C.videos.card}"
      type="button"
      data-video-trigger
      data-video-id="${escapeHtml(video.videoId)}"
      data-video-title="${escapeHtml(video.title)}"
      data-video-date="${escapeHtml(publishedDate)}"
      data-video-url="${escapeHtml(youtubeUrl)}"
      aria-haspopup="dialog"
      aria-label="${escapeHtml(`${videos.watchLabel}: ${video.title}`)}"
    >
      <span class="${C.videos.thumb}">
        <span class="${C.videos.brand}" aria-hidden="true">
          <img src="${escapeHtml(siteContent.church.logoImage.src)}" alt="" decoding="async" />
        </span>
        <span class="${C.videos.play}" aria-hidden="true"></span>
      </span>
      <span class="${C.videos.body}">
        ${
          publishedDate
            ? `<time class="${C.videos.meta}" datetime="${escapeHtml(
                video.publishedAt
              )}">${escapeHtml(publishedDate)}</time>`
            : ""
        }
        <strong>${escapeHtml(video.title)}</strong>
      </span>
    </button>
  `;
};

const renderVideoCards = (videosCopy, videoItems, lang) =>
  videoItems
    .slice(0, siteContent.church.youtube.maxVideos)
    .map((video) => renderVideoCard(video, videosCopy, lang))
    .join("");

const renderVideos = (videos, lang) => `
  <section class="${cx(C.section.root, C.videos.root)}" id="${escapeHtml(
    videos.id
  )}" aria-labelledby="${escapeHtml(videos.id)}-title">
    <div class="${cx(C.section.inner, C.videos.layout)}">
      <div class="${C.videos.header}" data-reveal>
        <h2 class="${C.section.kicker}" id="${escapeHtml(videos.id)}-title">${escapeHtml(
          videos.title
        )}</h2>
        <div class="${C.videos.intro}">
          <p>${escapeHtml(videos.lede)}</p>
          <a
            class="${C.videos.channelLink}"
            href="${escapeHtml(siteContent.church.youtube.channelUrl)}"
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">${renderIcon("youtube")}</span>
            ${escapeHtml(videos.allVideosLabel)}
            <span aria-hidden="true">↗</span>
          </a>
          <p
            class="${cx(C.videos.status, UTILITY.visuallyHidden, STATE.loading)}"
            data-youtube-status
            aria-live="polite"
          >
            ${escapeHtml(videos.loadingLabel)}
          </p>
        </div>
      </div>
      <div class="${C.videos.grid}" data-youtube-grid data-reveal>
        ${renderVideoCards(videos, fallbackYoutubeVideos(), lang)}
      </div>
      <dialog
        class="${C.videos.dialog}"
        data-video-dialog
        aria-labelledby="video-dialog-title"
      >
        <div class="${C.videos.dialogShell}">
          <header class="${C.videos.dialogHeader}">
            <h3 id="video-dialog-title" data-video-dialog-title></h3>
            <button
              class="${C.videos.dialogClose}"
              type="button"
              data-video-dialog-close
              aria-label="${escapeHtml(videos.modalCloseLabel)}"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div class="${C.videos.dialogFrame}" data-video-dialog-frame></div>
          <footer class="${C.videos.dialogFooter}">
            <time data-video-dialog-date></time>
            <a
              class="${C.videos.dialogLink}"
              href="${escapeHtml(siteContent.church.youtube.channelUrl)}"
              target="_blank"
              rel="noreferrer"
              data-video-dialog-link
            >
              ${escapeHtml(videos.modalYoutubeLabel)} <span aria-hidden="true">↗</span>
            </a>
          </footer>
        </div>
      </dialog>
    </div>
  </section>
`;

const renderContactLinks = (links) =>
  links
    .map(
      (link) => `
        <a class="${C.contact.link}" href="${escapeHtml(link.href)}"${externalAttributes(link.external)}>
          <span class="${C.contact.icon}" aria-hidden="true">${renderIcon(link.icon)}</span>
          <span class="${C.contact.linkCopy}">
            <span>${escapeHtml(link.label)}</span>
            <strong>${escapeHtml(link.value)}</strong>
          </span>
          <span class="${C.contact.chevron}" aria-hidden="true">↗</span>
        </a>
      `
    )
    .join("");

const renderSocialLinks = (title) => `
  <div class="${C.contact.socialBlock}" data-reveal>
    <h3>${escapeHtml(title)}</h3>
    <div class="${C.contact.socialLinks}">
      ${siteContent.church.socialLinks
        .map(
          (link) => `
            <a
              class="${cx(C.contact.socialLink, modifier(C.contact.socialLink, escapeHtml(link.icon)))}"
              href="${escapeHtml(link.href)}"${externalAttributes(link.external)}
            >
              <span class="${C.contact.socialIcon}" aria-hidden="true">${renderIcon(link.icon)}</span>
              <span>${escapeHtml(link.label)}</span>
            </a>
          `
        )
        .join("")}
    </div>
  </div>
`;

const renderContact = (contact) => {
  const { church } = siteContent;

  return `
    <section class="${cx(C.section.root, C.contact.root)}" id="${escapeHtml(
      contact.id
    )}" aria-labelledby="${escapeHtml(contact.id)}-title">
      <div class="${cx(C.section.inner, C.contact.layout)}">
        <div class="${C.contact.copy}" data-reveal>
          <p class="${C.section.kicker}">${escapeHtml(contact.kicker)}</p>
          <h2 id="${escapeHtml(contact.id)}-title">${escapeHtml(contact.title)}</h2>
          <p>${escapeHtml(contact.lede)}</p>
        </div>
        <div class="${C.contact.mapShell}" data-reveal>
          <div class="${C.contact.mapHeading}">
            <h3>${escapeHtml(contact.mapTitle)}</h3>
            <a href="${escapeHtml(church.address.mapUrl)}" target="_blank" rel="noreferrer">
              ${escapeHtml(contact.mapFallback)}
            </a>
          </div>
          <iframe
            title="${escapeHtml(contact.mapTitle)}"
            src="${escapeHtml(church.address.mapEmbedUrl)}"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        <div class="${C.contact.panel}" data-reveal>
          ${renderContactLinks(contact.links)}
          ${renderSocialLinks(contact.socialsTitle)}
        </div>
      </div>
    </section>
  `;
};

const renderMain = (lang) => {
  const copy = copyFor(lang);

  return [
    renderHero(lang),
    renderIntro(copy.intro, lang),
    renderHistory(copy.history),
    renderConfession(copy.confession),
    renderVision(copy.vision, lang),
    renderStructure(copy.structure, lang),
    renderVideos(copy.videos, lang),
    renderContact(copy.contact)
  ].join("");
};

const renderFooter = (lang) => {
  const copy = copyFor(lang);
  const { church } = siteContent;
  const year = new Date().getFullYear();

  return `
    <div class="${cx(C.section.inner, C.footer.main)}">
      <a class="${C.footer.brand}" href="#top" aria-label="${escapeHtml(copy.homeLabel)}">
        <img
          src="${escapeHtml(church.logoImage.src)}"
          alt="${escapeHtml(localized(church.logoImage.alt, lang))}"
        />
      </a>
      <nav class="${C.footer.nav}" aria-label="${escapeHtml(copy.navLabel)}">
        ${siteContent.navigation
          .map(
            (item) =>
              `<a href="${escapeHtml(item.href)}">${escapeHtml(localized(item.label, lang))}</a>`
          )
          .join("")}
      </nav>
    </div>
    <div class="${cx(C.section.inner, C.footer.layout)}">
      <p>© ${year} ${escapeHtml(church.legalName)}</p>
      <p>${escapeHtml(copy.footerNote)}</p>
    </div>
  `;
};

const setShellClasses = () => {
  const skipLink = document.querySelector(SELECTORS.skipLink);
  const header = document.querySelector(SELECTORS.header);
  const footer = document.querySelector(SELECTORS.footer);

  if (skipLink) {
    skipLink.className = C.shell.skipLink;
  }

  if (header) {
    header.className = C.shell.header;
  }

  if (footer) {
    footer.className = C.shell.footer;
  }
};

const setScrolledState = () => {
  document.querySelector(SELECTORS.header)?.classList.toggle(STATE.scrolled, window.scrollY > 12);
};

const closeNav = () => {
  document.body.classList.remove(STATE.navOpen);
  document.querySelector(SELECTORS.header)?.classList.remove(STATE.navOpen);
  document.querySelector(SELECTORS.nav)?.classList.remove(STATE.navVisible);
  document.querySelector(SELECTORS.navToggle)?.setAttribute("aria-expanded", "false");
};

const bindMinistryDialogs = () => {
  const dialogs = document.querySelectorAll("[data-ministry-dialog]");

  document.querySelectorAll("[data-ministry-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const dialogId = trigger.getAttribute("data-ministry-trigger");
      const dialog = dialogId ? document.getElementById(dialogId) : null;

      if (!(dialog instanceof HTMLDialogElement)) {
        return;
      }

      dialog.showModal();
      document.body.classList.add(STATE.modalOpen);
    });
  });

  dialogs.forEach((dialog) => {
    dialog.querySelector("[data-ministry-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => document.body.classList.remove(STATE.modalOpen));
    dialog.addEventListener("cancel", () => document.body.classList.remove(STATE.modalOpen));
  });
};

const bindVideoDialog = () => {
  const grid = document.querySelector(SELECTORS.youtubeGrid);
  const dialog = document.querySelector(SELECTORS.videoDialog);

  if (!(grid instanceof HTMLElement) || !(dialog instanceof HTMLDialogElement)) {
    return;
  }

  const closeButton = dialog.querySelector(SELECTORS.videoDialogClose);
  const date = dialog.querySelector(SELECTORS.videoDialogDate);
  const frame = dialog.querySelector(SELECTORS.videoDialogFrame);
  const externalLink = dialog.querySelector(SELECTORS.videoDialogLink);
  const title = dialog.querySelector(SELECTORS.videoDialogTitle);

  if (!(frame instanceof HTMLElement)) {
    return;
  }

  const closeDialog = () => {
    if (dialog.open) {
      dialog.close();
    }
  };

  const clearPlayer = () => {
    frame.replaceChildren();
    document.body.classList.remove(STATE.modalOpen);
  };

  grid.addEventListener("click", (event) => {
    const trigger =
      event.target instanceof Element
        ? event.target.closest(SELECTORS.videoTrigger)
        : null;

    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    const videoId = trigger.dataset.videoId ?? "";
    if (!isYoutubeVideoId(videoId)) {
      return;
    }

    const videoTitle = trigger.dataset.videoTitle ?? "";
    const publishedDate = trigger.dataset.videoDate ?? "";
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const player = document.createElement("iframe");

    player.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    player.title = `${copyFor(currentLanguage).videos.playerTitlePrefix}: ${videoTitle}`;
    player.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    player.referrerPolicy = "strict-origin-when-cross-origin";
    player.allowFullscreen = true;

    frame.replaceChildren(player);

    if (title) {
      title.textContent = videoTitle;
    }

    if (date instanceof HTMLTimeElement) {
      date.textContent = publishedDate;
      date.hidden = !publishedDate;
    }

    if (externalLink instanceof HTMLAnchorElement) {
      externalLink.href = youtubeUrl;
    }

    dialog.showModal();
    document.body.classList.add(STATE.modalOpen);
  });

  closeButton?.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("close", clearPlayer);
};

const bindHeroSlideshow = () => {
  window.clearInterval(heroRotationTimer);
  heroRotationTimer = null;

  const slides = Array.from(document.querySelectorAll("[data-hero-slide]"));
  const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (slides.length < 2 || shouldReduceMotion) {
    return;
  }

  let activeIndex = 0;

  const showSlide = (nextIndex) => {
    activeIndex = (nextIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.classList.toggle(STATE.active, isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });
  };

  heroRotationTimer = window.setInterval(
    () => showSlide(activeIndex + 1),
    HERO_ROTATION_INTERVAL
  );
};

const bindInteractions = () => {
  const nav = document.querySelector(SELECTORS.nav);
  const navToggle = document.querySelector(SELECTORS.navToggle);

  navToggle?.addEventListener("click", () => {
    const isOpen = nav?.classList.toggle(STATE.navVisible) ?? false;
    document.body.classList.toggle(STATE.navOpen, isOpen);
    document.querySelector(SELECTORS.header)?.classList.toggle(STATE.navOpen, isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeNav();
    }
  });

  document.querySelectorAll(SELECTORS.languageButton).forEach((button) => {
    button.addEventListener("click", () => {
      const nextLanguage = normalizeLanguage(button.getAttribute("data-lang"));
      setLanguage(nextLanguage);
      closeNav();
    });
  });

  bindHeroSlideshow();
  bindMinistryDialogs();
  bindVideoDialog();
};

const initializeReveals = () => {
  revealObserver?.disconnect();
  const revealElements = Array.from(document.querySelectorAll(SELECTORS.reveal));
  const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (shouldReduceMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add(STATE.visible));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(STATE.visible);
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  revealElements.forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 110}ms`);
    revealObserver.observe(element);
  });
};

const scrollToCurrentHash = () => {
  let id = "";

  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }

  if (!id) {
    return;
  }

  const target = document.getElementById(id);
  if (target) {
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }
};

const renderYoutubeState = (lang, videoItems, statusText, isError = false) => {
  const copy = copyFor(lang);
  const grid = document.querySelector(SELECTORS.youtubeGrid);
  const status = document.querySelector(SELECTORS.youtubeStatus);

  if (grid) {
    grid.innerHTML = renderVideoCards(copy.videos, videoItems, lang);
  }

  if (status) {
    status.textContent = statusText;
    status.classList.toggle(STATE.loading, false);
    status.classList.toggle(STATE.error, isError);
  }
};

const hydrateYoutubeVideos = (lang) => {
  const { youtube } = siteContent.church;

  if (!document.querySelector(SELECTORS.youtubeGrid)) {
    return;
  }

  youtubeFetchController?.abort();
  youtubeFetchController = new AbortController();

  const timeoutId = window.setTimeout(() => youtubeFetchController.abort(), YOUTUBE_FETCH_TIMEOUT_MS);

  fetch(youtube.feedApiUrl, { signal: youtubeFetchController.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`YouTube feed request failed with status ${response.status}`);
      }

      return response.json();
    })
    .then((payload) => {
      const latestVideos = Array.isArray(payload.items)
        ? payload.items.slice(0, youtube.maxVideos).map(normalizeYoutubeVideo)
        : [];

      if (!latestVideos.length) {
        throw new Error("YouTube feed returned no videos.");
      }

      if (currentLanguage === lang) {
        renderYoutubeState(lang, latestVideos, copyFor(lang).videos.readyLabel);
      }
    })
    .catch((error) => {
      if (error.name === "AbortError" && currentLanguage !== lang) {
        return;
      }

      if (currentLanguage === lang) {
        renderYoutubeState(lang, fallbackYoutubeVideos(), copyFor(lang).videos.errorLabel, true);
      }
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
    });
};

const renderSite = (lang) => {
  const normalizedLanguage = normalizeLanguage(lang);
  const copy = copyFor(normalizedLanguage);

  document.documentElement.lang = normalizedLanguage;
  setShellClasses();
  document.querySelector(SELECTORS.skipLink).textContent = copy.skip;
  document.querySelector(SELECTORS.header).innerHTML = renderHeader(normalizedLanguage);
  document.querySelector(SELECTORS.pageRoot).innerHTML = renderMain(normalizedLanguage);
  document.querySelector(SELECTORS.footer).innerHTML = renderFooter(normalizedLanguage);

  updateMetadata(normalizedLanguage);
  updateStructuredData();
  bindInteractions();
  initializeReveals();
  hydrateYoutubeVideos(normalizedLanguage);
  setScrolledState();
  scrollToCurrentHash();
};

const setLanguage = (lang) => {
  currentLanguage = normalizeLanguage(lang);
  persistLanguage(currentLanguage);
  renderSite(currentLanguage);
};

window.addEventListener("scroll", setScrolledState, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 980) {
    closeNav();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNav();
  }
});

setLanguage(readStoredLanguage() ?? siteContent.defaultLanguage);
