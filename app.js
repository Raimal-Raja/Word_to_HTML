

'use strict';

// DOM refs 
const wordEditor  = document.getElementById('wordEditor');
const htmlEditor  = document.getElementById('htmlEditor');
const wordPane    = document.getElementById('wordPane');
const htmlPane    = document.getElementById('htmlPane');
const tabWord     = document.getElementById('tab-word');
const tabHtml     = document.getElementById('tab-html');
const wordToolbar = document.getElementById('wordToolbar');
const htmlToolbar = document.getElementById('htmlToolbar');
const charCount   = document.getElementById('charCount');

// State 
let activeTab = 'word'; // 'word' | 'html'

// Tab switching
function switchTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  hideTableToolbar();

  if (tab === 'html') {
    // Sync visual → source
    htmlEditor.value = prettifyHTML(wordEditor.innerHTML);
    wordPane.classList.add('hidden');
    htmlPane.classList.remove('hidden');
    wordToolbar.classList.add('hidden');
    htmlToolbar.classList.remove('hidden');
    tabWord.classList.remove('active');
    tabHtml.classList.add('active');
  } else {
    // Sync source → visual
    wordEditor.innerHTML = htmlEditor.value;
    htmlPane.classList.add('hidden');
    wordPane.classList.remove('hidden');
    htmlToolbar.classList.add('hidden');
    wordToolbar.classList.remove('hidden');
    tabHtml.classList.remove('active');
    tabWord.classList.add('active');
  }
  updateCharCount();
}

// execCommand wrapper
function execCmd(cmd, value = null) {
  wordEditor.focus();
  document.execCommand(cmd, false, value);
  updateCharCount();
}

// Character count 
function updateCharCount() {
  const text = wordEditor.innerText || '';
  charCount.textContent = `characters: ${text.length}`;
}

wordEditor.addEventListener('input', updateCharCount);
htmlEditor.addEventListener('input', updateCharCount);

// Insert Link 
function insertLink() {
  const url = prompt('Enter URL:', 'https://');
  if (url) execCmd('createLink', url);
}

// Insert Table
function insertTable() {
  const rows = parseInt(prompt('Number of rows:', '3'), 10) || 3;
  const cols = parseInt(prompt('Number of columns:', '3'), 10) || 3;

  let html = '<table><thead><tr>';
  for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 0; r < rows - 1; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
    html += '</tr>';
  }
  html += '</tbody></table><p></p>';

  wordEditor.focus();
  document.execCommand('insertHTML', false, html);
  updateCharCount();
}

//  TABLE EDITING TOOLS 
const tableToolbar = document.getElementById('tableToolbar');
let activeCell  = null; // <td> or <th> the cursor is currently in
let activeTable = null;

// Find the closest ancestor cell / table of a node
function closestCell(node) {
  while (node && node !== wordEditor) {
    if (node.nodeType === 1 && (node.tagName === 'TD' || node.tagName === 'TH')) return node;
    node = node.parentNode;
  }
  return null;
}
function closestTable(node) {
  while (node && node !== wordEditor) {
    if (node.nodeType === 1 && node.tagName === 'TABLE') return node;
    node = node.parentNode;
  }
  return null;
}

// Detect cursor position and show/hide the floating table toolbar
function checkTableContext() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) { hideTableToolbar(); return; }

  const node = sel.getRangeAt(0).startContainer;
  const cell = closestCell(node);
  const table = closestTable(node);

  if (!cell || !table || !wordEditor.contains(table)) {
    hideTableToolbar();
    return;
  }

  setActiveTable(table);
  activeCell = cell;
  positionTableToolbar(table);
}

function setActiveTable(table) {
  if (activeTable && activeTable !== table) activeTable.classList.remove('tbl-active');
  activeTable = table;
  activeTable.classList.add('tbl-active');
}

function hideTableToolbar() {
  if (activeTable) activeTable.classList.remove('tbl-active');
  activeTable = null;
  activeCell = null;
  tableToolbar.classList.add('hidden');
}

