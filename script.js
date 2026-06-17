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
  isAnimating: false,
  animationSpeed: 800 // ms
};

/* ───────────── AVL Tree Engine ───────────── */
class Node {
  constructor(v) { 
    this.val = v; 
    this.left = null; 
    this.right = null; 
    this.h = 1;
    this._isUnbalanced = false; // Flag for visualization
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
    return x;
  }

  rotL(x) {
    const y = x.right, T2 = y.left;
    y.left = x; x.right = T2;
    this.upH(x); this.upH(y);
    state.totalRotations++;
    return y;
  }

  async balance(n) {
    if (!n) return null;
    this.upH(n);
    const b = this.bf(n);

    // Visual: Highlight node if unbalanced (BF >= 2 or <= -2)
    if (Math.abs(b) > 1) {
      n._isUnbalanced = true;
      updateUI();
      addLog(`Ketidakseimbangan pada ${n.val} (BF=${b}). Menyiapkan rotasi...`, 'warn');
      await sleep(state.animationSpeed);
    }

    let result = n;

    // Left Heavy
    if (b > 1) { 
      if (this.bf(n.left) < 0) { 
        addLog(`→ Kasus LR: Rotasi Kiri pada anak ${n.left.val}`, 'rot');
        n.left = this.rotL(n.left); 
        updateUI();
        await sleep(state.animationSpeed);
      }
      addLog(`→ Rotasi Kanan pada node ${n.val}`, 'rot');
      result = this.rotR(n);
    }
    // Right Heavy
    else if (b < -1) { 
      if (this.bf(n.right) > 0) { 
        addLog(`→ Kasus RL: Rotasi Kanan pada anak ${n.right.val}`, 'rot');
        n.right = this.rotR(n.right); 
        updateUI();
        await sleep(state.animationSpeed);
      }
      addLog(`→ Rotasi Kiri pada node ${n.val}`, 'rot');
      result = this.rotL(n);
    }
    
    // PENTING: Bersihkan flag merah dari node lama (n) dan node baru (result)
    n._isUnbalanced = false;
    if (result) result._isUnbalanced = false;
    
    if (Math.abs(b) > 1) {
      updateUI();
      await sleep(state.animationSpeed / 2);
    }
    
    return result;
  }

  async insert(n, v) {
    if (!n) return new Node(v);
    
    // Highlight visiting path
    n._visiting = true;
    updateUI();
    await sleep(state.animationSpeed / 2);
    n._visiting = false;

    if (v < n.val) n.left = await this.insert(n.left, v);
    else if (v > n.val) n.right = await this.insert(n.right, v);
    else return n; // Duplicate (handled in doInsert)

    return await this.balance(n);
  }

  minNode(n) { while (n.left) n = n.left; return n; }

