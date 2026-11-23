/*
 * Загрузка опубликованных статей из Strapi CMS.
 * Для подключения к другому серверу измените только STRAPI_URL.
 * Пример: const STRAPI_URL = "https://cms.example.ru";
 * Публичный API должен иметь только права чтения. Не помещайте сюда Admin/API token.
 */
(function () {
  "use strict";

  const STRAPI_URL = "http://localhost:1337";
  const API_URL = `${STRAPI_URL.replace(/\/$/, "")}/api/articles?populate=*&sort=published_on:desc`;

  const statusElement = document.getElementById("knowledge-status");
  const listElement = document.getElementById("knowledge-list");

  if (!statusElement || !listElement) return;

  function unwrap(entity) {
    if (!entity) return null;
    if (entity.data !== undefined) {
      if (Array.isArray(entity.data)) return entity.data.map(unwrap);
      return unwrap(entity.data);
    }
    if (entity.attributes) return { id: entity.id, ...entity.attributes };
    return entity;
  }

  function relationName(value) {
    const item = Array.isArray(value) ? value[0] : value;
    const relation = unwrap(item);
    return relation && (relation.name || relation.title) ? (relation.name || relation.title) : "";
  }

  function getMediaUrl(value) {
    const item = Array.isArray(value) ? value[0] : value;
    const media = unwrap(item);
    if (!media || !media.url) return "";
    if (/^https?:\/\//i.test(media.url)) return media.url;
    return `${STRAPI_URL.replace(/\/$/, "")}${media.url.startsWith("/") ? "" : "/"}${media.url}`;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }

  function collectText(value) {
    if (value == null) return "";
    if (typeof value === "string") return value.replace(/<[^>]*>/g, " ").replace(/[#*_`]/g, " ").replace(/\s+/g, " ").trim();
    if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join(" ");
    if (typeof value === "object") {
      if (typeof value.text === "string") return value.text;
      if (value.children) return collectText(value.children);
      if (value.content) return collectText(value.content);
    }
    return "";
  }

  function appendInline(parent, nodes) {
    (Array.isArray(nodes) ? nodes : [nodes]).forEach((node) => {
      if (node == null) return;
      if (typeof node === "string") {
        parent.appendChild(document.createTextNode(node));
        return;
      }
      if (node.text !== undefined) {
        let target = document.createTextNode(node.text || "");
        const wrappers = [];
        if (node.code) wrappers.push("code");
        if (node.bold) wrappers.push("strong");
        if (node.italic) wrappers.push("em");
        if (node.underline) wrappers.push("u");
        if (node.strikethrough) wrappers.push("s");
        wrappers.forEach((tag) => {
          const wrapper = document.createElement(tag);
          wrapper.appendChild(target);
          target = wrapper;
        });
        parent.appendChild(target);
        return;
      }
      if (node.type === "link") {
        const link = document.createElement("a");
        const href = typeof node.url === "string" ? node.url : "";
        if (/^https?:\/\//i.test(href)) {
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        appendInline(link, node.children || []);
        parent.appendChild(link);
        return;
      }
      if (node.children) appendInline(parent, node.children);
    });
  }

  function renderMarkdownText(container, value) {
    const lines = String(value || "").replace(/\r/g, "").split("\n");
    let paragraph = [];
    let list = null;
    let codeLines = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      const p = document.createElement("p");
      p.textContent = paragraph.join(" ");
      container.appendChild(p);
      paragraph = [];
    }
    function flushList() {
      if (list) container.appendChild(list);
      list = null;
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        flushParagraph();
        flushList();
        if (codeLines) {
          const pre = document.createElement("pre");
          pre.textContent = codeLines.join("\n");
          container.appendChild(pre);
          codeLines = null;
        } else codeLines = [];
        return;
      }
      if (codeLines) { codeLines.push(line); return; }
      if (!trimmed) { flushParagraph(); flushList(); return; }
      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        const h = document.createElement(heading[1].length <= 2 ? "h3" : "h4");
        h.textContent = heading[2];
        container.appendChild(h);
        return;
      }
      const unordered = trimmed.match(/^[-*]\s+(.+)$/);
      const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const wantedTag = ordered ? "ol" : "ul";
        if (!list || list.tagName.toLowerCase() !== wantedTag) { flushList(); list = document.createElement(wantedTag); }
        const li = document.createElement("li");
        li.textContent = (unordered || ordered)[1];
        list.appendChild(li);
        return;
      }
      flushList();
      paragraph.push(trimmed);
    });
    flushParagraph();
    flushList();
    if (codeLines) {
      const pre = document.createElement("pre");
      pre.textContent = codeLines.join("\n");
      container.appendChild(pre);
    }
  }

  function renderBlocks(container, blocks) {
    blocks.forEach((block) => {
      if (!block || typeof block !== "object") return;
      const children = block.children || [];
      let element;
      switch (block.type) {
        case "heading":
          element = document.createElement(block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4");
          appendInline(element, children);
          container.appendChild(element);
          break;
        case "list":
          element = document.createElement(block.format === "ordered" ? "ol" : "ul");
          children.forEach((item) => {
            const li = document.createElement("li");
            appendInline(li, item.children || []);
            element.appendChild(li);
          });
          container.appendChild(element);
          break;
        case "quote":
          element = document.createElement("blockquote");
          appendInline(element, children);
          container.appendChild(element);
          break;
        case "code":
          element = document.createElement("pre");
          element.textContent = collectText(children);
          container.appendChild(element);
          break;
        case "paragraph":
        default:
          element = document.createElement("p");
          appendInline(element, children);
          if (element.textContent.trim()) container.appendChild(element);
      }
    });
  }

  function renderContent(container, content) {
    container.replaceChildren();
    if (Array.isArray(content)) {
      renderBlocks(container, content);
    } else if (content && typeof content === "object" && Array.isArray(content.blocks)) {
      renderBlocks(container, content.blocks);
    } else if (typeof content === "string") {
      renderMarkdownText(container, content);
    } else {
      const p = document.createElement("p");
      p.textContent = collectText(content) || "Текст статьи не заполнен.";
      container.appendChild(p);
    }
  }

  function makeCard(rawArticle) {
    const article = unwrap(rawArticle) || {};
    const card = document.createElement("article");
    card.className = "knowledge-card";

    const coverUrl = getMediaUrl(article.cover);
    if (coverUrl) {
      const image = document.createElement("img");
      image.className = "knowledge-card-cover";
      image.src = coverUrl;
      image.alt = article.title ? `Обложка: ${article.title}` : "Обложка статьи";
      image.loading = "lazy";
      card.appendChild(image);
    }

    const meta = document.createElement("div");
    meta.className = "knowledge-meta";
    const category = relationName(article.category);
    if (category) {
      const categoryTag = document.createElement("span");
      categoryTag.className = "knowledge-category";
      categoryTag.textContent = category;
      meta.appendChild(categoryTag);
    }
    if (article.type) {
      const typeTag = document.createElement("span");
      typeTag.className = "knowledge-type";
      typeTag.textContent = String(article.type);
      meta.appendChild(typeTag);
    }
    const dateText = formatDate(article.published_on);
    if (dateText) {
      const date = document.createElement("time");
      date.textContent = dateText;
      date.dateTime = String(article.published_on);
      meta.appendChild(date);
    }
    card.appendChild(meta);

    const title = document.createElement("h3");
    title.textContent = article.title || "Статья без названия";
    card.appendChild(title);

    const fullText = collectText(article.content);
    const excerpt = document.createElement("p");
    excerpt.className = "knowledge-excerpt";
    excerpt.textContent = fullText ? (fullText.length > 190 ? `${fullText.slice(0, 187).trim()}...` : fullText) : "Откройте статью, чтобы посмотреть материал.";
    card.appendChild(excerpt);

    const details = document.createElement("details");
    details.className = "knowledge-details";
    const summary = document.createElement("summary");
    summary.textContent = "Читать полностью";
    details.appendChild(summary);
    const body = document.createElement("div");
    body.className = "knowledge-article-content";
    renderContent(body, article.content);
    details.appendChild(body);
    card.appendChild(details);

    return card;
  }

  function showError(message) {
    statusElement.textContent = message;
    statusElement.classList.add("is-error");
  }

  async function loadArticles() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: { "Accept": "application/json" },
        mode: "cors"
      });

      if (response.status === 403) {
        showError("Strapi запретил чтение статей (403). В настройках роли Public нужно разрешить Article: find и findOne. Если категория не загружается, также разрешите Category: find и findOne.");
        return;
      }
      if (!response.ok) {
        showError(`Не удалось загрузить статьи из Strapi: HTTP ${response.status}. Проверьте адрес API и права доступа.`);
        return;
      }

      const result = await response.json();
      const articles = Array.isArray(result.data) ? result.data : [];
      if (!articles.length) {
        statusElement.textContent = "В Strapi пока нет опубликованных статей.";
        return;
      }

      articles.forEach((article) => listElement.appendChild(makeCard(article)));
      statusElement.textContent = `Загружено статей: ${articles.length}. Данные получены из Strapi CMS.`;
    } catch (error) {
      console.error("Strapi articles loading error:", error);
      showError("Не удалось связаться со Strapi. Проверьте значение STRAPI_URL в файле strapi-knowledge.js, доступность сервера и настройки CORS.");
    }
  }

  loadArticles();
})();
