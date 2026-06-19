// ─────────────────────────────────────────────────────────────────────────
//  Homepage feed filtering — progressive enhancement.
//
//  Without JS the sidebar links just navigate to the real /types|/tags pages.
//  With JS we intercept those clicks and show/hide cards in place instead.
//  One filter is active at a time; clicking it again (or "clear") resets.
//  Hidden cards drop out of the CSS counter automatically, so the hanging
//  index numbers re-flow on their own.
// ─────────────────────────────────────────────────────────────────────────
(function () {
  const feed = document.querySelector("[data-feed]");
  const panel = document.querySelector("[data-filters]");
  if (!feed || !panel) return;

  const cards = Array.from(feed.querySelectorAll(".card"));
  const buttons = Array.from(panel.querySelectorAll(".filter"));
  const reset = panel.querySelector("[data-filter-reset]");
  const countEl = document.querySelector("[data-feed-count]");

  let active = null; // { kind: "type" | "tag", value: string }

  function matches(card) {
    if (!active) return true;
    if (active.kind === "type") return card.dataset.type === active.value;
    return card.dataset.tags.split(/\s+/).filter(Boolean).includes(active.value);
  }

  function apply() {
    let shown = 0;
    cards.forEach((card) => {
      const show = matches(card);
      card.hidden = !show;
      if (show) shown++;
    });

    buttons.forEach((b) => {
      const on =
        active && b.dataset.kind === active.kind && b.dataset.filter === active.value;
      b.classList.toggle("is-active", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (reset) reset.hidden = !active;
    if (countEl) countEl.textContent = shown;
  }

  buttons.forEach((b) => {
    b.setAttribute("role", "button");
    b.addEventListener("click", (e) => {
      e.preventDefault();
      const sel = { kind: b.dataset.kind, value: b.dataset.filter };
      active =
        active && active.kind === sel.kind && active.value === sel.value ? null : sel;
      apply();
    });
  });

  if (reset) {
    reset.addEventListener("click", () => {
      active = null;
      apply();
    });
  }
})();