function positionTableToolbar(table) {
  const wrapperRect = document.querySelector('.editor-wrapper').getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();

  tableToolbar.classList.remove('hidden');

  // Measure after un-hiding so offsetWidth/Height are accurate
  const ttRect = tableToolbar.getBoundingClientRect();

  // getBoundingClientRect() is already viewport-relative and accounts for
  // any scrolling, so subtracting wrapperRect's origin gives a coordinate
  // relative to .editor-wrapper directly — no manual scrollTop math needed.
  let top = (tableRect.top - wrapperRect.top) + (tableRect.height / 2) - (ttRect.height / 2);
  let left = (tableRect.left - wrapperRect.left) - ttRect.width - 12;

  // If there isn't room to the left, place it just above the table instead
  if (left < 4) {
    left = (tableRect.left - wrapperRect.left);
    top = (tableRect.top - wrapperRect.top) - ttRect.height - 8;
  }

  tableToolbar.style.top = `${Math.max(4, top)}px`;
  tableToolbar.style.left = `${Math.max(4, left)}px`;
}

// Re-check table context on selection / click / keyboard navigation
wordEditor.addEventListener('click', checkTableContext);
wordEditor.addEventListener('keyup', checkTableContext);
document.addEventListener('selectionchange', () => {
  if (document.activeElement === wordEditor) checkTableContext();
});

// Hide the toolbar if the user clicks elsewhere or switches tabs
document.addEventListener('mousedown', (e) => {
  if (!wordEditor.contains(e.target) && !tableToolbar.contains(e.target)) {
    hideTableToolbar();
  }
});

// Reposition on resize/scroll while visible
window.addEventListener('resize', () => { if (activeTable) positionTableToolbar(activeTable); });
wordPane.addEventListener('scroll', () => { if (activeTable) positionTableToolbar(activeTable); });

// Get the row & column index of the active cell within its table
function cellCoords(cell) {
  const row = cell.parentElement; // <tr>
  const colIndex = Array.from(row.children).indexOf(cell);
  const allRows = Array.from(activeTable.querySelectorAll('tr'));
  const rowIndex = allRows.indexOf(row);
  return { row, colIndex, rowIndex, allRows };
}

function insertColumn(beforeIndex) {
  if (!activeCell || !activeTable) return;
  const { colIndex, allRows } = cellCoords(activeCell);
  const targetIndex = beforeIndex ? colIndex : colIndex + 1;

  allRows.forEach((row) => {
    const refCell = row.children[colIndex];
    const isHeaderRow = refCell && refCell.tagName === 'TH';
    const newCell = document.createElement(isHeaderRow ? 'th' : 'td');
    newCell.innerHTML = '&nbsp;';
    if (targetIndex >= row.children.length) {
      row.appendChild(newCell);
    } else {
      row.insertBefore(newCell, row.children[targetIndex]);
    }
  });
  toast(beforeIndex ? 'Column inserted before.' : 'Column inserted after.');
  updateCharCount();
}

function insertRow(beforeIndex) {
  if (!activeCell || !activeTable) return;
  const { row, rowIndex, allRows } = cellCoords(activeCell);
  const colCount = row.children.length;
  const newRow = document.createElement('tr');
  for (let i = 0; i < colCount; i++) {
    const cell = document.createElement(row.children[i].tagName === 'TH' ? 'th' : 'td');
    cell.innerHTML = '&nbsp;';
    newRow.appendChild(cell);
  }

  const targetRow = beforeIndex ? row : allRows[rowIndex + 1];
  const parentSection = row.parentElement; // tbody / thead / table

  if (beforeIndex) {
    parentSection.insertBefore(newRow, row);
  } else if (targetRow && targetRow.parentElement === parentSection) {
    parentSection.insertBefore(newRow, targetRow);
  } else {
    parentSection.appendChild(newRow);
  }
  toast(beforeIndex ? 'Row inserted above.' : 'Row inserted below.');
  updateCharCount();
}

function deleteColumn() {
  if (!activeCell || !activeTable) return;
  const { colIndex, allRows } = cellCoords(activeCell);
  if (allRows[0].children.length <= 1) {
    toast("Can't delete the last column.");
    return;
  }
  allRows.forEach((row) => {
    if (row.children[colIndex]) row.removeChild(row.children[colIndex]);
  });
  hideTableToolbar();
  toast('Column deleted.');
  updateCharCount();
}

function deleteRow() {
  if (!activeCell || !activeTable) return;
  const { row, allRows } = cellCoords(activeCell);
  if (allRows.length <= 1) {
    toast("Can't delete the last row.");
    return;
  }
  row.remove();
  hideTableToolbar();
  toast('Row deleted.');
  updateCharCount();
}

function deleteTable() {
  if (!activeTable) return;
  if (!confirm('Delete this entire table?')) return;
  activeTable.remove();
  hideTableToolbar();
  toast('Table deleted.');
  updateCharCount();
}