  async remove(n, v) {
    if (!n) return null;

    n._visiting = true;
    updateUI();
    await sleep(state.animationSpeed / 2);
    n._visiting = false;

    if (v < n.val) n.left = await this.remove(n.left, v);
    else if (v > n.val) n.right = await this.remove(n.right, v);
    else {
      if (!n.left || !n.right) return n.left || n.right;
      const m = this.minNode(n.right);
      addLog(`Menghapus ${v}, menggantikan dengan nilai terkecil dari subtree kanan (${m.val})`, 'info');
      n.val = m.val; 
      n.right = await this.remove(n.right, m.val);
    }
    return await this.balance(n);
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

  exists(n, v) {
    if (!n) return false;
    if (v === n.val) return true;
    return v < n.val ? this.exists(n.left, v) : this.exists(n.right, v);
  }
}

let tree = new AVLTree();

/* ───────────── Rendering Engine ───────────── */
const NODE_R   = 22;
const V_GAP    = 75;

// Improved coordinate calculation to prevent overlap while staying compact
function assignCoords(node, depth, xCenter, xSpread) {
  if (!node) return;
  node._x = xCenter;
  node._y = 60 + depth * V_GAP;
  
  // Spread shrinks at each level, but we keep it sufficient for nodes
  const nextSpread = xSpread * 0.55; 
  
  assignCoords(node.left,  depth + 1, xCenter - xSpread, nextSpread);
  assignCoords(node.right, depth + 1, xCenter + xSpread, nextSpread);
}

function getColor(n) {
  if (n._isUnbalanced) return 'var(--red)';
  const b = tree.bf(n);
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

  // More conservative initial spread based on tree height
  const h = tree.hgt(tree.root);
  const initialSpread = Math.min(30 * Math.pow(1.6, h - 1), 500); 
  assignCoords(tree.root, 0, 0, initialSpread);

  // Bounding box calculation
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  function bbox(n) {
    if (!n) return;
    if (n._x - NODE_R < minX) minX = n._x - NODE_R;
    if (n._x + NODE_R > maxX) maxX = n._x + NODE_R;
    if (n._y + NODE_R > maxY) maxY = n._y + NODE_R;
    bbox(n.left); bbox(n.right);
  }
  bbox(tree.root);

  const pad  = 80;
  const treeWidth = maxX - minX;
  const containerW = svg.parentElement.clientWidth;
  
  const W = Math.max(treeWidth + pad * 2, containerW);
  const H = maxY + pad;
  
  // offX: ensure the leftmost node starts at 'pad' from left, 
  // or center it if the tree is narrower than the container.
  const offX = (treeWidth < containerW - pad * 2) ? (containerW / 2 - (minX + maxX) / 2) : (-minX + pad);

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  let currentNodes = {};
  let currentEdges = {};

  function traverseDrawData(n) {
    if (!n) return;
    currentNodes[n.val] = n;
    if (n.left)  { currentEdges[`${n.val}-${n.left.val}`] = { p: n, c: n.left }; traverseDrawData(n.left); }
    if (n.right) { currentEdges[`${n.val}-${n.right.val}`] = { p: n, c: n.right }; traverseDrawData(n.right); }
  }
  traverseDrawData(tree.root);

  // Sync Edges
  Array.from(edgesGrp.children).forEach(el => {
    if (!currentEdges[el.dataset.id]) el.remove();
  });
  for (const [id, data] of Object.entries(currentEdges)) {
    let el = document.querySelector(`.edge-line[data-id="${id}"]`);
    if (!el) {
      el = svgEl('line', { class: 'edge-line', 'data-id': id });
      edgesGrp.appendChild(el);
      el.setAttribute('x1', data.p._x + offX);
      el.setAttribute('y1', data.p._y);
      el.setAttribute('x2', data.p._x + offX);
      el.setAttribute('y2', data.p._y);
    }
    el.setAttribute('x1', data.p._x + offX);
    el.setAttribute('y1', data.p._y);
    el.setAttribute('x2', data.c._x + offX);
    el.setAttribute('y2', data.c._y);
  }

  // Sync Nodes
  Array.from(nodesGrp.children).forEach(el => {
    if (!currentNodes[el.dataset.val]) el.remove();
  });
  for (const [val, n] of Object.entries(currentNodes)) {
    let el = document.querySelector(`.node-g[data-val="${val}"]`);
    const b = tree.bf(n);
    const col = getColor(n);

    if (!el) {
      el = svgEl('g', { class: 'node-g', 'data-val': val });
      el.appendChild(svgEl('circle', { cx: 0, cy: 0, r: NODE_R + 5, fill: col, opacity: '0.12', class: 'node-shadow' }));
      el.appendChild(svgEl('circle', { cx: 0, cy: 0, r: NODE_R, fill: col, class: 'node-circle' }));
      el.appendChild(svgEl('circle', { cx: 0, cy: -5, r: 8, fill: '#fff', opacity: '0.08' }));
      const txt = svgEl('text', {
        x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': '13', 'font-weight': '600', fill: '#fff', class: 'node-text'
      });
      el.appendChild(txt);
      const bftxt = svgEl('text', {
        x: 0, y: -NODE_R - 6, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': '10', fill: col, class: 'bf-text', opacity: '0.85'
      });
      el.appendChild(bftxt);
      el.addEventListener('click', () => {
        const hL = tree.hgt(n.left), hR = tree.hgt(n.right);
        addLog(`Detail Node ${n.val}: Tinggi Kiri=${hL}, Tinggi Kanan=${hR} → BF = ${hL - hR}`, 'info');
        document.getElementById('val-input').value = n.val;
      });
      nodesGrp.appendChild(el);
      el.setAttribute('transform', `translate(${offX}, 0) scale(0.1)`);
    }

    el.setAttribute('transform', `translate(${n._x + offX}, ${n._y}) scale(1)`);
    el.querySelector('.node-circle').setAttribute('fill', col);
    el.querySelector('.node-shadow').setAttribute('fill', col);
    el.querySelector('.node-text').textContent = n.val;
    el.querySelector('.bf-text').textContent = `bf:${b}`;
    el.querySelector('.bf-text').setAttribute('fill', col);
    
    if (n._visiting) el.classList.add('visiting'); else el.classList.remove('visiting');
    if (n._isUnbalanced) el.classList.add('unbalanced-node'); else el.classList.remove('unbalanced-node');
  }
}

/* ───────────── Actions ───────────── */
function validateInput(inp) {
  const v = parseInt(inp.value);
  if (isNaN(v) || v < -999 || v > 9999) { 
    inp.classList.add('shake');
    setTimeout(() => inp.classList.remove('shake'), 400);
    addLog('Input tidak valid (−999 s/d 9999)', 'err'); 
    return null;
  }
  return v;
}

async function doInsert() {
  if (state.isAnimating) return;
  const inp = document.getElementById('val-input');
  const v = validateInput(inp);
  if (v === null) return;

  if (tree.exists(tree.root, v)) {
    addLog(`Nilai ${v} sudah ada dalam pohon. Duplikat diabaikan.`, 'warn');
    inp.classList.add('shake');
    setTimeout(() => inp.classList.remove('shake'), 400);
    return;
  }

  state.isAnimating = true;
  addLog(`Menyisipkan ${v}...`, 'info');
  tree.root = await tree.insert(tree.root, v);
  inp.value = '';
  updateUI();
  state.isAnimating = false;
  addLog(`Selesai menyisipkan ${v}.`, 'highlight');
}

async function doDelete() {
  if (state.isAnimating) return;
  const inp = document.getElementById('val-input');
  const v = parseInt(inp.value);
  if (isNaN(v)) { 
    inp.classList.add('shake');
    setTimeout(() => inp.classList.remove('shake'), 400);
    addLog('Masukkan nilai yang ingin dihapus', 'err'); return; 
  }
  
  if (!tree.exists(tree.root, v)) {
    addLog(`Nilai ${v} tidak ditemukan.`, 'err');
    return;
  }

  state.isAnimating = true;
  addLog(`Menghapus ${v}...`, 'del');
  tree.root = await tree.remove(tree.root, v);
  inp.value = '';
  updateUI();
  state.isAnimating = false;
  addLog(`Selesai menghapus ${v}.`, 'highlight');
}

function doClear() { 
  if (state.isAnimating) return;
  tree.root = null; 
  state.totalRotations = 0; 
  addLog('Pohon direset.', 'info'); 
  updateUI(); 
}

async function doRandom(n) {
  if (state.isAnimating) return;
  state.isAnimating = true;
  addLog(`Menyisipkan ${n} nilai acak satu per satu...`, 'info');
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.random() * 99) + 1;
    if (!tree.exists(tree.root, v)) {
      tree.root = await tree.insert(tree.root, v);
      updateUI();
      await sleep(200);
    }
  }
  state.isAnimating = false;
  updateUI();
}

