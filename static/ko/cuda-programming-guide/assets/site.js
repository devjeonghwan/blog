(function () {
  function toggleSidebar() {
    document.body.classList.toggle("sidebar-open");
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }

  function toggleSearch() {
    document.body.classList.toggle("search-open");
    if (document.body.classList.contains("search-open")) {
      var searchInput = document.querySelector(".site-header .search-form input[name='q']");
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  function closeSearch() {
    document.body.classList.remove("search-open");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegularExpression(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function tokenize(value) {
    return String(value || "")
      .toLowerCase()
      .split(/[\s/_.:,;()[\]{}<>!?'"`~@#$%^&*+=|-]+/)
      .filter(Boolean);
  }

  function uniqueTokens(value) {
    var seen = {};
    return tokenize(value).filter(function (token) {
      if (seen[token]) {
        return false;
      }
      seen[token] = true;
      return true;
    });
  }

  function buildExcerpt(text, query) {
    var normalizedText = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalizedText) {
      return "";
    }
    if (!query) {
      return normalizedText.slice(0, 220) + (normalizedText.length > 220 ? "..." : "");
    }
    var lowerText = normalizedText.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var index = lowerText.indexOf(lowerQuery);
    if (index === -1) {
      var firstToken = uniqueTokens(query)[0];
      index = firstToken ? lowerText.indexOf(firstToken) : -1;
    }
    if (index === -1) {
      return normalizedText.slice(0, 220) + (normalizedText.length > 220 ? "..." : "");
    }
    var start = Math.max(0, index - 80);
    var end = Math.min(normalizedText.length, index + 180);
    var excerpt = normalizedText.slice(start, end);
    if (start > 0) {
      excerpt = "..." + excerpt;
    }
    if (end < normalizedText.length) {
      excerpt += "...";
    }
    return excerpt;
  }

  function highlightText(text, query) {
    var originalText = String(text || "");
    var tokens = uniqueTokens(query).slice(0, 8);
    if (!originalText || !tokens.length) {
      return escapeHtml(originalText);
    }
    var regularExpression = new RegExp("(" + tokens.map(escapeRegularExpression).join("|") + ")", "gi");
    var result = "";
    var lastIndex = 0;

    originalText.replace(regularExpression, function (match, _group, offset) {
      result += escapeHtml(originalText.slice(lastIndex, offset));
      result += '<mark class="mark">' + escapeHtml(match) + "</mark>";
      lastIndex = offset + match.length;
      return match;
    });

    result += escapeHtml(originalText.slice(lastIndex));
    return result;
  }

  function setSearchInputValues(query) {
    document.querySelectorAll("input[name='q']").forEach(function (input) {
      if (document.activeElement === input && input.value.trim()) {
        return;
      }
      input.value = query;
    });
  }

  function attachSearchForms() {
    document.querySelectorAll("[data-doc-search-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var input = form.querySelector("input[name='q']");
        var action = form.getAttribute("action");
        if (!input || !action) {
          return;
        }
        var query = input.value.trim();
        var destination = action;
        if (query) {
          destination += "?q=" + encodeURIComponent(query);
        }
        closeSearch();
        window.location.href = destination;
      });
    });
  }

  function createTableModal() {
    var modal = document.createElement("div");
    modal.className = "table-modal";
    modal.innerHTML = [
      '<div class="table-modal__dialog" role="dialog" aria-modal="true" aria-label="표 크게 보기">',
      '  <div class="table-modal__header">',
      '    <div class="table-modal__title">표 크게 보기</div>',
      '    <button class="table-modal__close" type="button" aria-label="닫기">✕</button>',
      "  </div>",
      '  <div class="table-modal__body"></div>',
      "</div>",
    ].join("");
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.remove("is-open");
      modal.querySelector(".table-modal__body").innerHTML = "";
      document.body.style.overflow = "";
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal || event.target.closest(".table-modal__close")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });

    return {
      open: function (tableFrame, title) {
        var body = modal.querySelector(".table-modal__body");
        body.innerHTML = "";
        var clone = tableFrame.cloneNode(true);
        var button = clone.querySelector(".table-expand-button");
        if (button) {
          button.remove();
        }
        clone.classList.add("table-frame--modal");

        var canvas = document.createElement("div");
        canvas.className = "table-modal__canvas";
        body.appendChild(canvas);
        canvas.appendChild(clone);

        modal.querySelector(".table-modal__title").textContent = title || "표 크게 보기";
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
        window.requestAnimationFrame(function () {
          var sourceWidth = Math.max(tableFrame.scrollWidth, Math.round(tableFrame.getBoundingClientRect().width));
          var bodyStyles = window.getComputedStyle(body);
          var horizontalPadding =
            (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
          var availableWidth = Math.max(body.clientWidth - horizontalPadding, 0);

          if (sourceWidth > 0) {
            clone.style.width = sourceWidth + "px";
            clone.style.maxWidth = "none";
          }

          var scale = 1;
          if (sourceWidth > 0 && availableWidth > 0) {
            scale = availableWidth / sourceWidth;
          }

          clone.style.position = "absolute";
          clone.style.left = "0";
          clone.style.top = "0";
          clone.style.transformOrigin = "top left";
          clone.style.transform = "scale(" + scale + ")";
          canvas.style.width = "100%";
          canvas.style.height = Math.ceil(clone.scrollHeight * scale) + "px";
        });
      },
    };
  }

  function enhanceTables() {
    var frames = Array.prototype.slice.call(document.querySelectorAll(".doc-article .table-frame"));
    if (!frames.length) {
      return;
    }

    var modal = createTableModal();
    frames.forEach(function (frame, index) {
      var firstElementChild = frame.firstElementChild;
      if (firstElementChild && firstElementChild.classList.contains("table-expand-button")) {
        return;
      }

      var button = document.createElement("button");
      button.className = "table-expand-button";
      button.type = "button";
      button.textContent = "표 크게 보기";
      var caption = frame.querySelector("caption");
      var title = caption ? caption.textContent.trim() : "표 " + (index + 1);
      button.addEventListener("click", function () {
        modal.open(frame, title);
      });
      frame.insertBefore(button, frame.firstChild);
    });
  }

  function updateActiveTocLink() {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-link"));
    if (!tocLinks.length || !("IntersectionObserver" in window)) {
      return;
    }

    var linkMap = {};
    tocLinks.forEach(function (link) {
      var href = link.getAttribute("href");
      if (href && href.charAt(0) === "#") {
        linkMap[href.slice(1)] = link;
      }
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var link = linkMap[entry.target.id];
          if (!link) {
            return;
          }
          tocLinks.forEach(function (candidate) {
            candidate.classList.remove("is-active");
          });
          link.classList.add("is-active");
        });
      },
      {
        rootMargin: "-100px 0px -70% 0px",
        threshold: 0.1,
      }
    );

    Object.keys(linkMap).forEach(function (id) {
      var target = document.getElementById(id);
      if (target) {
        observer.observe(target);
      }
    });
  }

  function scoreRecord(record, query) {
    var tokens = uniqueTokens(query);
    if (!tokens.length) {
      return 0;
    }

    var title = String(record.title || "").toLowerCase();
    var headings = (record.headings || []).join(" ").toLowerCase();
    var breadcrumbs = (record.breadcrumbs || []).join(" ").toLowerCase();
    var content = String(record.content || "").toLowerCase();
    var matchedTokenCount = 0;
    var score = 0;

    tokens.forEach(function (token) {
      var tokenScore = 0;
      if (title.indexOf(token) !== -1) {
        tokenScore += 80;
      }
      if (headings.indexOf(token) !== -1) {
        tokenScore += 35;
      }
      if (breadcrumbs.indexOf(token) !== -1) {
        tokenScore += 14;
      }
      if (content.indexOf(token) !== -1) {
        tokenScore += 8;
      }
      if (tokenScore > 0) {
        matchedTokenCount += 1;
        score += tokenScore;
      }
    });

    if (!score) {
      return 0;
    }

    if (matchedTokenCount === tokens.length) {
      score += 40;
    }
    if (title.indexOf(query.toLowerCase()) !== -1) {
      score += 50;
    }
    if (headings.indexOf(query.toLowerCase()) !== -1) {
      score += 20;
    }
    return score;
  }

  function buildSearchResultMarkup(record, query) {
    var breadcrumbText = (record.breadcrumbs || []).join(" / ");
    var headingText = (record.headings || []).slice(0, 5).join(" · ");
    var excerpt = buildExcerpt(record.content || "", query);
    var metaParts = [];

    if (breadcrumbText) {
      metaParts.push(highlightText(breadcrumbText, query));
    }
    if (headingText) {
      metaParts.push(highlightText(headingText, query));
    }

    return [
      '<article class="search-result">',
      '  <a class="search-result__title" href="' + escapeHtml(record.href || "#") + '">',
      highlightText(record.title || "", query),
      "  </a>",
      metaParts.length ? '  <div class="search-result__meta">' + metaParts.join(" · ") + "</div>" : "",
      excerpt ? '  <div class="search-result__excerpt">' + highlightText(excerpt, query) + "</div>" : "",
      "</article>",
    ].join("");
  }

  function renderSearchResults(query) {
    var resultsContainer = document.querySelector("[data-search-results]");
    if (!resultsContainer) {
      return;
    }

    var normalizedQuery = String(query || "").trim();
    var records = Array.isArray(window.SiteSearchIndex) ? window.SiteSearchIndex : [];
    if (!normalizedQuery) {
      resultsContainer.innerHTML =
        '<div class="search-empty">검색어를 입력하면 제목, 소제목, 본문 내용을 기준으로 결과를 정렬해 보여줍니다.</div>';
      return;
    }

    var rankedResults = records
      .map(function (record) {
        return {
          record: record,
          score: scoreRecord(record, normalizedQuery),
        };
      })
      .filter(function (entry) {
        return entry.score > 0;
      })
      .sort(function (left, right) {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return String(left.record.title || "").localeCompare(String(right.record.title || ""), "ko");
      })
      .slice(0, 80);

    if (!rankedResults.length) {
      resultsContainer.innerHTML =
        '<div class="search-empty">"' +
        escapeHtml(normalizedQuery) +
        '"에 대한 결과를 찾지 못했습니다. 용어를 줄이거나 다른 표현으로 다시 검색해보세요.</div>';
      return;
    }

    resultsContainer.innerHTML = rankedResults
      .map(function (entry) {
        return buildSearchResultMarkup(entry.record, normalizedQuery);
      })
      .join("");
  }

  function initializeSearchPage() {
    var searchPageInput = document.querySelector("[data-search-page-input]");
    if (!searchPageInput) {
      return;
    }

    var initialQuery = "";
    if (window.SiteSearchPageData && typeof window.SiteSearchPageData.query === "string") {
      initialQuery = window.SiteSearchPageData.query.trim();
    }

    setSearchInputValues(initialQuery);
    searchPageInput.value = initialQuery;
    renderSearchResults(initialQuery);

    var renderTimer = null;
    searchPageInput.addEventListener("input", function () {
      var liveQuery = searchPageInput.value.trim();
      setSearchInputValues(liveQuery);
      window.history.replaceState(null, "", liveQuery ? "search.html?q=" + encodeURIComponent(liveQuery) : "search.html");
      window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(function () {
        renderSearchResults(liveQuery);
      }, 80);
    });
  }

  function attachSidebarToggle() {
    document.querySelectorAll("[data-sidebar-toggle]").forEach(function (button) {
      button.addEventListener("click", toggleSidebar);
    });

    document.querySelectorAll("[data-sidebar-close]").forEach(function (element) {
      element.addEventListener("click", closeSidebar);
    });

    document.querySelectorAll(".sidebar-group__summary-link").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSidebar();
        closeSearch();
      }
    });
  }

  function attachSearchToggle() {
    document.querySelectorAll("[data-search-toggle]").forEach(function (button) {
      button.addEventListener("click", toggleSearch);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    attachSidebarToggle();
    attachSearchToggle();
    attachSearchForms();
    enhanceTables();
    updateActiveTocLink();
    initializeSearchPage();
  });
})();
