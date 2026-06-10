/* ───────────── AVL Tree Engine ───────────── */
class Node {
  constructor(v) { this.val = v; this.left = null; this.right = null; this.h = 1; }
}

let root = null;
let totalRotations = 0;
let scale = 1;

const hgt = n => n ? n.h : 0;
const bf  = n => n ? hgt(n.left) - hgt(n.right) : 0;
const upH = n => { if (n) n.h = 1 + Math.max(hgt(n.left), hgt(n.right)); };

function rotR(y) {
  const x = y.left, T2 = x.right;
  x.right = y; y.left = T2;
  upH(y); upH(x);
  totalRotations++;
  addLog(`Rotasi Kanan pada node ${y.val}`, 'rot');
  return x;
}
function rotL(x) {
  const y = x.right, T2 = y.left;
  y.left = x; x.right = T2;
  upH(x); upH(y);
  totalRotations++;
  addLog(`Rotasi Kiri pada node ${x.val}`, 'rot');
  return y;
}
function balance(n) {
  upH(n);
  const b = bf(n);
  if (b > 1)  { if (bf(n.left) < 0) { n.left = rotL(n.left); addLog('  → LR case: rotasi kiri kiri dulu', 'rot'); } return rotR(n); }
  if (b < -1) { if (bf(n.right) > 0) { n.right = rotR(n.right); addLog('  → RL case: rotasi kanan kanan dulu', 'rot'); } return rotL(n); }
  return n;
}
function insert(n, v) {
  if (!n) return new Node(v);
  if (v < n.val) n.left = insert(n.left, v);
  else if (v > n.val) n.right = insert(n.right, v);
  else return n;
  return balance(n);
}
function minNode(n) { while (n.left) n = n.left; return n; }
function remove(n, v) {
  if (!n) return null;
  if (v < n.val) n.left = remove(n.left, v);
  else if (v > n.val) n.right = remove(n.right, v);
  else {
    if (!n.left || !n.right) return n.left || n.right;
    const m = minNode(n.right);
    n.val = m.val; n.right = remove(n.right, m.val);
  }
  return balance(n);
}
function countNodes(n) { return n ? 1 + countNodes(n.left) + countNodes(n.right) : 0; }

/* ───────────── Actions ───────────── */
function doInsert() {
  const inp = document.getElementById('val-input');
  const v = parseInt(inp.value);
  if (isNaN(v) || v < -9999 || v > 9999) { addLog('Nilai tidak valid (−9999 hingga 9999)', 'err'); return; }
  addLog(`Sisipkan ${v}`, 'info');
  root = insert(root, v);
  inp.value = '';
  draw(); updateStats();
}
function doDelete() {
  const inp = document.getElementById('val-input');
  const v = parseInt(inp.value);
  if (isNaN(v)) { addLog('Masukkan nilai yang ingin dihapus', 'err'); return; }
  addLog(`Hapus ${v}`, 'del');
  root = remove(root, v);
  inp.value = '';
  draw(); updateStats();
}
function doClear() { root = null; totalRotations = 0; addLog('Pohon direset.', 'info'); draw(); updateStats(); }
function doRandom(n) {
  addLog(`Sisipkan ${n} nilai acak...`, 'info');
  for (let i = 0; i < n; i++) root = insert(root, Math.floor(Math.random() * 99) + 1);
  draw(); updateStats();
}
function doPreset(type) {
  root = null; totalRotations = 0;
  if (type === 'bst') {
    [30, 20, 40, 10, 25, 35, 50].forEach(v => { root = insert(root, v); });
    addLog('Contoh BST seimbang dimuat.', 'info');
  }
  if (type === 'zigzag') {
    [10, 20, 15].forEach(v => { addLog(`Sisipkan ${v} → akan memicu LR rotasi`, 'info'); root = insert(root, v); });
  }
  draw(); updateStats();
}

/* ───────────── Log ───────────── */
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

/* ───────────── Stats ───────────── */
function updateStats() {
  document.getElementById('stat-n').textContent = countNodes(root);
  document.getElementById('stat-h').textContent = hgt(root);
  document.getElementById('stat-r').textContent = totalRotations;
}