async function doPreset(type) {
  if (state.isAnimating) return;
  tree.root = null; state.totalRotations = 0;
  updateUI();

  state.isAnimating = true;
  if (type === 'bst') {
    const vals = [30, 20, 40, 10, 25, 35, 50];
    addLog('Memuat contoh BST Seimbang...', 'info');
    for (const v of vals) {
      tree.root = await tree.insert(tree.root, v);
      updateUI();
      await sleep(300);
    }
  }
  if (type === 'zigzag') {
    // Sequence that forces multiple rotations and demonstrates balancing
    const vals = [50, 30, 40, 60, 80, 70, 20, 10, 15];
    addLog('Memulai simulasi Zigzag Kompleks (Double Rotations)...', 'info');
    for (const v of vals) {
      addLog(`Menyisipkan ${v}...`, 'info');
      tree.root = await tree.insert(tree.root, v);
      updateUI();
      await sleep(600);
    }
    addLog('Simulasi Zigzag selesai. Perhatikan keseimbangan di setiap langkah!', 'highlight');
  }
  state.isAnimating = false;
  updateUI();
}

/* ───────────── Traversal & Search ───────────── */
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
  const typeLabel = type.toUpperCase();
  
  addLog(`=== Memulai ${typeLabel}-order ${isSearching ? 'Search untuk ' + target : 'Traversal'} ===`, 'highlight');

  async function traverse(n) {
    if (!n || found) return;

    const el = document.querySelector(`.node-g[data-val="${n.val}"]`);
    
    // Helper function untuk memproses kunjungan node
    async function visitNode(node) {
      if (found) return;
      setVisiting(node.val);
      result.push(node.val);
      addLog(`[CHECK] Memeriksa node ${node.val}...`, 'info');
      
      if (isSearching && node.val === target) {
        found = true;
        setVisiting(node.val, true); // Mark as found
        addLog(`[HASIL] Target ${target} DITEMUKAN dalam jalur ${typeLabel}!`, 'highlight');
        await sleep(1000);
        return;
      }
      await sleep(state.animationSpeed);
    }

    // --- PRE-ORDER: Root - Left - Right ---
    if (type === 'pre') await visitNode(n);

    if (!found) await traverse(n.left);

    // --- IN-ORDER: Left - Root - Right ---
    if (type === 'in') await visitNode(n);

    if (!found) await traverse(n.right);

    // --- POST-ORDER: Left - Right - Root ---
    if (type === 'post') await visitNode(n);

    // Efek redup hanya jika bukan target yang dicari
    if (el && !found) el.style.opacity = '0.4';
  }

  await traverse(tree.root);
  
  if (isSearching) {
    if (found) {
      // Menampilkan history jalur penelusuran jika target ditemukan
      const pathStr = result.join(' → ');
      addLog(`[HASIL] Target ${target} DITEMUKAN dalam jalur ${typeLabel}!`, 'highlight');
      addLog(`Rute penelusuran: ${pathStr}`, 'info');
    } else {
      addLog(`[HASIL] ${target} tidak ditemukan. Jalur yang diperiksa: ${result.join(' → ')}`, 'err');
    }
  } else {
    addLog(`HASIL AKHIR ${typeLabel}: ${result.join(' → ')}`, 'highlight');
  }

  await sleep(1500);
  document.querySelectorAll('.node-g').forEach(el => {
    if (!el.classList.contains('found')) el.style.opacity = '1';
  });
  if (!found) clearVisiting();
  state.isAnimating = false;
}

/* ───────────── Data & UI ───────────── */
function doExport() {
  if (!tree.root) return addLog('Pohon kosong', 'err');
  const data = JSON.stringify(tree.toJSON());
  navigator.clipboard.writeText(data).then(() => addLog('JSON disalin ke clipboard!', 'highlight'));
}

function doImport() {
  if (state.isAnimating) return;
  const jsonStr = prompt("Paste data JSON AVL Tree:");
  if (!jsonStr) return;
  try {
    tree.root = tree.fromJSON(JSON.parse(jsonStr));
    state.totalRotations = 0;
    updateUI();
    addLog('Pohon berhasil diimpor.', 'info');
  } catch (e) { addLog('Format JSON tidak valid.', 'err'); }
}

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

function zoom(delta) {
  state.scale = Math.min(Math.max(state.scale + delta, 0.4), 2.5);
  document.getElementById('tree-svg').style.transform = `scale(${state.scale})`;
}
function resetZoom() {
  state.scale = 1;
  document.getElementById('tree-svg').style.transform = '';
}

document.getElementById('val-input').addEventListener('keydown', e => { if (e.key === 'Enter') doInsert(); });
document.getElementById('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

updateUI();
addLog('Sistem siap. Silakan sisipkan node.', 'info');