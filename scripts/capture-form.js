/**
 * 実サイトのフォームの作りを抜き出す。DevTools のコンソールに貼って実行する。
 *
 * 出力は `tests/fixtures/forms/<site>.json` に保存し、`tests/domain/forms.test.ts` の
 * EXPECTED に手で確かめた欄種を足す。判定を変えたときに実サイトの並びで壊れていないかを
 * 見る回帰テストになる。
 *
 * 取るのは構造だけ。欄の値は取らない（radio の value 属性だけは選択肢の同定に要るので取る）。
 * hidden は判定の対象外なので落とす。select の選択肢は 12 個まで。
 *
 * 使い方:
 *   1. 調べたいフォームのページで DevTools を開く
 *   2. このファイルの中身をコンソールに貼る
 *   3. 出力された JSON をコピーして tests/fixtures/forms/ に置く（url と title は付く）
 *   4. 長い checkbox 群は 1〜2 つに間引いてよい。判定に効くのは name と label だけ
 */
(() => {
  const txt = (n) => (n?.textContent ?? "").replace(/\s+/g, " ").trim();
  const clean = (el) => {
    const c = el.cloneNode(true);
    for (const x of c.querySelectorAll("input,select,textarea,button,script,style")) {
      x.remove();
    }
    return txt(c);
  };
  const isCtl = (n) => n instanceof Element && n.matches("input,select,textarea,button,br,wbr");
  const prev = (el) => {
    let node = el;
    for (let d = 0; d <= 3 && node; d++) {
      let s = node.previousSibling;
      while (s) {
        if (s.nodeType === 3) {
          const t = txt(s);
          if (t) {
            return t.slice(0, 80);
          }
        } else if (s instanceof Element && !isCtl(s)) {
          const t = clean(s);
          if (t) {
            return t.slice(0, 80);
          }
        }
        s = s.previousSibling;
      }
      node = node.parentElement;
      if (!node || node.tagName === "FORM" || node === document.body) {
        break;
      }
    }
    return "";
  };
  const next = (el) => {
    let s = el.nextSibling;
    while (s) {
      if (s.nodeType === 3) {
        const t = txt(s);
        if (t) {
          return t.slice(0, 80);
        }
      } else if (s instanceof Element && !isCtl(s)) {
        const t = clean(s);
        if (t) {
          return t.slice(0, 80);
        }
      }
      s = s.nextSibling;
    }
    return "";
  };
  const vis = (el) => {
    const r = el.getClientRects();
    if (!r.length) {
      return false;
    }
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") {
      return false;
    }
    const b = r[0];
    return b.right > 0 && b.bottom > 0 && b.width > 0 && b.height > 0;
  };
  const inSearch = (el) =>
    !!el.closest('[role="search"]') || !!el.form?.querySelector('input[type="search"]');

  const fields = [];
  document.querySelectorAll("input,select,textarea").forEach((el) => {
    if (el.type === "hidden") {
      return;
    }
    const tr = el.closest("tr");
    const dd = el.closest("dd");
    const wrap = el.closest("label");
    const fs = el.closest("fieldset");
    const f = {
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: el.name || "",
      id: el.id || "",
      autocomplete: el.getAttribute("autocomplete") || "",
      inputmode: el.getAttribute("inputmode") || "",
      pattern: el.getAttribute("pattern") || "",
      maxlength: el.maxLength > 0 ? el.maxLength : null,
      placeholder: el.getAttribute("placeholder") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
      labelledby: (el.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => {
          const n = document.getElementById(id);
          return n ? clean(n) : "";
        })
        .join(" "),
      labels: el.labels ? [...el.labels].map(clean).join(" | ") : "",
      wrap: wrap ? clean(wrap) : "",
      prev: prev(el),
      next: next(el),
      th: tr
        ? txt(tr.querySelector("th"))
        : dd && dd.previousElementSibling?.tagName === "DT"
          ? txt(dd.previousElementSibling)
          : "",
      legend: fs ? txt(fs.querySelector("legend")) : "",
      options:
        el.tagName === "SELECT"
          ? [...el.options].slice(0, 12).map((o) => ({ value: o.value, text: txt(o) }))
          : [],
      nOptions: el.tagName === "SELECT" ? el.options.length : 0,
      value: el.type === "radio" ? el.value : "",
      disabled: el.disabled,
      readonly: !!el.readOnly,
      visible: vis(el),
      checked: !!el.checked,
      searchForm: inSearch(el),
    };
    const o = {};
    for (const [k, v] of Object.entries(f)) {
      if (k === "options") {
        if (v.length) {
          o.options = v;
        }
        continue;
      }
      if (v === "" || v === false || v === null || v === 0) {
        continue;
      }
      o[k] = v;
    }
    fields.push(o);
  });
  const out = {
    url: location.href.split("?")[0],
    title: document.title,
    capturedAt: new Date().toISOString().slice(0, 10),
    fields,
  };
  console.log(JSON.stringify(out));
  return `${fields.length} fields. JSON はコンソールに出した`;
})();
