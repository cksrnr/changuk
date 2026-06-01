/* MOCK-UP UNIT 제작 리스트 뷰어
 * 원본 엑셀(97211139-251110_MOCKUP_TEST_R1.xls)에서 추출한 window.MOCKUP 을 렌더링.
 * 데이터는 표시 전용이며 값은 가공/추론하지 않는다(반올림 표시만 적용). */

(() => {
  "use strict";
  const D = window.MOCKUP;
  const $ = (s, el = document) => el.querySelector(s);
  const sidebar = $("#sidebar");
  const content = $("#content");

  // ---- 숫자 표기 ----
  const num = (v, dp = 3) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString("ko-KR", { maximumFractionDigits: dp });
  };
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );

  // ---- 문서 헤더 ----
  $("#projTitle").textContent = (D.units[0] && D.units[0]["현장명"]) || D.title;
  $("#docMeta").textContent =
    `${D.title}  ·  제품 ${D.summary.length}종 / 총수량 ${D.totals ? D.totals.qty : ""} EA / 총중량 ${num(D.totals ? D.totals.wt : "", 1)} kg`;

  // ---- 사이드바 ----
  function buildSidebar() {
    let h = `<div class="nav-group-title">개요</div>`;
    h += navItem("summary", "📋 전체 요약", "");
    h += navItem("drawing", "📐 도면 (MU-U-01)", "");
    h += `<div class="nav-group-title">단위제품 (${D.units.length})</div>`;
    D.units.forEach((u, i) => {
      h += navItem("unit-" + i, u["제품번호"] || u.sheet, u.materials.length + "건");
    });
    h += `<div class="nav-group-title">참조</div>`;
    h += navItem("shapes", "🔖 Shape Code", D.shapes.length + "종");
    sidebar.innerHTML = h;
    sidebar.addEventListener("click", (e) => {
      const it = e.target.closest(".nav-item");
      if (it) route(it.dataset.key);
    });
  }
  function navItem(key, label, cnt) {
    return `<div class="nav-item" data-key="${key}"><span>${esc(label)}</span><span class="cnt">${esc(cnt)}</span></div>`;
  }
  function setActive(key) {
    sidebar.querySelectorAll(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.key === key)
    );
  }

  // ---- 라우팅 ----
  function route(key) {
    setActive(key);
    if (key === "summary") return renderSummary();
    if (key === "drawing") return renderDrawing();
    if (key === "shapes") return renderShapes();
    if (key.startsWith("unit-")) return renderUnit(+key.slice(5));
  }

  // ---- 전체 요약 ----
  function renderSummary() {
    const t = D.totals || {};
    let rows = D.summary
      .map(
        (s, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><a href="#" data-goto="${s.prod}">${esc(s.prod)}</a></td>
        <td class="num">${num(s.wt)}</td>
        <td class="num">${esc(s.qty)}</td>
        <td>${esc(s.note)}</td></tr>`
      )
      .join("");
    content.innerHTML = `
      <h2 class="sec">전체 요약</h2>
      <p class="note">아래는 본 Mock-up 제작 물량의 전체 요약입니다. 제품번호를 클릭하면 단위제품 상세로 이동합니다.</p>
      <div class="summary-cards">
        <div class="card"><div class="lbl">제품 종류</div><div class="val">${D.summary.length}</div><div class="unit">종</div></div>
        <div class="card"><div class="lbl">총 수량</div><div class="val">${esc(t.qty)}</div><div class="unit">EA</div></div>
        <div class="card"><div class="lbl">총 중량</div><div class="val">${num(t.wt, 1)}</div><div class="unit">kg</div></div>
      </div>
      <div class="table-wrap"><table class="grid">
        <thead><tr><th class="num">No</th><th>제품번호</th><th class="num">중량(kg)</th><th class="num">수량(EA)</th><th>비고</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td></td><td>총 합계</td><td class="num">${num(t.wt, 1)}</td><td class="num">${esc(t.qty)}</td><td></td></tr></tfoot>
      </table></div>`;
    content.querySelectorAll("a[data-goto]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const idx = D.units.findIndex((u) => u["제품번호"] === a.dataset.goto);
        if (idx >= 0) route("unit-" + idx);
      })
    );
  }

  // ---- 단위제품 상세 ----
  const MAT_COLS = [
    { k: "no", t: "No", num: true },
    { k: "code", t: "자재코드" },
    { k: "type", t: "종류" },
    { k: "alloy", t: "품명(합금)" },
    { k: "surface", t: "표면처리" },
    { k: "cut", t: "절단길이(mm)", num: true },
    { k: "qty", t: "수량", num: true },
    { k: "dwg", t: "가공도번" },
    { k: "color", t: "COLOR" },
    { k: "unitwt", t: "단중(kg/m)", num: true },
    { k: "wt", t: "환산량(kg)", num: true },
    { k: "totqty", t: "단위수량", num: true },
    { k: "totwt", t: "합계중량(kg)", num: true },
    { k: "note", t: "비고" },
  ];

  let sortState = { col: null, dir: 1 };

  function renderUnit(idx) {
    const u = D.units[idx];
    if (!u) return;
    const info = [
      ["현장명", u["현장명"]],
      ["제품번호", u["제품번호"]],
      ["SIZE (W×H)", `${esc(u.W)} × ${esc(u.H)}`],
      ["제품중량", num(u["제품중량"], 3) + " kg"],
      ["수량", esc(u["수량"]) + " EA"],
      ["발주유형", u["발주유형"]],
      ["창호번호", u["창호번호"]],
      ["작성일", u["작성일"]],
      ["비고", u["비고"]],
    ];
    const infoHtml = info
      .map(
        ([k, v]) =>
          `<div class="info-cell"><div class="k">${esc(k)}</div><div class="v">${typeof v === "string" && v.includes("<") ? v : esc(v)}</div></div>`
      )
      .join("");

    sortState = { col: null, dir: 1 };

    content.innerHTML = `
      <h2 class="sec">${esc(u["제품번호"] || u.sheet)} <span class="note">— 단위제품 리스트</span></h2>
      <div class="info-grid">${infoHtml}</div>

      <h3 class="sec">원자재 정보 (${u.materials.length}건)</h3>
      <div class="tablebar">
        <input type="search" id="matSearch" placeholder="이 제품 내 자재 검색…" />
        <span class="count" id="matCount"></span>
      </div>
      <div class="table-wrap"><table class="grid" id="matTable">
        <thead><tr>${MAT_COLS.map(
          (c, i) =>
            `<th class="${c.num ? "num" : ""}" data-col="${i}">${esc(c.t)}<span class="arrow"></span></th>`
        ).join("")}</tr></thead>
        <tbody></tbody>
        <tfoot></tfoot>
      </table></div>
      ${renderAccessories(u)}
    `;

    const tbody = $("#matTable tbody", content);
    const tfoot = $("#matTable tfoot", content);
    const search = $("#matSearch", content);
    const countEl = $("#matCount", content);

    function draw() {
      const q = (search.value || "").trim().toLowerCase();
      let rows = u.materials.slice();
      if (q)
        rows = rows.filter((m) =>
          [m.code, m.type, m.alloy, m.surface, m.dwg, m.color, m.note]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      if (sortState.col !== null) {
        const key = MAT_COLS[sortState.col].k;
        const isNum = MAT_COLS[sortState.col].num;
        rows.sort((a, b) => {
          let x = a[key], y = b[key];
          if (isNum) { x = Number(x) || 0; y = Number(y) || 0; return (x - y) * sortState.dir; }
          return String(x).localeCompare(String(y), "ko") * sortState.dir;
        });
      }
      tbody.innerHTML = rows
        .map(
          (m) =>
            "<tr>" +
            MAT_COLS.map((c) => {
              let val = m[c.k];
              if (c.num && c.k !== "no" && c.k !== "qty" && c.k !== "totqty")
                val = num(val);
              let cell = esc(val);
              if (q && !c.num && cell) {
                const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
                cell = cell.replace(re, "<mark>$1</mark>");
              }
              return `<td class="${c.num ? "num" : ""}">${cell}</td>`;
            }).join("") +
            "</tr>"
        )
        .join("");
      const sumWt = rows.reduce((s, m) => s + (Number(m.totwt) || 0), 0);
      const sumQty = rows.reduce((s, m) => s + (Number(m.totqty) || 0), 0);
      tfoot.innerHTML = `<tr>
        <td colspan="11">합계 (표시 ${rows.length}건)</td>
        <td class="num">${num(sumQty, 0)}</td>
        <td class="num">${num(sumWt)}</td><td></td></tr>`;
      countEl.textContent = `${rows.length} / ${u.materials.length} 건`;
    }

    $("#matTable thead", content).addEventListener("click", (e) => {
      const th = e.target.closest("th");
      if (!th) return;
      const col = +th.dataset.col;
      sortState.dir = sortState.col === col ? -sortState.dir : 1;
      sortState.col = col;
      $$("#matTable th .arrow", content).forEach((a) => (a.textContent = ""));
      th.querySelector(".arrow").textContent = sortState.dir > 0 ? " ▲" : " ▼";
      draw();
    });
    search.addEventListener("input", draw);
    draw();
  }

  function renderAccessories(u) {
    if (!u.accessories || !u.accessories.length) return "";
    const rows = u.accessories
      .map(
        (a) =>
          `<tr><td class="num">${esc(a.no)}</td><td>${esc(a.name)}</td><td>${esc(a.spec)}</td><td class="num">${esc(a.qty)}</td></tr>`
      )
      .join("");
    return `<h3 class="sec">부속·기타 자재 (${u.accessories.length}건)</h3>
      <div class="table-wrap"><table class="grid">
      <thead><tr><th class="num">No</th><th>품명</th><th>규격</th><th class="num">수량</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  // ---- Shape Code ----
  function renderShapes() {
    const rows = [];
    D.shapes.forEach((s) => {
      const span = Math.max(1, s.rows.length);
      s.rows.forEach((r, i) => {
        rows.push(
          "<tr>" +
            (i === 0
              ? `<td rowspan="${span}">${esc(s.shape)}</td>
                 <td rowspan="${span}">${esc(s.name)}</td>
                 <td rowspan="${span}">${esc(s.alloy)}</td>
                 <td rowspan="${span}">${esc(s.mf)}</td>
                 <td rowspan="${span}" class="num">${num(s.unitwt)}</td>
                 <td rowspan="${span}">${esc(s.color)}</td>`
              : "") +
            `<td>${esc(r.dwg)}</td><td class="num">${num(r.cut, 1)}</td>
             <td class="num">${num(r.md, 1)}</td><td>${esc(r.tolLT)}</td><td>${esc(r.tolRB)}</td></tr>`
        );
      });
      if (!s.rows.length) {
        rows.push(
          `<tr><td>${esc(s.shape)}</td><td>${esc(s.name)}</td><td>${esc(s.alloy)}</td><td>${esc(s.mf)}</td><td class="num">${num(s.unitwt)}</td><td>${esc(s.color)}</td><td colspan="5"></td></tr>`
        );
      }
    });
    content.innerHTML = `
      <h2 class="sec">Shape Code (형상 코드 ${D.shapes.length}종)</h2>
      <p class="note">각 형상(Shape)별 가공번호·절단길이·M.D·공차 정보입니다. 검색으로 좁혀보세요.</p>
      <div class="tablebar"><input type="search" id="shSearch" placeholder="Shape no·품명·가공번호 검색…" /><span class="count" id="shCount"></span></div>
      <div class="table-wrap"><table class="grid" id="shTable">
        <thead><tr><th>Shape no</th><th>품명</th><th>합금</th><th>M/F·표면</th><th class="num">단중(kg/m)</th><th>COLOR</th>
        <th>가공번호</th><th class="num">절단길이</th><th class="num">M.D</th><th>공차(좌/상)</th><th>공차(우/하)</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table></div>`;
    const tbody = $("#shTable tbody", content);
    const all = Array.from(tbody.children);
    const search = $("#shSearch", content);
    const countEl = $("#shCount", content);
    function draw() {
      const q = (search.value || "").trim().toLowerCase();
      let shown = 0;
      // 검색 시 rowspan 처리가 복잡하므로 단순 텍스트 포함 행만 표시
      all.forEach((tr) => {
        const match = !q || tr.textContent.toLowerCase().includes(q);
        tr.style.display = match ? "" : "none";
        if (match) shown++;
      });
      countEl.textContent = `${shown} 행`;
    }
    search.addEventListener("input", draw);
    draw();
  }

  // ---- 도면 ----
  function renderDrawing() {
    content.innerHTML = `
      <h2 class="sec">생산 도면 — MU-U-01 (Production Elevation)</h2>
      <p class="note">현장: SK 영등포 양평동4가 1-1 · VIEW FROM OUTSIDE · 수량 2SET · Draft by CK.JUNG (2025.10.17)</p>
      <div class="drawing-wrap"><img src="MU-U-01.png" alt="MU-U-01 Production Elevation 도면" /></div>`;
  }

  // ---- 전역 검색 ----
  $("#globalSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return route("summary");
    const hits = [];
    D.units.forEach((u, i) => {
      u.materials.forEach((m) => {
        if (
          [m.code, m.type, m.alloy, m.surface, m.dwg, m.note]
            .join(" ").toLowerCase().includes(q)
        )
          hits.push({ u: u["제품번호"], i, m });
      });
    });
    setActive("");
    content.innerHTML = `
      <h2 class="sec">전체 검색 결과 “${esc(q)}” <span class="note">— ${hits.length}건</span></h2>
      <div class="table-wrap"><table class="grid">
        <thead><tr><th>제품번호</th><th>자재코드</th><th>종류</th><th>품명</th><th class="num">절단길이</th><th class="num">수량</th><th>가공도번</th></tr></thead>
        <tbody>${hits
          .map(
            (h) =>
              `<tr><td><a href="#" data-i="${h.i}">${esc(h.u)}</a></td><td>${esc(h.m.code)}</td><td>${esc(h.m.type)}</td><td>${esc(h.m.alloy)}</td><td class="num">${num(h.m.cut, 1)}</td><td class="num">${esc(h.m.qty)}</td><td>${esc(h.m.dwg)}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>`;
    content.querySelectorAll("a[data-i]").forEach((a) =>
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        $("#globalSearch").value = "";
        route("unit-" + a.dataset.i);
      })
    );
  });

  $("#printBtn").addEventListener("click", () => window.print());

  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---- 시작 ----
  buildSidebar();
  route("summary");
})();
