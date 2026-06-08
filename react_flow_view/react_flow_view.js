(() => {
  const data = window.DEBUG_ROUTE_DATA || { nodes: [], edges: [], generated_at: "missing" };
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();
  const statusStyles = data.status_styles || {};
  const nodeWidth = 260;
  const nodeHeight = 92;
  const state = {
    selectedId: nodes[0]?.id || null,
    visibleIds: new Set(nodes.map((node) => node.id)),
    positions: new Map(),
    width: 1200,
    height: 800,
    zoom: 1,
    pan: { x: 72, y: 56 },
    dragging: null,
    panning: null,
  };

  for (const node of nodes) {
    const parentId = node.parent_id && byId.has(node.parent_id) ? node.parent_id : "__root__";
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(node);
  }

  for (const items of children.values()) {
    items.sort((a, b) => (a._order || 0) - (b._order || 0));
  }

  const els = {
    graphSummary: document.getElementById("graphSummary"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    routeFilter: document.getElementById("routeFilter"),
    subtreeFilter: document.getElementById("subtreeFilter"),
    selectedPathOnly: document.getElementById("selectedPathOnly"),
    resetFilters: document.getElementById("resetFilters"),
    fitView: document.getElementById("fitView"),
    graphViewport: document.getElementById("graphViewport"),
    graphContent: document.getElementById("graphContent"),
    edgeLayer: document.getElementById("edgeLayer"),
    nodeLayer: document.getElementById("nodeLayer"),
    miniMap: document.getElementById("miniMap"),
    detailsPane: document.getElementById("detailsPane"),
    legend: document.getElementById("legend"),
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    resetView: document.getElementById("resetView"),
  };

  function init() {
    fillFilters();
    renderLegend();
    bindEvents();
    renderAll();
    requestAnimationFrame(fitGraph);
  }

  function fillFilters() {
    const statuses = Array.from(new Set(nodes.map((node) => node.status || "todo"))).sort();
    const routes = Array.from(new Set(nodes.map((node) => node.route || "unclassified"))).sort();
    for (const status of statuses) {
      els.statusFilter.append(new Option(status, status));
    }
    for (const route of routes) {
      els.routeFilter.append(new Option(route, route));
    }
    for (const node of nodes) {
      const prefix = "  ".repeat(Math.min(node.depth || 0, 6));
      els.subtreeFilter.append(new Option(`${prefix}${node.title || node.id}`, node.id));
    }
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", renderAll);
    els.statusFilter.addEventListener("change", renderAll);
    els.routeFilter.addEventListener("change", renderAll);
    els.subtreeFilter.addEventListener("change", renderAll);
    els.selectedPathOnly.addEventListener("change", renderAll);
    els.resetFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.statusFilter.value = "";
      els.routeFilter.value = "";
      els.subtreeFilter.value = "";
      els.selectedPathOnly.checked = false;
      renderAll();
      fitGraph();
    });
    els.fitView.addEventListener("click", fitGraph);
    els.zoomIn.addEventListener("click", () => setZoom(state.zoom * 1.18));
    els.zoomOut.addEventListener("click", () => setZoom(state.zoom / 1.18));
    els.resetView.addEventListener("click", () => {
      state.zoom = 1;
      state.pan = { x: 72, y: 56 };
      applyTransform();
      renderMiniMap();
    });

    els.graphViewport.addEventListener("pointerdown", startPan);
    els.graphViewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopPointerActions);
    window.addEventListener("resize", renderMiniMap);
  }

  function renderAll() {
    state.visibleIds = computeVisibleIds();
    if (state.selectedId && !state.visibleIds.has(state.selectedId)) {
      state.selectedId = Array.from(state.visibleIds)[0] || null;
    }
    layoutVisibleNodes();
    renderGraph();
    renderDetails();
    renderSummary();
    applyTransform();
    renderMiniMap();
  }

  function computeVisibleIds() {
    const query = els.searchInput.value.trim().toLowerCase();
    const status = els.statusFilter.value;
    const route = els.routeFilter.value;
    const hasMainFilter = Boolean(query || status || route);
    let visible = new Set();

    if (!hasMainFilter) {
      visible = new Set(nodes.map((node) => node.id));
    } else {
      for (const node of nodes) {
        if (matchesNode(node, query, status, route)) {
          visible.add(node.id);
          for (const ancestor of ancestorsFor(node)) {
            visible.add(ancestor.id);
          }
        }
      }
    }

    const subtreeId = els.subtreeFilter.value;
    if (subtreeId) {
      visible = intersect(visible, descendantsFor(subtreeId));
    }

    if (els.selectedPathOnly.checked && state.selectedId) {
      visible = intersect(visible, pathIdsFor(state.selectedId));
    }

    return visible;
  }

  function matchesNode(node, query, status, route) {
    if (status && node.status !== status) return false;
    if (route && node.route !== route) return false;
    if (!query) return true;
    return textFor(node).includes(query);
  }

  function textFor(node) {
    return [
      node.id,
      node.title,
      node.route,
      node.status,
      node.summary,
      JSON.stringify(node.metrics || {}),
      ...(node.tags || []),
      ...(node.links || []).flatMap((ref) => [ref.label, ref.href]),
      ...(node.code_refs || []).flatMap((ref) => [ref.label, ref.href]),
      ...(node.log_refs || []).flatMap((ref) => [ref.label, ref.href]),
    ].join(" ").toLowerCase();
  }

  function layoutVisibleNodes() {
    const roots = nodes.filter((node) => state.visibleIds.has(node.id) && !state.visibleIds.has(node.parent_id));
    const visibleChildren = (node) => (children.get(node.id) || []).filter((child) => state.visibleIds.has(child.id));
    let cursorY = 36;
    let maxX = 0;
    let maxY = 0;
    state.positions = new Map();

    function place(node, depth) {
      const nodeChildren = visibleChildren(node);
      const x = 36 + depth * 320;
      let y;
      if (!nodeChildren.length) {
        y = cursorY;
        cursorY += 126;
      } else {
        for (const child of nodeChildren) {
          place(child, depth + 1);
        }
        const first = state.positions.get(nodeChildren[0].id);
        const last = state.positions.get(nodeChildren[nodeChildren.length - 1].id);
        y = first && last ? (first.y + last.y) / 2 : cursorY;
      }
      state.positions.set(node.id, { x, y });
      maxX = Math.max(maxX, x + nodeWidth + 60);
      maxY = Math.max(maxY, y + nodeHeight + 60);
    }

    for (const root of roots) {
      place(root, 0);
      cursorY += 28;
    }

    state.width = Math.max(maxX, 900);
    state.height = Math.max(maxY, 600);
  }

  function renderGraph() {
    els.nodeLayer.innerHTML = "";
    els.edgeLayer.innerHTML = "";
    els.graphContent.style.width = `${state.width}px`;
    els.graphContent.style.height = `${state.height}px`;
    els.edgeLayer.setAttribute("width", state.width);
    els.edgeLayer.setAttribute("height", state.height);
    els.edgeLayer.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);

    if (!state.visibleIds.size) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "没有匹配的调试路线节点";
      els.nodeLayer.append(empty);
      return;
    }

    renderEdges();

    for (const node of nodes) {
      if (!state.visibleIds.has(node.id)) continue;
      const position = state.positions.get(node.id);
      if (!position) continue;
      const element = document.createElement("article");
      element.className = `graph-node status-${node.status || "todo"}`;
      if (node.id === state.selectedId) element.classList.add("selected");
      element.dataset.nodeId = node.id;
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
      element.style.setProperty("--node-color", colorFor(node.status));
      element.innerHTML = `
        <h2 class="node-title">${escapeHtml(node.title || node.id)}</h2>
        <p class="node-summary">${escapeHtml(node.summary || "")}</p>
        <div class="node-meta">
          <span class="status-pill">${escapeHtml(node.status || "todo")}</span>
          <span class="route-text">${escapeHtml(node.route || "unclassified")}</span>
        </div>
      `;
      element.addEventListener("click", () => selectNode(node.id));
      element.addEventListener("pointerdown", (event) => startNodeDrag(event, node.id));
      els.nodeLayer.append(element);
    }
  }

  function renderEdges() {
    els.edgeLayer.innerHTML = "";
    const selectedPath = state.selectedId ? pathIdsFor(state.selectedId) : new Set();
    for (const edge of edges) {
      if (!state.visibleIds.has(edge.source) || !state.visibleIds.has(edge.target)) continue;
      const source = state.positions.get(edge.source);
      const target = state.positions.get(edge.target);
      if (!source || !target) continue;
      const sx = source.x + nodeWidth;
      const sy = source.y + nodeHeight / 2;
      const tx = target.x;
      const ty = target.y + nodeHeight / 2;
      const bend = Math.max(70, (tx - sx) * 0.45);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const inSelectedPath = selectedPath.has(edge.source) && selectedPath.has(edge.target);
      path.setAttribute("class", inSelectedPath ? "edge-path selected-path" : "edge-path");
      path.setAttribute("d", `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`);
      els.edgeLayer.append(path);
    }
  }

  function selectNode(nodeId) {
    state.selectedId = nodeId;
    for (const element of els.nodeLayer.querySelectorAll(".graph-node")) {
      element.classList.toggle("selected", element.dataset.nodeId === nodeId);
    }
    renderDetails();
    if (els.selectedPathOnly.checked) renderAll();
  }

  function renderDetails() {
    const node = state.selectedId ? byId.get(state.selectedId) : null;
    if (!node) {
      els.detailsPane.innerHTML = "<h2>没有节点</h2><p>当前过滤条件下没有可显示节点。</p>";
      return;
    }
    const path = pathFor(node);
    const metrics = node.metrics || {};
    els.detailsPane.innerHTML = `
      <h2>${escapeHtml(node.title || node.id)}</h2>
      <div class="path-line">${path.map((item) => `<span>${escapeHtml(item.title || item.id)}</span>`).join("")}</div>
      <dl class="kv-list">
        <div><dt>ID</dt><dd>${escapeHtml(node.id)}</dd></div>
        <div><dt>状态</dt><dd>${escapeHtml(node.status || "todo")}</dd></div>
        <div><dt>路线</dt><dd>${escapeHtml(node.route || "unclassified")}</dd></div>
        ${node.created_at ? `<div><dt>时间</dt><dd>${escapeHtml(node.created_at)}</dd></div>` : ""}
      </dl>
      <p>${escapeHtml(node.summary || "")}</p>
      ${node.tags?.length ? `<h3>标签</h3><p>${node.tags.map(escapeHtml).join(", ")}</p>` : ""}
      ${Object.keys(metrics).length ? `<h3>指标</h3>${renderKeyValues(metrics)}` : ""}
      ${renderRefList("链接", node.links)}
      ${renderRefList("代码引用", node.code_refs)}
      ${renderRefList("日志引用", node.log_refs)}
      <h3>维护命令</h3>
      <p><code>python3 add_debug_event.py --id ${escapeHtml(node.id)}-next --parent ${escapeHtml(node.id)} --title "新尝试" --status current --route ${escapeHtml(node.route || "unclassified")} --summary "结论"</code></p>
    `;
  }

  function renderSummary() {
    els.graphSummary.textContent = `数据生成 ${data.generated_at || "unknown"}；显示 ${state.visibleIds.size}/${nodes.length} 个节点；${edges.length} 条边；schema ${data.schema_version || "1.x"}`;
  }

  function renderLegend() {
    const statuses = Array.from(new Set(nodes.map((node) => node.status || "todo"))).sort();
    els.legend.innerHTML = "";
    for (const status of statuses) {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `<span class="legend-dot"></span><span>${escapeHtml(status)}</span>`;
      row.querySelector(".legend-dot").style.setProperty("--dot-color", colorFor(status));
      els.legend.append(row);
    }
  }

  function renderMiniMap() {
    const width = 180;
    const height = 120;
    const pad = 10;
    const scale = Math.min((width - pad * 2) / state.width, (height - pad * 2) / state.height);
    const rect = els.graphViewport.getBoundingClientRect();
    els.miniMap.setAttribute("viewBox", `0 0 ${width} ${height}`);
    els.miniMap.innerHTML = "";

    for (const nodeId of state.visibleIds) {
      const node = byId.get(nodeId);
      const pos = state.positions.get(nodeId);
      if (!node || !pos) continue;
      const item = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      item.setAttribute("x", pad + pos.x * scale);
      item.setAttribute("y", pad + pos.y * scale);
      item.setAttribute("width", Math.max(4, nodeWidth * scale));
      item.setAttribute("height", Math.max(3, nodeHeight * scale));
      item.setAttribute("rx", 2);
      item.setAttribute("fill", colorFor(node.status));
      item.setAttribute("opacity", node.id === state.selectedId ? "0.9" : "0.5");
      els.miniMap.append(item);
    }

    const viewX = -state.pan.x / state.zoom;
    const viewY = -state.pan.y / state.zoom;
    const viewWidth = rect.width / state.zoom;
    const viewHeight = rect.height / state.zoom;
    const viewport = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    viewport.setAttribute("x", pad + viewX * scale);
    viewport.setAttribute("y", pad + viewY * scale);
    viewport.setAttribute("width", Math.max(6, viewWidth * scale));
    viewport.setAttribute("height", Math.max(6, viewHeight * scale));
    viewport.setAttribute("fill", "none");
    viewport.setAttribute("stroke", "#111827");
    viewport.setAttribute("stroke-width", "1.5");
    els.miniMap.append(viewport);
  }

  function startNodeDrag(event, nodeId) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const pos = state.positions.get(nodeId);
    if (!pos) return;
    state.dragging = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startPan(event) {
    if (event.button !== 0 || event.target.closest(".graph-node")) return;
    state.panning = {
      startX: event.clientX,
      startY: event.clientY,
      originX: state.pan.x,
      originY: state.pan.y,
    };
    els.graphViewport.classList.add("panning");
  }

  function onPointerMove(event) {
    if (state.dragging) {
      const drag = state.dragging;
      const dx = (event.clientX - drag.startX) / state.zoom;
      const dy = (event.clientY - drag.startY) / state.zoom;
      drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 2;
      const next = { x: drag.originX + dx, y: drag.originY + dy };
      state.positions.set(drag.nodeId, next);
      const element = els.nodeLayer.querySelector(`[data-node-id="${cssEscape(drag.nodeId)}"]`);
      if (element) {
        element.style.left = `${next.x}px`;
        element.style.top = `${next.y}px`;
      }
      renderEdges();
      renderMiniMap();
      return;
    }
    if (state.panning) {
      const pan = state.panning;
      state.pan = {
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      };
      applyTransform();
      renderMiniMap();
    }
  }

  function stopPointerActions() {
    state.dragging = null;
    state.panning = null;
    els.graphViewport.classList.remove("panning");
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = els.graphViewport.getBoundingClientRect();
    const before = {
      x: (event.clientX - rect.left - state.pan.x) / state.zoom,
      y: (event.clientY - rect.top - state.pan.y) / state.zoom,
    };
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    state.zoom = clamp(state.zoom * factor, 0.22, 2.4);
    state.pan = {
      x: event.clientX - rect.left - before.x * state.zoom,
      y: event.clientY - rect.top - before.y * state.zoom,
    };
    applyTransform();
    renderMiniMap();
  }

  function setZoom(nextZoom) {
    state.zoom = clamp(nextZoom, 0.22, 2.4);
    applyTransform();
    renderMiniMap();
  }

  function fitGraph() {
    const rect = els.graphViewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const zoom = clamp(Math.min((rect.width - 96) / state.width, (rect.height - 76) / state.height), 0.22, 1.35);
    state.zoom = zoom;
    state.pan = {
      x: Math.max(36, (rect.width - state.width * zoom) / 2),
      y: Math.max(30, (rect.height - state.height * zoom) / 2),
    };
    applyTransform();
    renderMiniMap();
  }

  function applyTransform() {
    els.graphContent.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
  }

  function colorFor(status) {
    const style = statusStyles[status] || {};
    const cssValue = getComputedStyle(document.documentElement).getPropertyValue(`--${status}`).trim();
    return style.color || cssValue || "#64748b";
  }

  function ancestorsFor(node) {
    const ancestors = [];
    let parentId = node.parent_id;
    const seen = new Set([node.id]);
    while (parentId && byId.has(parentId) && !seen.has(parentId)) {
      const parent = byId.get(parentId);
      ancestors.push(parent);
      seen.add(parentId);
      parentId = parent.parent_id;
    }
    return ancestors;
  }

  function descendantsFor(nodeId) {
    const ids = new Set();
    function visit(id) {
      ids.add(id);
      for (const child of children.get(id) || []) {
        visit(child.id);
      }
    }
    if (byId.has(nodeId)) visit(nodeId);
    return ids;
  }

  function pathIdsFor(nodeId) {
    const node = byId.get(nodeId);
    if (!node) return new Set();
    return new Set(pathFor(node).map((item) => item.id));
  }

  function pathFor(node) {
    const path = [];
    let current = node;
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : null;
    }
    return path;
  }

  function intersect(left, right) {
    return new Set(Array.from(left).filter((id) => right.has(id)));
  }

  function renderKeyValues(values) {
    return `<dl class="kv-list">${Object.entries(values).map(([key, value]) => `
      <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(formatValue(value))}</dd></div>
    `).join("")}</dl>`;
  }

  function renderRefList(title, refs) {
    if (!refs || !refs.length) return "";
    return `<h3>${escapeHtml(title)}</h3><ul>${refs.map((ref) => `
      <li><a href="${escapeAttr(ref.href)}">${escapeHtml(ref.label || ref.href)}</a></li>
    `).join("")}</ul>`;
  }

  function formatValue(value) {
    return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  init();
})();
