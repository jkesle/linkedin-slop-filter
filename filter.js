// @match https://www.linkedin.com/feed/*
// @match https://www.linkedin.com/*

(function () {
  "use strict";

  const CONFIG = {
    // Hide matched posts with display:none.
    hidePosts: true,

    // If true, matching posts are removed from the DOM instead of hidden.
    removePosts: false,

    // Minimum score needed to hide a post.
    threshold: 3,

    // Turn on temporarily if you want console logs explaining why a post was hidden.
    debug: true,
  };

  const AI_PATTERNS = [
    // Em dash specifically.
    /\u2014/,

    // Common AI / LinkedIn slop phrases.
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
    /\bmore\s+than\s+a\s+project\b/i,
    /\bmore\s+than\s+a\s+product\b/i,
    /\bnot\s+just\s+a\s+tool\b/i,
    /\bbridging\s+the\s+gap\b/i,
    /\bat\s+the\s+intersection\s+of\b/i,
  ];

  function normalizeText(text) {
    return text
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getLines(text) {
    return text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
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

      // Example:
      // Not for marketing.
      // Not for glamour.
      // But for respect.
      if (
        /^not\s+for\s+/i.test(a) &&
        /^not\s+for\s+/i.test(b) &&
        /^(but|just|only)?\s*for\s+/i.test(c)
      ) {
        return true;
      }

      // Example:
      // No spotlight.
      // No applause.
      // Just courage.
      if (
        /^no\s+/i.test(a) &&
        /^no\s+/i.test(b) &&
        /^(just|only|but)\s+/i.test(c)
      ) {
        return true;
      }

      // Same first word twice, then contrast.
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

  function countPatternMatches(text) {
    let count = 0;

    for (const pattern of AI_PATTERNS) {
      if (pattern.test(text)) {
        count++;
      }
    }

    return count;
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

    // Make em dash an instant strong signal.
    const emDashCount = (normalized.match(/\u2014/g) || []).length;
    if (emDashCount >= 1) {
      score += 10;
      reasons.push(`${emDashCount} em dash character(s)`);
    }

    // Also score en dash, but weaker than em dash.
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

    return { score, reasons, text: normalized };
  }

  function findPostContainer(element) {
    return (
      element.closest(".feed-shared-update-v2") ||
      element.closest("div[data-urn]") ||
      element.closest("article") ||
      element.closest(".update-components-actor")?.closest("div") ||
      element
    );
  }

  function markPost(post, result) {
    if (!post || post.dataset.aiSlopFiltered === "true") return;

    post.dataset.aiSlopFiltered = "true";

    if (CONFIG.debug) {
      console.group("LinkedIn AI-slop filtered post");
      console.log("Score:", result.score);
      console.log("Reasons:", result.reasons);
      console.log("Text:", result.text);
      console.log("Element:", post);
      console.groupEnd();
    }

    if (CONFIG.removePosts) {
      post.remove();
      return;
    }

    if (CONFIG.hidePosts) {
      post.style.display = "none";
    }
  }

  function scanPost(post) {
    if (!post) return;

    const text = normalizeText(post.innerText || "");
    if (!text || text.length < 40) return;
    if (post.dataset.aiSlopLastText === text) return;
    post.dataset.aiSlopLastText = text;

    if (CONFIG.debug && text.includes("—")) {
      console.log("LinkedIn AI-slop filter: found em dash post", post, text);
    }

    const result = scorePostText(text);

    if (result.score >= CONFIG.threshold) {
      markPost(post, result);
    }
  }

  function scanPage() {
    const possiblePosts = document.querySelectorAll(`
      .feed-shared-update-v2,
      div[data-urn],
      article
    `);

    possiblePosts.forEach(post => {
      const container = findPostContainer(post);
      scanPost(container);
    });
  }

  function observeFeed() {
    let scanTimer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);

      scanTimer = setTimeout(() => {
        scanPage();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function addManualRescanShortcut() {
    window.addEventListener("keydown", event => {
      if (event.ctrlKey && event.key.toLowerCase() === "m") {
        document
          .querySelectorAll("[data-ai-slop-last-text]")
          .forEach(el => delete el.dataset.aiSlopLastText);

        scanPage();

        if (CONFIG.debug) {
          console.log("LinkedIn AI-slop filter: manual rescan complete.");
        }
      }
    });
  }

  function start() {
    scanPage();
    observeFeed();
    addManualRescanShortcut();
    setTimeout(scanPage, 1000);
    setTimeout(scanPage, 2500);
    setTimeout(scanPage, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