/* ───────────── Draw ───────────── */
const NODE_R   = 22;
const V_GAP    = 72;
const H_SPREAD = 280;

function assignCoords(node, depth, xCenter, xSpread) {
  if (!node) return;
  node._x = xCenter;
  node._y = 60 + depth * V_GAP;
  assignCoords(node.left,  depth + 1, xCenter - xSpread, xSpread / 2);
  assignCoords(node.right, depth + 1, xCenter + xSpread, xSpread / 2);
}

function getColor(b) {
  if (b === 0) return '#3ecf8e';
  if (Math.abs(b) === 1) return '#5b8dee';
  return '#f0a843';
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function draw() {
  const svg   = document.getElementById('tree-svg');
  const empty = document.getElementById('empty-state');
  svg.innerHTML = '';
  if (!root) {
    svg.setAttribute('width', 0);
    svg.setAttribute('height', 0);
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const spread = Math.max(H_SPREAD / Math.pow(1.05, hgt(root)), 30);
  assignCoords(root, 0, 0, spread);

  // Bounding box
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  function bbox(n) {
    if (!n) return;
    if (n._x - NODE_R < minX) minX = n._x - NODE_R;
    if (n._x + NODE_R > maxX) maxX = n._x + NODE_R;
    if (n._y + NODE_R > maxY) maxY = n._y + NODE_R;
    bbox(n.left); bbox(n.right);
  }
  bbox(root);

  const pad  = 32;
  const W    = maxX - minX + pad * 2;
  const H    = maxY + pad * 2;
  const offX = -minX + pad;

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  // Edges
  function drawEdges(n) {
    if (!n) return;
    if (n.left) {
      svg.appendChild(svgEl('line', { class: 'edge-line', x1: n._x + offX, y1: n._y, x2: n.left._x + offX, y2: n.left._y }));
      drawEdges(n.left);
    }
    if (n.right) {
      svg.appendChild(svgEl('line', { class: 'edge-line', x1: n._x + offX, y1: n._y, x2: n.right._x + offX, y2: n.right._y }));
      drawEdges(n.right);
    }
  }
  drawEdges(root);

  // Nodes
  function drawNodes(n) {
    if (!n) return;
    const b   = bf(n);
    const col = getColor(b);
    const cx  = n._x + offX, cy = n._y;

    const g = svgEl('g', { class: 'node-g' });
    g.addEventListener('click', () => {
      addLog(`Node ${n.val} — BF=${b}, tinggi=${n.h}, kiri=${n.left?.val ?? '−'}, kanan=${n.right?.val ?? '−'}`, 'info');
      document.getElementById('val-input').value = n.val;
    });

    g.appendChild(svgEl('circle', { cx, cy, r: NODE_R + 5, fill: col, opacity: '0.12' }));
    g.appendChild(svgEl('circle', { cx, cy, r: NODE_R, fill: col, class: 'node-circle' }));
    g.appendChild(svgEl('circle', { cx, cy: cy - 5, r: 8, fill: '#fff', opacity: '0.08' }));

    const txt = svgEl('text', {
      x: cx, y: cy + 1,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '13', 'font-weight': '600', fill: '#fff', class: 'node-text'
    });
    txt.textContent = n.val;
    g.appendChild(txt);

    const bftxt = svgEl('text', {
      x: cx, y: cy - NODE_R - 6,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '10', fill: col, class: 'bf-text', opacity: '0.85'
    });
    bftxt.textContent = `bf:${b}`;
    g.appendChild(bftxt);

    svg.appendChild(g);
    drawNodes(n.left);
    drawNodes(n.right);
  }
  drawNodes(root);
}

/* ───────────── Zoom ───────────── */
function zoom(delta) {
  scale = Math.min(Math.max(scale + delta, 0.4), 2.5);
  const svg = document.getElementById('tree-svg');
  svg.style.transform = `scale(${scale})`;
  svg.style.transformOrigin = 'top center';
}
function resetZoom() {
  scale = 1;
  document.getElementById('tree-svg').style.transform = '';
}

/* ───────────── Keyboard ───────────── */
document.getElementById('val-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doInsert();
});

/* ───────────── Init ───────────── */
draw();
updateStats();
addLog('Selamat datang! Sisipkan angka untuk memulai.', 'info');