// Wire up the floating toolbar buttons
tableToolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tt-btn');
  if (!btn) return;
  e.preventDefault();

  switch (btn.dataset.action) {
    case 'insertColLeft':  insertColumn(true);  break;
    case 'insertColRight': insertColumn(false); break;
    case 'deleteCol':      deleteColumn();      break;
    case 'insertRowAbove': insertRow(true);     break;
    case 'insertRowBelow': insertRow(false);    break;
    case 'deleteRow':      deleteRow();         break;
    case 'deleteTable':    deleteTable();       break;
  }

  // Keep editor focused so the user can keep typing
  wordEditor.focus();
});

//  Insert HR 
function insertHR() {
  execCmd('insertHTML', '<hr /><p></p>');
}

//  Clear editor
function clearEditor() {
  if (!wordEditor.innerHTML.trim() && !htmlEditor.value.trim()) return;
  if (!confirm('Clear all content?')) return;
  wordEditor.innerHTML = '';
  htmlEditor.value = '';
  updateCharCount();
  toast('Editor cleared.');
}

//  Load sample content 
function loadSample() {
  const sample = `
<h1>Welcome to WordHTML Editor</h1>
<p>This is a <strong>rich text editor</strong> that lets you write, paste, and format content, then instantly see the <em>clean HTML output</em>.</p>
<h2>What can you do here?</h2>
<ul>
  <li>Apply <strong>bold</strong>, <em>italic</em>, <u>underline</u> formatting</li>
  <li>Choose heading levels — H1 through H6</li>
  <li>Create ordered and unordered lists</li>
  <li>Insert links, tables, and horizontal rules</li>
  <li>Change font family, size, and colour</li>
  <li>Align text left, center, right, or justify</li>
</ul>
<h2>How to get HTML</h2>
<p>Switch to the <strong>HTML Source</strong> tab above. Your content is converted instantly. Use the cleaning tools to strip out unwanted attributes, styles, or empty tags.</p>
<blockquote>Tip: Paste content from Microsoft Word or Google Docs and it will preserve your formatting — then use the clean tools to tidy it up.</blockquote>
<h3>Sample Table</h3>
<table>
  <thead>
    <tr><th>Name</th><th>Role</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Developer</td><td>Active</td></tr>
    <tr><td>Bob</td><td>Designer</td><td>Active</td></tr>
    <tr><td>Carol</td><td>Manager</td><td>On leave</td></tr>
  </tbody>
</table>
<p>Ready to try? <a href="#">Click here</a> or just start typing above.</p>
`;

  wordEditor.innerHTML = sample;
  if (activeTab === 'html') htmlEditor.value = prettifyHTML(sample);
  updateCharCount();
  toast('Sample content loaded!');
}

//  HTML CLEANING  
function cleanHTML(type) {
  if (activeTab !== 'html') {
    switchTab('html');
    return;
  }

  let html = htmlEditor.value;

  switch (type) {
    case 'styles':
      // Remove all style="..." attributes
      html = html.replace(/\s*style="[^"]*"/gi, '');
      toast('Inline styles removed.');
      break;

    case 'empty':
      // Remove tags that contain only whitespace or &nbsp;
      html = html.replace(/<(\w+)[^>]*>\s*(&nbsp;|\u00a0)?\s*<\/\1>/gi, '');
      // Repeat to catch nested empties
      html = html.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '');
      toast('Empty tags removed.');
      break;

    case 'comments':
      html = html.replace(/<!--[\s\S]*?-->/g, '');
      toast('HTML comments removed.');
      break;

    case 'attrs':
      // Remove attributes except href, src, alt, colspan, rowspan
      html = html.replace(/<(\w+)([^>]*)>/gi, (match, tag, attrs) => {
        const keep = [];
        const attrRegex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi;
        let m;
        while ((m = attrRegex.exec(attrs)) !== null) {
          const name = m[1].toLowerCase();
          if (['href', 'src', 'alt', 'colspan', 'rowspan'].includes(name)) {
            keep.push(m[0]);
          }
        }
        return keep.length ? `<${tag} ${keep.join(' ')}>` : `<${tag}>`;
      });
      toast('Tag attributes removed (kept href/src/alt).');
      break;

    case 'classes':
      html = html.replace(/\s*class="[^"]*"/gi, '');
      html = html.replace(/\s*id="[^"]*"/gi, '');
      toast('Classes and IDs removed.');
      break;

    case 'all':
      html = html.replace(/<!--[\s\S]*?-->/g, '');
      html = html.replace(/\s*style="[^"]*"/gi, '');
      html = html.replace(/\s*class="[^"]*"/gi, '');
      html = html.replace(/\s*id="[^"]*"/gi, '');
      html = html.replace(/<(\w+)[^>]*>\s*(&nbsp;|\u00a0)?\s*<\/\1>/gi, '');
      html = html.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '');
      toast('Full clean applied!');
      break;
  }

  htmlEditor.value = html;
  updateCharCount();
}

