(() => {
  const data = window.DEBUG_ROUTE_DATA || { nodes: [], generated_at: "missing" };
  const nodes = data.nodes || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();
  const statuses = new Set();
  const routes = new Set();
  let selectedId = nodes[0]?.id || null;

  for (const node of nodes) {
    statuses.add(node.status || "todo");
    routes.add(node.route || "unclassified");
    const parentId = node.parent_id && byId.has(node.parent_id) ? node.parent_id : "__root__";
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(node);
  }

  const treeRoot = document.getElementById("treeRoot");
  const detailsPane = document.getElementById("detailsPane");
  const searchInput = document.getElementById("search");
  const statusFilter = document.getElementById("statusFilter");
  const routeFilter = document.getElementById("routeFilter");

  for (const status of Array.from(statuses).sort()) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  }

  for (const route of Array.from(routes).sort()) {
    const option = document.createElement("option");
    option.value = route;
    option.textContent = route;
    routeFilter.appendChild(option);
  }

  function textFor(node) {
    return [
      node.id,
      node.title,
      node.route,
      node.status,
      node.summary,
      JSON.stringify(node.metrics || {}),
      ...(node.code_refs || []).flatMap((ref) => [ref.label, ref.href]),
      ...(node.log_refs || []).flatMap((ref) => [ref.label, ref.href]),
      ...(node.tags || []),
    ].join(" ").toLowerCase();
  }

  function matchesSelf(node, query, status, route) {
    const statusOk = !status || node.status === status;
    const routeOk = !route || node.route === route;
    const queryOk = !query || textFor(node).includes(query);
    return statusOk && routeOk && queryOk;
  }

  function hasVisibleDescendant(node, query, status, route) {
    return (children.get(node.id) || []).some((child) => isVisible(child, query, status, route));
  }

  function isVisible(node, query, status, route) {
    return matchesSelf(node, query, status, route) || hasVisibleDescendant(node, query, status, route);
  }

  function shouldOpen(node, query, status, route) {
    if (!query && !status && !route) return node.status === "active" || node.status === "current";
    return hasVisibleDescendant(node, query, status, route);
  }

  function renderTree() {
    const query = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const route = routeFilter.value;
    const roots = children.get("__root__") || [];
    treeRoot.innerHTML = "";
    const list = renderList(roots, query, status, route, true);
    if (list.children.length) {
      treeRoot.appendChild(list);
    } else {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "没有匹配的路线节点";
      treeRoot.appendChild(empty);
    }
    renderDetails();
  }

  function renderList(items, query, status, route, isRoot = false) {
    const list = document.createElement("ul");
    list.className = isRoot ? "node-list root" : "node-list";
    for (const node of items) {
      if (!isVisible(node, query, status, route)) continue;
      const item = document.createElement("li");
      item.className = "node-item";
      item.appendChild(renderNode(node, query, status, route));
      list.appendChild(item);
    }
    return list;
  }

  function renderNode(node, query, status, route) {
    const nodeChildren = children.get(node.id) || [];
    const visibleChildren = nodeChildren.filter((child) => isVisible(child, query, status, route));
    const details = document.createElement("details");
    details.className = visibleChildren.length ? "has-children" : "no-children";
    details.open = shouldOpen(node, query, status, route);

    const summary = document.createElement("summary");
    if (!visibleChildren.length) {
      summary.addEventListener("click", (event) => {
        event.preventDefault();
      });
    }
    const card = document.createElement("div");
    card.className = `node-card status-${node.status || "todo"}`;
    card.dataset.nodeId = node.id;
    if (node.id === selectedId) card.classList.add("selected");
    card.addEventListener("click", () => {
      selectedId = node.id;
      updateSelection();
      renderDetails();
    });

    const head = document.createElement("div");
    head.className = "node-head";
    const title = document.createElement("span");
    title.className = "node-title";
    title.textContent = node.title || node.id;
    const count = document.createElement("span");
    count.className = "child-count";
    count.textContent = visibleChildren.length ? `${visibleChildren.length} 子路线` : "末端节点";
    head.append(title, count);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span class="badge">${node.status || "todo"}</span> ${escapeHtml(node.route || "unclassified")}`;

    const summaryText = document.createElement("div");
    summaryText.className = "node-summary";
    summaryText.textContent = node.summary || "";

    card.append(head, meta, summaryText);
    summary.appendChild(card);
    details.appendChild(summary);

    if (visibleChildren.length) {
      details.appendChild(renderList(visibleChildren, query, status, route));
    }
    return details;
  }

  function updateSelection() {
    for (const card of treeRoot.querySelectorAll(".node-card")) {
      card.classList.toggle("selected", card.dataset.nodeId === selectedId);
    }
  }

  function renderDetails() {
    const node = byId.get(selectedId);
    if (!node) return;
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    const links = node.links || [];
    const tags = node.tags || [];
    const metrics = node.metrics || {};
    const codeRefs = node.code_refs || [];
    const logRefs = node.log_refs || [];
    const path = pathFor(node);
    detailsPane.innerHTML = `
      <h2>${escapeHtml(node.title || node.id)}</h2>
      <div class="path"><strong>当前路径:</strong> ${path.map((item) => `<span>${escapeHtml(item.title || item.id)}</span>`).join(" / ")}</div>
      <p><strong>状态:</strong> ${escapeHtml(node.status || "todo")}</p>
      <p><strong>路线:</strong> ${escapeHtml(node.route || "unclassified")}</p>
      ${parent ? `<p><strong>父路线:</strong> ${escapeHtml(parent.title || parent.id)}</p>` : ""}
      ${node.created_at ? `<p><strong>记录时间:</strong> ${escapeHtml(node.created_at)}</p>` : ""}
      <p>${escapeHtml(node.summary || "")}</p>
      ${tags.length ? `<p><strong>标签:</strong> ${tags.map(escapeHtml).join(", ")}</p>` : ""}
      ${Object.keys(metrics).length ? `<h2>指标</h2><dl class="kv-list">${Object.entries(metrics).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(formatValue(value))}</dd></div>`).join("")}</dl>` : ""}
      ${links.length ? `<h2>链接</h2><ul>${links.map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label || link.href)}</a></li>`).join("")}</ul>` : ""}
      ${codeRefs.length ? `<h2>代码引用</h2><ul>${codeRefs.map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label || link.href)}</a></li>`).join("")}</ul>` : ""}
      ${logRefs.length ? `<h2>日志引用</h2><ul>${logRefs.map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label || link.href)}</a></li>`).join("")}</ul>` : ""}
      <h2>维护命令</h2>
      <p><code>python3 add_debug_event.py --id ${escapeHtml(node.id)}-next --parent ${escapeHtml(node.id)} --title "New trial" --status current --route ${escapeHtml(node.route || "unclassified")} --summary "Purpose, result, conclusion"</code></p>
      <p class="meta">数据生成时间: ${escapeHtml(data.generated_at || "unknown")}；事件数: ${data.event_count || 0}；节点数: ${data.node_count || nodes.length}</p>
    `;
  }

  function setAll(open) {
    for (const details of treeRoot.querySelectorAll("details")) {
      details.open = open;
    }
  }

  function pathFor(node) {
    const path = [];
    let current = node;
    while (current) {
      path.unshift(current);
      current = current.parent_id ? byId.get(current.parent_id) : null;
    }
    return path;
  }

  function focusSelectedPath() {
    const node = byId.get(selectedId);
    if (!node) return;
    const pathIds = new Set(pathFor(node).map((item) => item.id));
    for (const details of treeRoot.querySelectorAll("details")) {
      const summary = details.firstElementChild;
      const card = summary ? summary.querySelector(".node-card") : null;
      details.open = card ? pathIds.has(card.dataset.nodeId) : false;
    }
    const selectedCard = treeRoot.querySelector(".node-card.selected");
    if (selectedCard) {
      selectedCard.scrollIntoView({ block: "center", behavior: "smooth" });
    }
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

  function formatValue(value) {
    return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  }

  searchInput.addEventListener("input", renderTree);
  statusFilter.addEventListener("change", renderTree);
  routeFilter.addEventListener("change", renderTree);
  document.getElementById("resetFilters").addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "";
    routeFilter.value = "";
    renderTree();
  });
  document.getElementById("expandAll").addEventListener("click", () => setAll(true));
  document.getElementById("collapseAll").addEventListener("click", () => setAll(false));
  document.getElementById("focusSelected").addEventListener("click", focusSelectedPath);

  renderTree();
})();
