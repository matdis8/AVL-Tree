/* ───────────── Utils & State ───────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

const svgEl = (tag, attrs) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// Global state for UI
let state = {
  scale: 1,
  totalRotations: 0,
  isAnimating: false // To prevent parallel conflicting animations
};

/* ───────────── AVL Tree Engine ───────────── */
class Node {
  constructor(v) { 
    this.val = v; 
    this.left = null; 
    this.right = null; 
    this.h = 1;
  }
}

class AVLTree {
  constructor() {
    this.root = null;
  }

  hgt(n) { return n ? n.h : 0; }
  bf(n)  { return n ? this.hgt(n.left) - this.hgt(n.right) : 0; }
  upH(n) { if (n) n.h = 1 + Math.max(this.hgt(n.left), this.hgt(n.right)); }

  rotR(y) {
    const x = y.left, T2 = x.right;
    x.right = y; y.left = T2;
    this.upH(y); this.upH(x);
    state.totalRotations++;
    addLog(`Rotasi Kanan pada node ${y.val}`, 'rot');
    return x;
  }

  rotL(x) {
    const y = x.right, T2 = y.left;
    y.left = x; x.right = T2;
    this.upH(x); this.upH(y);
    state.totalRotations++;
    addLog(`Rotasi Kiri pada node ${x.val}`, 'rot');
    return y;
  }

  balance(n) {
    this.upH(n);
    const b = this.bf(n);
    if (b > 1) { 
      if (this.bf(n.left) < 0) { 
        n.left = this.rotL(n.left); 
        addLog('  → LR case: rotasi kiri pada anak kiri', 'rot'); 
      } 
      return this.rotR(n); 
    }
    if (b < -1) { 
      if (this.bf(n.right) > 0) { 
        n.right = this.rotR(n.right); 
        addLog('  → RL case: rotasi kanan pada anak kanan', 'rot'); 
      } 
      return this.rotL(n); 
    }
    return n;
  }

  insert(n, v) {
    if (!n) return new Node(v);
    if (v < n.val) n.left = this.insert(n.left, v);
    else if (v > n.val) n.right = this.insert(n.right, v);
    else {
      // Duplicate found - do nothing
      addLog(`Nilai ${v} sudah ada dalam pohon. Duplikat diabaikan.`, 'err');
      return n;
    }
    return this.balance(n);
  }

  minNode(n) { while (n.left) n = n.left; return n; }

  remove(n, v) {
    if (!n) return null;
    if (v < n.val) n.left = this.remove(n.left, v);
    else if (v > n.val) n.right = this.remove(n.right, v);
    else {
      if (!n.left || !n.right) return n.left || n.right;
      const m = this.minNode(n.right);
      n.val = m.val; 
      n.right = this.remove(n.right, m.val);
    }
    return this.balance(n);
  }

  countNodes(n) { return n ? 1 + this.countNodes(n.left) + this.countNodes(n.right) : 0; }
  
  toJSON(n = this.root) {
    if (!n) return null;
    return { v: n.val, l: this.toJSON(n.left), r: this.toJSON(n.right) };
  }
  
  fromJSON(data) {
    if (!data) return null;
    const n = new Node(data.v);
    n.left = this.fromJSON(data.l);
    n.right = this.fromJSON(data.r);
    this.upH(n);
    return n;
  }
}

let tree = new AVLTree();

/* ───────────── Rendering Engine (Enter/Update/Exit) ───────────── */
const NODE_R   = 22;
const V_GAP    = 75;
const H_SPREAD = 320;

function assignCoords(node, depth, xCenter, xSpread) {
  if (!node) return;
  node._x = xCenter;
  node._y = 60 + depth * V_GAP;
  assignCoords(node.left,  depth + 1, xCenter - xSpread, xSpread / 2);
  assignCoords(node.right, depth + 1, xCenter + xSpread, xSpread / 2);
}

function getColor(b) {
  if (b === 0) return 'var(--green)';
  if (Math.abs(b) === 1) return 'var(--accent)';
  return 'var(--amber)';
}