// ─── Indent HTML ────────────────────────────────────
function indentHTML() {
  if (activeTab !== 'html') { switchTab('html'); return; }
  htmlEditor.value = prettifyHTML(htmlEditor.value);
  toast('HTML indented.');
}

// ─── Compress HTML ──────────────────────────────────
function compressHTML() {
  if (activeTab !== 'html') { switchTab('html'); return; }
  let html = htmlEditor.value;
  html = html.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  htmlEditor.value = html;
  toast('HTML compressed.');
}

// Copy HTML 
function copyHTML() {
  const text = activeTab === 'html' ? htmlEditor.value : prettifyHTML(wordEditor.innerHTML);
  navigator.clipboard.writeText(text).then(() => toast('HTML copied to clipboard!')).catch(() => {
    htmlEditor.select();
    document.execCommand('copy');
    toast('HTML copied!');
  });
}

// Download HTML 
function downloadHTML() {
  const body = activeTab === 'html' ? htmlEditor.value : prettifyHTML(wordEditor.innerHTML);
  const full = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document</title>
  <style>
    body { font-family: Georgia, serif; font-size: 16px; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ccc; padding: 8px 12px; }
    th { background: #f3f4f6; }
    blockquote { border-left: 4px solid #2563eb; padding: 8px 16px; margin: 12px 0; background: #eff6ff; font-style: italic; }
    pre { background: #111; color: #a5f3b4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    a { color: #2563eb; }
    hr { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
  downloadFile('document.html', full, 'text/html');
}

//  Download plain text 
function downloadText() {
  const text = wordEditor.innerText || '';
  downloadFile('document.txt', text, 'text/plain');
}

//  File download helper 
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Downloaded as ${name}`);
}

//  Prettify / indent HTML 
function prettifyHTML(html) {
  if (!html || !html.trim()) return '';

  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const INLINE = new Set(['a','abbr','acronym','b','bdo','big','br','button','cite','code','dfn','em','i','img','input','kbd','label','map','object','output','q','samp','select','small','span','strong','sub','sup','textarea','time','tt','u','var']);

  let result = '';
  let depth = 0;

  // Tokenise
  const tokens = [];
  const re = /(<[^>]+>)|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) tokens.push({ type: 'tag', value: m[1] });
    else if (m[2] && m[2].trim()) tokens.push({ type: 'text', value: m[2].trim() });
  }

  function pad(n) { return '  '.repeat(Math.max(0, n)); }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'text') {
      result += pad(depth) + t.value + '\n';
      continue;
    }

    const tag = t.value;
    const tagName = (tag.match(/<\/?(\w+)/) || [])[1] || '';
    const lower = tagName.toLowerCase();
    const isClose = tag.startsWith('</');
    const isSelf = tag.endsWith('/>') || VOID.has(lower);
    const isInline = INLINE.has(lower);

    if (isInline) {
      result += pad(depth) + tag + '\n';
      continue;
    }

    if (isClose) {
      depth = Math.max(0, depth - 1);
      result += pad(depth) + tag + '\n';
    } else if (isSelf) {
      result += pad(depth) + tag + '\n';
    } else {
      result += pad(depth) + tag + '\n';
      depth++;
    }
  }

  return result.trim();
}

//  Toast notification 
let toastEl = null;
let toastTimer = null;

function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

//  Keyboard shortcuts 
document.addEventListener('keydown', (e) => {
  // Tab key inside word editor → insert spaces
  if (e.key === 'Tab' && document.activeElement === wordEditor) {
    e.preventDefault();
    execCmd('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
  }
});

//  Paste clean text from clipboard (optional) 
wordEditor.addEventListener('paste', (e) => {
  // Allow default paste (preserves rich formatting from Word/Docs)
  // We let the browser handle it natively so styles come through
});

//  Init
updateCharCount();
