// ==UserScript==
// @name         LinkedIn AI-Slop Post Filter
// @namespace    local.linkedin.ai.filter
// @version      1.4.0
// @description  Hide LinkedIn posts that look AI-generated.
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  console.log("[AI-Slop Filter] Loaded:", location.href);

  const CONFIG = {
    hidePosts: false,
    removePosts: true,
    threshold: 4,
    debug: true,
    scanIntervalMs: 4000,
    scrollScanDelayMs: 700,
  };

  const AI_PATTERNS = [
    /\u2014/, // em dash —
    /\bthis\s+(small|simple|quiet|bold)?\s*decision\s+carries\s+a\s+powerful\s+message\b/i,
    /\bpowerful\s+message\b/i,
    /\bslowly\s+learning\s+to\b/i,
    /\bcelebrate\s+\w+\s+over\s+\w+\b/i,
    /\bnot\s+for\s+\w+\b/i,
    /\bbut\s+for\s+\w+\b/i,
    /\bhere'?s\s+what\s+it\s+means\b/i,
    /\blet\s+that\s+sink\s+in\b/i,
    /\bthe\s+lesson\s+is\s+simple\b/i,
    /\bthis\s+isn'?t\s+just\s+about\b/i,
    /\bit'?s\s+about\s+.+\b/i,
    /\band\s+that'?s\s+the\s+point\b/i,
    /\bthat'?s\s+leadership\b/i,
    /\bthat'?s\s+growth\b/i,
    /\bthat'?s\s+courage\b/i,
    /\bmore\s+than\s+just\s+a\b/i,
    /\bin\s+a\s+world\s+where\b/i,
    /\bwe\s+need\s+more\s+of\s+this\b/i,
    /\bread\s+that\s+again\b/i,
    /\brespectful\s+dialogue\b/i,
    /\bbetween\s+species\b/i,
    /\bconstellation\s+of\s+meanings\b/i,
    /\buses\s+machine\s+learning\s+to\s+map\b/i,
    /\btranslating\s+human\s+questions\b/i,
    /\bimagine\s+a\s+respectful\b/i,
    /\bat\s+the\s+intersection\s+of\b/i,
    /\bbridging\s+the\s+gap\b/i,
  ];

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isVisibleElement(el) {
    if (!(el instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(el);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function extractVisibleTextRecursive(root) {
    const parts = [];

    function walk(node) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const value = normalizeText(node.nodeValue);
        if (value) parts.push(value);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node;
      if (!(el instanceof HTMLElement)) return;
      if (!isVisibleElement(el)) return;

      const tag = el.tagName.toLowerCase();

      if (
        tag === "script" ||
        tag === "style" ||
        tag === "noscript" ||
        tag === "svg" ||
        tag === "path"
      ) {
        return;
      }

      if (tag === "button") return;

      for (const child of el.childNodes) {
        walk(child);
      }
        
        const feedTextElements = new Set('p', 'div', 'span', 'li', 'br');
        if (feedTextElements.includes(tag) parts.push("\n");
    }

    walk(root);

    return normalizeText(parts.join(" "));
  }

  function getLines(text) {
    return text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  function countPatternMatches(text) {
    let count = 0;

    for (const pattern of AI_PATTERNS) {
      if (pattern.test(text)) count++;
    }

    return count;
  }

  function hasRepetitiveTripletStructure(lines) {
    if (lines.length < 3) return false;

    for (let i = 0; i <= lines.length - 3; i++) {
      const a = lines[i];
      const b = lines[i + 1];
      const c = lines[i + 2];

      const firstWordA = a.split(/\s+/)[0]?.toLowerCase();
      const firstWordB = b.split(/\s+/)[0]?.toLowerCase();
      const firstWordC = c.split(/\s+/)[0]?.toLowerCase();

      if (
        /^not\s+for\s+/i.test(a) &&
        /^not\s+for\s+/i.test(b) &&
        /^(but|just|only)?\s*for\s+/i.test(c)
      ) {
        return true;
      }

      if (
        /^no\s+/i.test(a) &&
        /^no\s+/i.test(b) &&
        /^(just|only|but)\s+/i.test(c)
      ) {
        return true;
      }

      if (
        firstWordA &&
        firstWordA === firstWordB &&
        ["but", "just", "only", "because", "for"].includes(firstWordC)
      ) {
        return true;
      }
    }

    return false;
  }

  function hasExcessiveInspirationalLineBreaks(lines) {
    if (lines.length < 5) return false;

    const shortLines = lines.filter(line => {
      const wordCount = line.split(/\s+/).length;
      return wordCount >= 2 && wordCount <= 9;
    });

    return shortLines.length >= 5 && shortLines.length / lines.length > 0.6;
  }

  function scorePostText(text) {
    const normalized = normalizeText(text);
    const lines = getLines(normalized);

    let score = 0;
    const reasons = [];

    const patternMatches = countPatternMatches(normalized);
    if (patternMatches > 0) {
      score += patternMatches;
      reasons.push(`${patternMatches} phrase/punctuation pattern(s)`);
    }

    const emDashCount = (normalized.match(/\u2014/g) || []).length;
    if (emDashCount >= 1) {
      score += 10;
      reasons.push(`${emDashCount} em dash character(s)`);
    }

    const enDashCount = (normalized.match(/\u2013/g) || []).length;
    if (enDashCount >= 1) {
      score += 4;
      reasons.push(`${enDashCount} en dash character(s)`);
    }

    if (hasRepetitiveTripletStructure(lines)) {
      score += 4;
      reasons.push("repetitive three-line structure");
    }

    if (hasExcessiveInspirationalLineBreaks(lines)) {
      score += 2;
      reasons.push("excessive short dramatic line breaks");
    }

    if (
      lines.length >= 4 &&
      /\b(message|lesson|courage|respect|fame|growth|leadership|humanity|kindness|dialogue|meaning|purpose|vision|journey)\b/i.test(normalized)
    ) {
      score += 1;
      reasons.push("generic inspirational vocabulary");
    }

    return {
      score,
      reasons,
      text: normalized,
    };
  }

  function getFeedContainers() {
    return Array.from(
      document.querySelectorAll(
        'div[data-testid="mainFeed"], div[role="list"][data-component-type="LazyColumn"]'
      )
    ).filter(el => el instanceof HTMLElement);
  }

  function looksLikeFeedItem(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches('div[data-testid="mainFeed"]')) return false;

    const text = extractVisibleTextRecursive(el);
    if (text.length < 40) return false;

    return true;
  }

  function getFeedPosts() {
    const feeds = getFeedContainers();

    if (CONFIG.debug) {
      console.log(`[AI-Slop Filter] Feed containers found: ${feeds.length}`);
    }

    const posts = [];

    for (const feed of feeds) {
      // Direct children are the safest post containers.
      // Text inside each child is extracted recursively.
      for (const child of feed.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (looksLikeFeedItem(child)) posts.push(child);
      }
    }

    return posts;
  }

  function markPost(post, result) {
    if (!post || post.dataset.aiSlopFiltered === "true") return;

    post.dataset.aiSlopFiltered = "true";

    console.group("[AI-Slop Filter] Hidden post");
    console.log("Score:", result.score);
    console.log("Reasons:", result.reasons);
    console.log("Text:", result.text);
    console.log("Element:", post);
    console.groupEnd();

    if (CONFIG.removePosts) {
      post.remove();
    } else if (CONFIG.hidePosts) {
      post.style.display = "none";
    }
  }

  function scanPost(post) {
    if (!post) return;

    const text = extractVisibleTextRecursive(post);
    if (!text || text.length < 40) return;
    if (post.dataset.aiSlopLastText === text) return;
    post.dataset.aiSlopLastText = text;

    const result = scorePostText(text);

    if (CONFIG.debug) {
      console.log("[AI-Slop Filter] Scanned post:", {
        score: result.score,
        reasons: result.reasons,
        hasEmDash: text.includes("—"),
        preview: text.slice(0, 300),
        element: post,
      });
    }

    if (result.score >= CONFIG.threshold) {
      markPost(post, result);
    }
  }

  function scanPage() {
    const posts = getFeedPosts();

    if (CONFIG.debug) {
      console.log(`[AI-Slop Filter] Candidate posts found: ${posts.length}`);
    }

    for (const post of posts) {
      scanPost(post);
    }
  }

  function scheduleScan(delay = 250) {
    clearTimeout(scheduleScan.timer);
    scheduleScan.timer = setTimeout(scanPage, delay);
  }

  function observePage() {
    const observer = new MutationObserver(() => {
      scheduleScan(250);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function observeScroll() {
    let lastY = window.scrollY;

    window.addEventListener(
      "scroll",
      () => {
        const currentY = window.scrollY;
        const moved = Math.abs(currentY - lastY);

        if (moved > 150) {
          lastY = currentY;
          scheduleScan(CONFIG.scrollScanDelayMs);
          setTimeout(scanPage, CONFIG.scrollScanDelayMs + 1000);
        }
      },
      { passive: true }
    );
  }

  function hookHistoryNavigation() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(scanPage, 500);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(scanPage, 500);
    };

    window.addEventListener("popstate", () => {
      setTimeout(scanPage, 500);
    });
  }

  function addManualRescanShortcut() {
    window.addEventListener("keydown", event => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "f") {
        document
          .querySelectorAll("[data-ai-slop-last-text]")
          .forEach(el => delete el.dataset.aiSlopLastText);

        console.log("[AI-Slop Filter] Manual rescan triggered");
        scanPage();
      }
    });
  }

  function start() {
    console.log("[AI-Slop Filter] Starting scanner");

    scanPage();
    observePage();
    observeScroll();
    hookHistoryNavigation();
    addManualRescanShortcut();

    setTimeout(scanPage, 1000);
    setTimeout(scanPage, 2500);
    setTimeout(scanPage, 5000);
    setInterval(scanPage, CONFIG.scanIntervalMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