function draw() {
  const svg = document.getElementById('tree-svg');
  const empty = document.getElementById('empty-state');
  const nodesGrp = document.getElementById('nodes-grp');
  const edgesGrp = document.getElementById('edges-grp');

  if (!tree.root) {
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    empty.style.display = 'flex';
    nodesGrp.innerHTML = '';
    edgesGrp.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  // Calculate coordinates
  const spread = Math.max(H_SPREAD / Math.pow(1.05, tree.hgt(tree.root)), 35);
  assignCoords(tree.root, 0, 0, spread);

  // Bounding box for canvas size
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  function bbox(n) {
    if (!n) return;
    if (n._x - NODE_R < minX) minX = n._x - NODE_R;
    if (n._x + NODE_R > maxX) maxX = n._x + NODE_R;
    if (n._y + NODE_R > maxY) maxY = n._y + NODE_R;
    bbox(n.left); bbox(n.right);
  }
  bbox(tree.root);

  const pad  = 40;
  const W    = Math.max(maxX - minX + pad * 2, svg.parentElement.clientWidth);
  const H    = Math.max(maxY + pad * 2, svg.parentElement.clientHeight);
  const offX = Math.max(-minX + pad, W/2); // Center if tree is small

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  // Extract current nodes and edges
  let currentNodes = {};
  let currentEdges = {};

  function traverseDrawData(n) {
    if (!n) return;
    currentNodes[n.val] = n;
    if (n.left)  { currentEdges[`${n.val}-${n.left.val}`] = { p: n, c: n.left }; traverseDrawData(n.left); }
    if (n.right) { currentEdges[`${n.val}-${n.right.val}`] = { p: n, c: n.right }; traverseDrawData(n.right); }
  }
  traverseDrawData(tree.root);

  // 1. Sync Edges (Lines)
  Array.from(edgesGrp.children).forEach(el => {
    if (!currentEdges[el.dataset.id]) el.remove(); // Exit
  });
  for (const [id, data] of Object.entries(currentEdges)) {
    let el = document.querySelector(`.edge-line[data-id="${id}"]`);
    if (!el) { // Enter
      el = svgEl('line', { class: 'edge-line', 'data-id': id });
      edgesGrp.appendChild(el);
      // Start from parent to animate growing
      el.setAttribute('x1', data.p._x + offX);
      el.setAttribute('y1', data.p._y);
      el.setAttribute('x2', data.p._x + offX);
      el.setAttribute('y2', data.p._y);
      
      // Force reflow
      el.getBoundingClientRect();
    }
    // Update
    el.setAttribute('x1', data.p._x + offX);
    el.setAttribute('y1', data.p._y);
    el.setAttribute('x2', data.c._x + offX);
    el.setAttribute('y2', data.c._y);
  }

  // 2. Sync Nodes (Groups)
  Array.from(nodesGrp.children).forEach(el => {
    if (!currentNodes[el.dataset.val]) el.remove(); // Exit
  });
  for (const [val, n] of Object.entries(currentNodes)) {
    let el = document.querySelector(`.node-g[data-val="${val}"]`);
    const b = tree.bf(n);
    const col = getColor(b);

    if (!el) { // Enter
      el = svgEl('g', { class: 'node-g', 'data-val': val });
      
      // Shadow/Glow circle
      el.appendChild(svgEl('circle', { cx: 0, cy: 0, r: NODE_R + 5, fill: col, opacity: '0.12', class: 'node-shadow' }));
      // Main circle
      el.appendChild(svgEl('circle', { cx: 0, cy: 0, r: NODE_R, fill: col, class: 'node-circle' }));
      // Highlight
      el.appendChild(svgEl('circle', { cx: 0, cy: -5, r: 8, fill: '#fff', opacity: '0.08' }));
      
      // Value Text
      const txt = svgEl('text', {
        x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': '13', 'font-weight': '600', fill: '#fff', class: 'node-text'
      });
      el.appendChild(txt);

      // BF Text
      const bftxt = svgEl('text', {
        x: 0, y: -NODE_R - 6, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': '10', fill: col, class: 'bf-text', opacity: '0.85'
      });
      el.appendChild(bftxt);

      el.addEventListener('click', () => {
        addLog(`Detail Node: Val=${n.val}, BF=${b}, H=${n.h}`, 'info');
        document.getElementById('val-input').value = n.val;
      });

      nodesGrp.appendChild(el);
      
      // Start position (from root or top to animate falling in)
      el.setAttribute('transform', `translate(${offX}, 0) scale(0.1)`);
      el.getBoundingClientRect(); // force reflow
    }

    // Update
    el.setAttribute('transform', `translate(${n._x + offX}, ${n._y}) scale(1)`);
    el.querySelector('.node-circle').setAttribute('fill', col);
    el.querySelector('.node-shadow').setAttribute('fill', col);
    el.querySelector('.node-text').textContent = n.val;
    el.querySelector('.bf-text').textContent = `bf:${b}`;
    el.querySelector('.bf-text').setAttribute('fill', col);
    
    // Clear traversal classes if any
    el.classList.remove('visiting', 'found');
  }
}

/* ───────────── Actions ───────────── */
function validateInput(inp) {
  const v = parseInt(inp.value);
  if (isNaN(v) || v < -9999 || v > 9999) { 
    inp.classList.remove('shake');
    void inp.offsetWidth; // trigger reflow
    inp.classList.add('shake');
    addLog('Nilai tidak valid (−9999 hingga 9999)', 'err'); 
    return null;
  }
  return v;
}

function doInsert() {
  if (state.isAnimating) return;
  const inp = document.getElementById('val-input');
  const v = validateInput(inp);
  if (v === null) return;

  addLog(`Sisipkan ${v}`, 'info');
  tree.root = tree.insert(tree.root, v);
  inp.value = '';
  inp.classList.remove('shake');
  updateUI();
}

function doDelete() {
  if (state.isAnimating) return;
  const inp = document.getElementById('val-input');
  const v = parseInt(inp.value);
  if (isNaN(v)) { 
    inp.classList.add('shake');
    addLog('Masukkan nilai yang ingin dihapus', 'err'); return; 
  }
  addLog(`Hapus ${v}`, 'del');
  tree.root = tree.remove(tree.root, v);
  inp.value = '';
  inp.classList.remove('shake');
  updateUI();
}

function doClear() { 
  if (state.isAnimating) return;
  tree.root = null; 
  state.totalRotations = 0; 
  addLog('Pohon direset.', 'info'); 
  updateUI(); 
}

function doRandom(n) {
  if (state.isAnimating) return;
  addLog(`Sisipkan ${n} nilai acak...`, 'info');
  for (let i = 0; i < n; i++) tree.root = tree.insert(tree.root, Math.floor(Math.random() * 99) + 1);
  updateUI();
}

function doPreset(type) {
  if (state.isAnimating) return;
  tree.root = null; state.totalRotations = 0;
  if (type === 'bst') {
    [30, 20, 40, 10, 25, 35, 50].forEach(v => { tree.root = tree.insert(tree.root, v); });
    addLog('Contoh BST seimbang dimuat.', 'info');
  }
  if (type === 'zigzag') {
    [10, 20, 15].forEach(v => { addLog(`Sisipkan ${v} → memicu LR rotasi`, 'info'); tree.root = tree.insert(tree.root, v); });
  }
  updateUI();
}

/* ───────────── Traversal & Search (Animations) ───────────── */
function setVisiting(val, isFound = false) {
  const el = document.querySelector(`.node-g[data-val="${val}"]`);
  if (el) el.classList.add(isFound ? 'found' : 'visiting');
}
function clearVisiting() {
  document.querySelectorAll('.node-g').forEach(el => el.classList.remove('visiting', 'found'));
}

async function doSearch() {
  if (state.isAnimating || !tree.root) return;
  const inp = document.getElementById('search-input');
  const target = validateInput(inp);
  if (target === null) return;

  state.isAnimating = true;
  clearVisiting();
  addLog(`Mencari node ${target}...`, 'info');

  let curr = tree.root;
  let found = false;
  while (curr) {
    setVisiting(curr.val);
    await sleep(600);
    
    if (target === curr.val) {
      found = true;
      setVisiting(curr.val, true);
      addLog(`Node ${target} ditemukan!`, 'highlight');
      break;
    } else {
      curr = target < curr.val ? curr.left : curr.right;
    }
  }

  if (!found) addLog(`Node ${target} tidak ditemukan.`, 'err');
  state.isAnimating = false;
}

async function doTraverse(type) {
  if (state.isAnimating || !tree.root) return;
  
  const searchInp = document.getElementById('search-input');
  const target = parseInt(searchInp.value);
  const isSearching = !isNaN(target);

  state.isAnimating = true;
  clearVisiting();
  document.querySelectorAll('.node-g').forEach(el => el.style.opacity = '1');
  
  let result = [];
  let found = false;
  addLog(`Memulai ${type.toUpperCase()}-order ${isSearching ? 'Search untuk ' + target : 'Traversal'}...`, 'info');

  async function traverse(n) {
    if (!n || found) return;

    // --- PRE-ORDER: Root - Left - Right ---
    if (type === 'pre') {
      setVisiting(n.val);
      result.push(n.val);
      addLog(` → Mengunjungi node ${n.val}`, 'info');
      if (isSearching && n.val === target) { 
        found = true; setVisiting(n.val, true); 
        addLog(`[HASIL] Target ${target} DITEMUKAN!`, 'highlight'); 
        return; 
      }
      await sleep(500);
    }

    await traverse(n.left);
    if (found) return;

    // --- IN-ORDER: Left - Root - Right ---
    if (type === 'in') {
      setVisiting(n.val);
      result.push(n.val);
      addLog(` → Mengunjungi node ${n.val}`, 'info');
      if (isSearching && n.val === target) { 
        found = true; setVisiting(n.val, true); 
        addLog(`[HASIL] Target ${target} DITEMUKAN!`, 'highlight'); 
        return; 
      }
      await sleep(500);
    }

    await traverse(n.right);
    if (found) return;

    // --- POST-ORDER: Left - Right - Root ---
    if (type === 'post') {
      setVisiting(n.val);
      result.push(n.val);
      addLog(` → Mengunjungi node ${n.val}`, 'info');
      if (isSearching && n.val === target) { 
        found = true; setVisiting(n.val, true); 
        addLog(`[HASIL] Target ${target} DITEMUKAN!`, 'highlight'); 
        return; 
      }
      await sleep(500);
    }
    
    // Efek redup untuk node yang sudah dilewati (hanya jika target belum ketemu)
    const el = document.querySelector(`.node-g[data-val="${n.val}"]`);
    if(el && !found) el.style.opacity = '0.6';
  }

  await traverse(tree.root);

  // Bagian Hasil Akhir (Summary)
  const operationLabel = isSearching ? 'Search' : 'Traversal';
  const typeLabel = type.toUpperCase();
  
  if (isSearching && !found) {
    addLog(`[HASIL] ${typeLabel}-order ${operationLabel} (Gagal): ${result.join(', ')}`, 'err');
    addLog(`Target ${target} tidak ditemukan dalam jalur traversal ini.`, 'err');
  } else {
    addLog(`[HASIL] ${typeLabel}-order ${operationLabel}: ${result.join(', ')}`, 'highlight');
  }

  // Selesaikan animasi: tunggu sebentar baru reset status
  await sleep(1500);
  document.querySelectorAll('.node-g').forEach(el => el.style.opacity = '1');
  if (!found) clearVisiting();
  state.isAnimating = false;
}

/* ───────────── Data Export/Import ───────────── */
function doExport() {
  if (!tree.root) return addLog('Pohon kosong, tidak ada yang diexport', 'err');
  const data = JSON.stringify(tree.toJSON());
  navigator.clipboard.writeText(data).then(() => {
    addLog('Data pohon berhasil disalin ke clipboard!', 'highlight');
  }).catch(() => {
    prompt("Copy data JSON berikut:", data);
  });
}

function doImport() {
  if (state.isAnimating) return;
  const jsonStr = prompt("Paste data JSON AVL Tree:");
  if (!jsonStr) return;
  try {
    const data = JSON.parse(jsonStr);
    tree.root = tree.fromJSON(data);
    state.totalRotations = 0; // Reset as we don't save this
    addLog('Pohon berhasil dimuat dari JSON.', 'info');
    updateUI();
  } catch (e) {
    addLog('Gagal memuat JSON. Format tidak valid.', 'err');
  }
}

/* ───────────── Log & Stats ───────────── */
function addLog(msg, cls = '') {
  const body = document.getElementById('log-body');
  const d = document.createElement('div');
  d.className = 'log-entry ' + cls;
  const t = new Date();
  const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
  d.textContent = `[${ts}] ${msg}`;
  body.appendChild(d);
  body.scrollTop = body.scrollHeight;
}
function clearLog() { document.getElementById('log-body').innerHTML = ''; }

function updateUI() {
  draw();
  document.getElementById('stat-n').textContent = tree.countNodes(tree.root);
  document.getElementById('stat-h').textContent = tree.hgt(tree.root);
  document.getElementById('stat-r').textContent = state.totalRotations;
}

/* ───────────── Zoom ───────────── */
function zoom(delta) {
  state.scale = Math.min(Math.max(state.scale + delta, 0.4), 2.5);
  const svg = document.getElementById('tree-svg');
  svg.style.transform = `scale(${state.scale})`;
  svg.style.transformOrigin = 'top center';
}
function resetZoom() {
  state.scale = 1;
  document.getElementById('tree-svg').style.transform = '';
}

/* ───────────── Init & Listeners ───────────── */
document.getElementById('val-input').addEventListener('keydown', e => { if (e.key === 'Enter') doInsert(); });
document.getElementById('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

updateUI();
addLog('Selamat datang! Sisipkan angka untuk memulai.', 'info');