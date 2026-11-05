const $ = id => document.getElementById(id);
const source = $('source');
const style = $('style');
const ratio = $('ratio');
const language = $('language');
const poster = $('poster');
const status = $('status');
const toolbar = $('editor-toolbar');

let backgroundData = '';
let subjectAssets = [];
let subjectAssetCatalog = [];
let subjectPlan = null;
let plan = null;
let editorObjects = {};
let defaultObjects = {};
let selectedObject = 'title';
let needsRegenerate = false;
let activeDrag = null;
let editHistory = [];
let historyIndex = -1;
let historyTimer = null;
let restoringHistory = false;

const ratioSizes = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '2:3': [1080, 1620],
  '3:4': [1080, 1440],
  '9:16': [1024, 1824],
  '16:9': [1600, 900]
};
const fontOptions = {
  title: { family: "Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", color: '#fffaf2', shadow: true, letterSpacing: -1, lineHeight: 1.08 },
  subtitle: { family: "Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", color: '#d9e7c2', shadow: true, letterSpacing: 1.2, lineHeight: 1.25 },
  details: { family: "Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", color: '#fffaf2', shadow: true, letterSpacing: 0, lineHeight: 1.35 }
};
const styleClass = name => 'style-' + String(name || 'auto').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const styleLabels = {
  'Auto recommend': '자동 추천',
  'Public Campaign Cinematic': '공익 캠페인 시네마틱',
  'Minimal Still Life': '미니멀 정물',
  'Human-centered Documentary': '인물 중심 다큐멘터리',
  'Editorial Campaign': '에디토리얼 캠페인'
};

source.addEventListener('input', () => $('char-count').textContent = `${source.value.length} / 5000`);

function captureEditState() {
  return {
    title: $('title').value,
    subtitle: $('subtitle').value,
    details: $('details').value,
    editorObjects: structuredClone(editorObjects),
    subjectIds: subjectAssets.map(asset => asset.id),
    selectedObject
  };
}

function updateHistoryButtons() {
  $('undo-button').disabled = historyIndex <= 0;
  $('redo-button').disabled = historyIndex < 0 || historyIndex >= editHistory.length - 1;
}

function recordEditState() {
  if (restoringHistory || !plan || !backgroundData) return;
  clearTimeout(historyTimer);
  historyTimer = null;
  const state = captureEditState();
  const previous = editHistory[historyIndex];
  if (previous && JSON.stringify(previous) === JSON.stringify(state)) return;
  editHistory = editHistory.slice(0, historyIndex + 1);
  editHistory.push(state);
  if (editHistory.length > 100) editHistory.shift();
  historyIndex = editHistory.length - 1;
  updateHistoryButtons();
}

function scheduleEditState() {
  if (restoringHistory || !plan || !backgroundData) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(recordEditState, 350);
}

function resetEditHistory() {
  clearTimeout(historyTimer);
  editHistory = [captureEditState()];
  historyIndex = 0;
  updateHistoryButtons();
}

function restoreEditState(state) {
  if (!state) return;
  restoringHistory = true;
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('details').value = state.details;
  editorObjects = structuredClone(state.editorObjects);
  selectedObject = state.selectedObject;
  subjectAssets = (state.subjectIds || []).map(id => subjectAssetCatalog.find(asset => asset.id === id)).filter(Boolean);
  $('editor-target').value = selectedObject;
  layoutTextObjects();
  $('editor-target').value = selectedObject;
  updatePoster();
  setImageOptions();
  restoringHistory = false;
}

function undoEdit() {
  clearTimeout(historyTimer);
  historyTimer = null;
  recordEditState();
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreEditState(editHistory[historyIndex]);
  updateHistoryButtons();
}

function redoEdit() {
  clearTimeout(historyTimer);
  historyTimer = null;
  recordEditState();
  if (historyIndex >= editHistory.length - 1) return;
  historyIndex += 1;
  restoreEditState(editHistory[historyIndex]);
  updateHistoryButtons();
}

function setStatus(message, error = false) {
  status.querySelector('span:last-child').textContent = message;
  status.classList.toggle('error', error);
}

function updateFrame() {
  const chosen = style.value === 'Auto recommend' ? (plan?.recommended_style || 'Auto recommend') : style.value;
  poster.className = `poster ratio-${ratio.value.replace(':', '-')} ${styleClass(chosen)}`;
  $('ratio-label').textContent = `${ratio.value} ${ratio.value === '16:9' ? 'LANDSCAPE' : 'PORTRAIT'} · ${language.value.toUpperCase()}`;
}

function escapeXml(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

function wrapLines(text, maxChars) {
  const lines = [];
  for (const part of String(text ?? '').split('\n')) {
    let line = '';
    for (const char of Array.from(part)) {
      line += char;
      if (Array.from(line).length >= maxChars) {
        lines.push(line);
        line = '';
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function isSubjectObject(id) { return /^subject-\d+$/.test(id || ''); }

function getSubjectAsset(id) { return subjectAssets.find(asset => asset.id === id); }

function getSubjectPlan(data) {
  const subject = data.subject;
  if (subject && typeof subject === 'object' && subject.prompt) {
    return { ...subject, id: 'subject-1', name: subject.name || '캠페인 상징 피사체' };
  }
  const brief = `${data.title || ''} ${data.subtitle || ''} ${source.value}`;
  if (/무단횡단|횡단보도|보행자.?사고|보행.?안전|교통.?안전/.test(brief)) {
    return { id: 'subject-1', name: '무단횡단 보행자', idea: '신호를 무시하고 차도로 들어서는 보행자', prompt: 'A single young adult pedestrian stepping into a crosswalk against a red pedestrian signal, full body, clear recognizable pose.' };
  }
  const basePrompt = String(data.subject_prompt || `${source.value}.`).trim();
  return { id: 'subject-1', name: '캠페인 상징 피사체', idea: '캠페인 메시지를 가장 잘 나타내는 핵심 피사체', prompt: `${basePrompt}. Create exactly one clear, recognizable subject directly related to the campaign message.` };
}

function refreshTextLineOptions() {
  const select = $('editor-target');
  const selected = select.value;
  select.querySelectorAll('option[data-line-option]').forEach(option => option.remove());
  select.querySelectorAll('option[value="title"],option[value="subtitle"],option[value="details"]').forEach(option => option.remove());
  const groups = [
    ['title', '제목'],
    ['subtitle', '부제목'],
    ['details', '상세 정보']
  ];
  const fragment = document.createDocumentFragment();
  for (const [key, label] of groups) {
    const lineIds = Object.keys(editorObjects).filter(id => id.startsWith(`${key}-line-`)).sort((a, b) => Number(a.slice(a.lastIndexOf('-') + 1)) - Number(b.slice(b.lastIndexOf('-') + 1)));
    for (const id of lineIds) {
      const option = document.createElement('option');
      option.value = id;
      option.dataset.lineOption = 'true';
      option.textContent = `${label} ${id.slice(id.lastIndexOf('-') + 1)}번째 줄`;
      fragment.append(option);
    }
  }
  select.insertBefore(fragment, select.querySelector('[data-subject-placeholder]'));
  if ([...select.options].some(option => option.value === selected && !option.disabled)) select.value = selected;
  else {
    const fallback = [...select.options].find(option => !option.disabled);
    if (fallback) select.value = fallback.value;
  }
  selectedObject = select.value || selectedObject;
}

function layoutTextObjects() {
  const [width, height] = ratioSizes[ratio.value] || ratioSizes['2:3'];
  const marginX = Math.round(width * .07);
  const maxWidth = width - marginX * 2;
  let detailSize = Math.max(19, Math.round(width * .022));
  let subtitleSize = Math.max(17, Math.round(width * .017));
  let titleSize = Math.round(width * .067);
  let titleLines = [];
  let subtitleLines = [];
  let detailLines = [];
  let titleLineHeight = 0;
  let titleY = 0;
  let subtitleY = 0;
  let detailsY = 0;
  const gap = Math.max(30, Math.round(height * .03));

  for (let attempt = 0; attempt < 36; attempt++) {
    detailLines = wrapLines($('details').value, Math.max(10, Math.floor(maxWidth / (detailSize * .95))));
    subtitleLines = wrapLines($('subtitle').value, Math.max(8, Math.floor(maxWidth / (subtitleSize * .9))));
    titleLines = wrapLines($('title').value, Math.max(5, Math.floor(maxWidth / (titleSize * .92))));
    titleLineHeight = titleSize * 1.12;
    const detailLineHeight = detailSize * 1.38;
    detailsY = height - Math.round(height * .075) - (detailLines.length - 1) * detailLineHeight;
    const titleLastY = detailsY - detailSize * 1.25 - gap;
    titleY = titleLastY - (titleLines.length - 1) * titleLineHeight;
    const subtitleLastY = titleY - titleSize * .82 - Math.round(height * .018);
    subtitleY = subtitleLastY - (subtitleLines.length - 1) * subtitleSize * 1.25;
    if (subtitleY >= height * .15 || (titleSize <= width * .035 && detailSize <= 14)) break;
    titleSize = Math.max(width * .035, titleSize - 2);
    detailSize = Math.max(14, detailSize - 1);
    subtitleSize = Math.max(14, subtitleSize - 1);
  }

  const activeStyles = editorObjects;
  const positions = {
    title: { x: marginX, y: titleY, fontSize: titleSize },
    subtitle: { x: marginX, y: subtitleY, fontSize: subtitleSize },
    details: { x: marginX, y: detailsY, fontSize: detailSize }
  };
  for (const key of ['title', 'subtitle', 'details']) {
    const old = activeStyles[key] || {};
    activeStyles[key] = { ...positions[key], ...fontOptions[key], ...old, x: positions[key].x, y: positions[key].y, fontSize: positions[key].fontSize };
  }
  const linesByKey = { title: titleLines, subtitle: subtitleLines, details: detailLines };
  for (const key of Object.keys(linesByKey)) {
    const base = activeStyles[key];
    const lines = linesByKey[key];
    lines.forEach((line, index) => {
      const lineId = `${key}-line-${index + 1}`;
      const previous = activeStyles[lineId] || {};
      activeStyles[lineId] = { ...base, ...previous, x: previous.x ?? base.x, y: previous.y ?? base.y + index * base.fontSize * base.lineHeight, rotation: previous.rotation ?? 0 };
    });
    for (const id of Object.keys(activeStyles)) {
      if (id.startsWith(`${key}-line-`) && Number(id.slice(`${key}-line-`.length)) > lines.length) delete activeStyles[id];
    }
  }
  refreshTextLineOptions();
  return { width, height, marginX, maxWidth, titleLines, detailLines };
}

function textGroup(id, object, lines) {
  return lines.map((line, index) => {
    const lineId = `${id}-line-${index + 1}`;
    const item = editorObjects[lineId] || { ...object, y: object.y + index * object.fontSize * object.lineHeight, rotation: 0 };
    const transform = `translate(${item.x} ${item.y}) rotate(${item.rotation || 0})`;
    const filter = item.shadow ? ' filter="url(#soft-shadow)"' : '';
    return `<g id="editable-${lineId}" class="editable-object" data-editable-object="${lineId}" data-x="${item.x}" data-y="${item.y}" transform="${transform}"><text x="0" y="0" font-family="${escapeXml(item.family)}" font-size="${item.fontSize}" font-weight="${id === 'title' ? 700 : 500}" letter-spacing="${item.letterSpacing}" line-height="${item.lineHeight}" fill="${item.color}"${filter}>${escapeXml(line)}</text></g>`;
  }).join('');
}

function imageGroup(id, asset, object, width, height) {
  if (!asset || !object) return '';
  const displayWidth = object.width * object.scale / 100;
  const displayHeight = object.height * object.scale / 100;
  const rotation = object.rotation || 0;
  return `<g id="editable-${id}" class="editable-image-object" data-editable-object="${id}" data-x="${object.x}" data-y="${object.y}" data-width="${displayWidth}" data-height="${displayHeight}" transform="translate(${object.x} ${object.y}) rotate(${rotation} ${displayWidth / 2} ${displayHeight / 2})"><image x="0" y="0" width="${displayWidth}" height="${displayHeight}" preserveAspectRatio="none" href="${asset.data}"/></g>`;
}

function makeSvg(exportSize = false) {
  if (!backgroundData || !plan) return '';
  const [width, height] = ratioSizes[ratio.value] || ratioSizes['2:3'];
  const marginX = Math.round(width * .07);
  const maxWidth = width - marginX * 2;
  const svgWidth = exportSize ? width : '100%';
  const svgHeight = exportSize ? height : '100%';
  const subjectNodes = subjectAssets.map(asset => imageGroup(asset.id, asset, editorObjects[asset.id], width, height)).join('');
  const titleMaxChars = Math.max(5, Math.floor(maxWidth / (editorObjects.title.fontSize * .92)));
  const subtitleMaxChars = Math.max(8, Math.floor(maxWidth / (editorObjects.subtitle.fontSize * .9)));
  const detailsMaxChars = Math.max(10, Math.floor(maxWidth / (editorObjects.details.fontSize * .95)));
  const titleLines = wrapLines($('title').value, titleMaxChars);
  const subtitleLines = wrapLines($('subtitle').value, subtitleMaxChars);
  const detailLines = wrapLines($('details').value, detailsMaxChars);
  const titleText = textGroup('title', editorObjects.title, titleLines);
  const subtitleText = textGroup('subtitle', editorObjects.subtitle, subtitleLines);
  const detailText = textGroup('details', editorObjects.details, detailLines);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="poster-artwork"><defs><linearGradient id="poster-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#090b0c" stop-opacity=".14"/><stop offset="43%" stop-color="#090b0c" stop-opacity=".02"/><stop offset="100%" stop-color="#070909" stop-opacity=".72"/></linearGradient><filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity=".55"/></filter></defs><g id="01-background" inkscape:label="Background"><image id="background-image" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="${backgroundData}"/></g>${subjectNodes}<rect id="poster-shading" x="0" y="0" width="${width}" height="${height}" fill="url(#poster-shade)" pointer-events="none"/><g id="03-typography" inkscape:label="Typography">${subtitleText}${titleText}${detailText}</g></svg>`;
}

function updateSelectionOutline() {
  const svg = poster.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll('.editable-object,.editable-image-object').forEach(node => node.classList.toggle('is-selected', node.dataset.editableObject === selectedObject));
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function bindObjectDragging() {
  const svg = poster.querySelector('svg');
  if (!svg) return;
  svg.addEventListener('dblclick', event => {
    const target = event.target.closest('[data-editable-object]');
    if (!target || !/^(title|subtitle|details)-line-\d+$/.test(target.dataset.editableObject)) return;
    event.preventDefault();
    event.stopPropagation();
    selectedObject = target.dataset.editableObject;
    $('editor-target').value = selectedObject;
    setImageOptions();
    openInlineTextEditor(target);
  });
  svg.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-editable-object]');
    if (!target) return;
    if (event.detail > 1 && /^(title|subtitle|details)-line-\d+$/.test(target.dataset.editableObject)) return;
    selectedObject = target.dataset.editableObject;
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    $('editor-target').value = selectedObject;
    setImageOptions();
    updateSelectionOutline();
    const point = svgPoint(svg, event);
    activeDrag = { pointerId: event.pointerId, target, point, x: Number(target.dataset.x), y: Number(target.dataset.y) };
    target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  svg.addEventListener('pointermove', event => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const point = svgPoint(svg, event);
    const [width, height] = ratioSizes[ratio.value];
    const object = editorObjects[selectedObject];
    const objectWidth = object?.width ? object.width * (object.scale || 100) / 100 : 0;
    const objectHeight = object?.height ? object.height * (object.scale || 100) / 100 : 0;
    const x = clamp(activeDrag.x + point.x - activeDrag.point.x, 0, Math.max(0, width - objectWidth));
    const y = clamp(activeDrag.y + point.y - activeDrag.point.y, Math.min(90, height), Math.max(height - 24, objectHeight));
    if (object) { object.x = x; object.y = y; }
    activeDrag.target.dataset.x = x;
    activeDrag.target.dataset.y = y;
    const rotation = object?.rotation || 0;
    const centerX = object?.width ? object.width * (object.scale || 100) / 200 : 0;
    const centerY = object?.height ? object.height * (object.scale || 100) / 200 : 0;
    activeDrag.target.setAttribute('transform', `translate(${x} ${y}) rotate(${rotation}${object?.width ? ` ${centerX} ${centerY}` : ''})`);
  });
  const finishDrag = event => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    if (isSubjectObject(selectedObject)) {
      const asset = getSubjectAsset(selectedObject);
      if (asset) { asset.x = editorObjects[selectedObject].x; asset.y = editorObjects[selectedObject].y; }
    }
    activeDrag = null;
    recordEditState();
  };
  svg.addEventListener('pointerup', finishDrag);
  svg.addEventListener('pointercancel', finishDrag);
}

function openInlineTextEditor(target) {
  const objectId = target.dataset.editableObject;
  const group = objectId.match(/^(title|subtitle|details)-line-/)?.[1];
  const textNode = target.querySelector('text');
  if (!group || !textNode) return;
  const oldText = textNode.textContent;
  const rect = textNode.getBoundingClientRect();
  const editor = document.createElement('input');
  editor.type = 'text';
  editor.className = 'poster-inline-editor';
  editor.value = oldText;
  editor.setAttribute('aria-label', '선택한 포스터 문구 편집');
  editor.style.left = `${Math.max(8, rect.left - 5)}px`;
  editor.style.top = `${Math.max(8, rect.top - 4)}px`;
  editor.style.width = `${Math.min(window.innerWidth - Math.max(8, rect.left - 5) - 8, Math.max(180, rect.width + 100))}px`;
  editor.style.height = `${Math.max(38, rect.height + 12)}px`;
  document.body.append(editor);
  editor.focus();
  editor.select();
  let finished = false;
  const close = save => {
    if (finished) return;
    finished = true;
    const newText = editor.value.trim();
    editor.remove();
    if (!save || !newText || newText === oldText) return;
    const input = $(group);
    const sourceText = input.value;
    const lineIndex = Number(objectId.slice(objectId.lastIndexOf('-') + 1)) - 1;
    const maxChars = group === 'title' ? Math.max(5, Math.floor((ratioSizes[ratio.value][0] * .86) / (editorObjects[group].fontSize * .92)))
      : group === 'subtitle' ? Math.max(8, Math.floor((ratioSizes[ratio.value][0] * .86) / (editorObjects[group].fontSize * .9)))
        : Math.max(10, Math.floor((ratioSizes[ratio.value][0] * .86) / (editorObjects[group].fontSize * .95)));
    const visualLines = sourceText.split('\n').flatMap(line => wrapLines(line, maxChars));
    const sourceLine = visualLines[lineIndex] || oldText;
    input.value = sourceText.replace(sourceLine, newText);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setStatus('선택한 문구를 수정했어요. 툴바에서 글꼴, 크기, 색상 등을 조정할 수 있어요.');
  };
  editor.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); close(true); }
    if (event.key === 'Escape') { event.preventDefault(); close(false); }
  });
  editor.addEventListener('blur', () => close(true), { once: true });
}

function updatePoster() {
  if (!plan) {
    $('poster-title').textContent = $('title').value || '아이디어를\n포스터로';
    $('poster-subtitle').textContent = $('subtitle').value || 'A NEW CREATIVE PROJECT';
    $('poster-details').textContent = $('details').value || '내용을 입력하고\n구성안을 만들어 보세요.';
    return;
  }
  if (backgroundData) {
    poster.innerHTML = makeSvg(false);
    bindObjectDragging();
    updateSelectionOutline();
  } else {
    $('poster-title').textContent = $('title').value || 'Headline';
    $('poster-subtitle').textContent = $('subtitle').value || ' ';
    $('poster-details').textContent = $('details').value || ' ';
  }
}

function syncToolbar() {
  if (!editorObjects[selectedObject]) return;
  const isText = /^(title|subtitle|details)-line-\d+$/.test(selectedObject);
  $('text-tools').hidden = !isText;
  $('image-tools').hidden = isText;
  if (isText) {
    const object = editorObjects[selectedObject];
    $('editor-font').value = object.family;
    $('editor-size').value = Math.round(object.fontSize);
    $('editor-line-height').value = Number(object.lineHeight.toFixed(2));
    $('editor-letter-spacing').value = object.letterSpacing;
    $('editor-color').value = object.color;
    $('editor-shadow').checked = object.shadow;
  } else {
    const object = editorObjects[selectedObject];
    const scale = object.scale || 100;
    $('editor-image-scale').value = scale;
    $('editor-image-scale-label').textContent = `${Math.round(scale)}%`;
  }
  const rotation = editorObjects[selectedObject].rotation || 0;
  $('editor-rotation').value = rotation;
  $('editor-rotation-label').textContent = `${Math.round(rotation)}°`;
}

function resetSelectedObject() {
  const initial = defaultObjects[selectedObject];
  if (!initial || !editorObjects[selectedObject]) return;
  editorObjects[selectedObject] = { ...initial };
  if (isSubjectObject(selectedObject)) {
    const asset = getSubjectAsset(selectedObject);
    if (asset) { asset.x = initial.x; asset.y = initial.y; asset.scale = initial.scale; }
  }
  syncToolbar();
  updatePoster();
  scheduleEditState();
}

function getVisualTextLineRange(text, maxChars, targetIndex) {
  let visualIndex = 0;
  let sourceOffset = 0;
  for (const paragraph of String(text).split('\n')) {
    let paragraphOffset = 0;
    for (const chunk of wrapLines(paragraph, maxChars)) {
      if (visualIndex === targetIndex) return { start: sourceOffset + paragraphOffset, end: sourceOffset + paragraphOffset + chunk.length };
      paragraphOffset += chunk.length;
      visualIndex += 1;
    }
    sourceOffset += paragraph.length + 1;
  }
  return null;
}

function deleteSelectedObject() {
  if (isSubjectObject(selectedObject)) {
    const asset = getSubjectAsset(selectedObject);
    if (!asset) return;
    subjectAssets = subjectAssets.filter(item => item.id !== selectedObject);
    delete editorObjects[selectedObject];
    selectedObject = 'title-line-1';
    $('editor-target').value = selectedObject;
    updatePoster();
    setImageOptions();
    setStatus(`피사체 “${asset.name}”을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요.`);
    recordEditState();
    return;
  }

  const match = selectedObject.match(/^(title|subtitle|details)-line-(\d+)$/);
  if (!match) return;
  const [, group, lineNumber] = match;
  const [width] = ratioSizes[ratio.value];
  const base = editorObjects[group];
  const factor = group === 'title' ? .92 : group === 'subtitle' ? .9 : .95;
  const minimum = group === 'title' ? 5 : group === 'subtitle' ? 8 : 10;
  const maxChars = Math.max(minimum, Math.floor((width * .86) / (base.fontSize * factor)));
  const input = $(group);
  const range = getVisualTextLineRange(input.value, maxChars, Number(lineNumber) - 1);
  if (!range || range.start === range.end) return;
  input.value = input.value.slice(0, range.start) + input.value.slice(range.end);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setStatus('선택한 문구 줄을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요.');
  recordEditState();
}

function setTextStyle(key, value) {
  if (!editorObjects[key]) return;
  const object = editorObjects[key];
  object.family = $('editor-font').value;
  object.fontSize = clamp(Number($('editor-size').value) || object.fontSize, 12, 180);
  object.lineHeight = clamp(Number($('editor-line-height').value) || object.lineHeight, .8, 2.4);
  object.letterSpacing = clamp(Number($('editor-letter-spacing').value) || 0, -12, 40);
  object.color = $('editor-color').value;
  object.shadow = $('editor-shadow').checked;
  updatePoster();
  scheduleEditState();
}

function updateImageScale() {
  const object = editorObjects[selectedObject];
  if (!object || !object.width) return;
  object.scale = Number($('editor-image-scale').value);
  if (isSubjectObject(selectedObject)) {
    const asset = getSubjectAsset(selectedObject);
    if (asset) asset.scale = object.scale;
  }
  $('editor-image-scale-label').textContent = `${object.scale}%`;
  updatePoster();
  scheduleEditState();
}

function updateRotation() {
  const object = editorObjects[selectedObject];
  if (!object) return;
  object.rotation = Number($('editor-rotation').value);
  $('editor-rotation-label').textContent = `${object.rotation}°`;
  updatePoster();
  scheduleEditState();
}

function renderSubjectDownloads() {
  const container = $('subject-downloads');
  container.replaceChildren();
  for (const asset of subjectAssets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${asset.name} PNG`;
    button.disabled = !backgroundData;
    button.addEventListener('click', () => saveDataUrl(asset.data, `${asset.id}-${asset.name.replace(/[^가-힣a-z0-9]+/gi, '-')}.png`));
    container.append(button);
  }
}

function setImageOptions() {
  const select = $('editor-target');
  const placeholder = select.querySelector('[data-subject-placeholder]');
  select.querySelectorAll('option[data-subject-option]').forEach(option => option.remove());
  for (const asset of subjectAssets) {
    const option = document.createElement('option');
    option.value = asset.id;
    option.dataset.subjectOption = 'true';
    option.textContent = asset.name;
    select.insertBefore(option, placeholder);
  }
  placeholder.disabled = subjectAssets.length > 0;
  placeholder.hidden = subjectAssets.length > 0;
  if (![...select.options].some(option => option.value === selectedObject && !option.disabled)) {
    selectedObject = [...select.options].find(option => !option.disabled)?.value || 'title-line-1';
  }
  select.value = selectedObject;
  refreshTextLineOptions();
  toolbar.hidden = !backgroundData;
  $('background-button').disabled = !backgroundData;
  renderSubjectDownloads();
  $('element-svg-button').disabled = !backgroundData || !editorObjects[selectedObject];
  $('element-png-button').disabled = !backgroundData || !editorObjects[selectedObject];
  $('psd-button').disabled = !backgroundData || !window.agPsd?.writePsd;
  syncToolbar();
}

[ratio, language].forEach(element => element.addEventListener('change', () => {
  updateFrame();
  if (plan && element === ratio) layoutTextObjects();
  if (backgroundData && element === ratio) {
    needsRegenerate = true;
    $('svg-button').disabled = true;
    $('png-button').disabled = true;
    setStatus('비율을 바꿨어요. 새 비율에 맞는 결과를 만들려면 이미지 레이어를 다시 생성해 주세요.');
  }
  updatePoster();
}));

style.addEventListener('change', () => {
  updateFrame();
  if (plan && style.value !== 'Auto recommend') {
    $('recommended-style').textContent = styleLabels[style.value] || style.value;
    $('style-reason').textContent = '직접 선택한 이미지 방향이에요. 설명을 원하는 대로 다듬어 보세요.';
    $('recommendation').classList.remove('hidden');
  }
  if (backgroundData) {
    needsRegenerate = true;
    $('svg-button').disabled = true;
    $('png-button').disabled = true;
    setStatus('스타일을 바꿨어요. 새 스타일을 적용하려면 이미지 레이어를 다시 생성해 주세요.');
  }
});

['title', 'subtitle', 'details'].forEach(key => $(key).addEventListener('input', () => {
  if (backgroundData) layoutTextObjects();
  updatePoster();
  if (backgroundData) {
    setImageOptions();
    scheduleEditState();
  }
}));
['background-prompt'].forEach(key => $(key).addEventListener('input', updatePoster));

$('plan-button').addEventListener('click', async () => {
  if (source.value.trim().length < 8) return setStatus('포스터로 만들 내용을 조금 더 적어 주세요.', true);
  const button = $('plan-button');
  button.disabled = true;
  button.querySelector('span').textContent = '구성안을 만들고 있어요…';
  setStatus('AI가 공익광고 문구와 배경·상징 피사체 리소스를 계획하고 있어요.');
  try {
    const response = await fetch('/api/plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source.value, style: style.value, ratio: ratio.value, language: language.value })
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '구성안 생성에 실패했어요.');
    plan = data;
    $('title').value = data.title;
    $('subtitle').value = data.subtitle;
    $('details').value = (data.details || []).join('\n');
    $('background-prompt').value = data.background_prompt;
    subjectPlan = getSubjectPlan(data);
    $('recommended-style').textContent = styleLabels[data.recommended_style] || data.recommended_style;
    $('style-reason').textContent = data.style_reason;
    $('recommendation').classList.remove('hidden');
    $('copy-editor').classList.remove('hidden');
    $('review-callout').hidden = false;
    $('copy-editor').classList.add('review-ready');
    layoutTextObjects();
    $('result-title').textContent = '미리보기와 저장';
    $('result-sub').textContent = '왼쪽 아래의 구성안을 확인한 뒤 이미지 리소스를 생성하세요.';
    setStatus('날짜·장소·기관명 등 사실 정보를 확인한 뒤, 배경과 상징 피사체 리소스를 생성해 주세요.');
    $('copy-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = '구성안 만들기';
  }
});

async function generateAsset(role, prompt) {
  const response = await fetch('/api/generate-layer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, prompt, ratio: ratio.value })
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `${role === 'subject' ? '상징 피사체' : '배경'} 생성에 실패했어요.`);
  return data.image;
}

function trimTransparent(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 10) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      if (maxX < 0) return reject(new Error('이미지 레이어가 비어 있어요. 다시 생성해 주세요.'));
      if (minX === 0 && minY === 0 && maxX === canvas.width - 1 && maxY === canvas.height - 1) {
        return reject(new Error('투명 배경 레이어로 만들지 못했어요. 설명을 수정하거나 해당 옵션을 꺼 주세요.'));
      }
      const margin = Math.round(Math.min(canvas.width, canvas.height) * .018);
      const x = Math.max(0, minX - margin), y = Math.max(0, minY - margin);
      const right = Math.min(canvas.width, maxX + margin), bottom = Math.min(canvas.height, maxY + margin);
      const crop = document.createElement('canvas');
      crop.width = right - x; crop.height = bottom - y;
      crop.getContext('2d').drawImage(canvas, x, y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      resolve({ data: crop.toDataURL('image/png'), x: x / canvas.width, y: y / canvas.height, width: crop.width / canvas.width, height: crop.height / canvas.height });
    };
    image.onerror = () => reject(new Error('생성된 PNG 레이어를 읽지 못했어요.'));
    image.src = dataUrl;
  });
}

function createImageObject(asset, width, height, kind, positionIndex = 0, subjectCount = 1) {
  const isSubject = kind === 'subject';
  const match = kind.match(/^art-(title|subtitle|details)-line-(\d+)$/);
  const textKey = match ? `${match[1]}-line-${match[2]}` : '';
  const textObject = textKey ? editorObjects[textKey] : null;
  const maxWidth = isSubject ? width * (subjectCount > 1 ? .78 / subjectCount : .58) : width * .86;
  const maxHeight = isSubject ? height * (subjectCount > 1 ? .27 : .36) : textObject ? textObject.fontSize * 1.65 : height * .19;
  const aspect = asset.width / asset.height;
  const objectWidth = Math.min(maxWidth, maxHeight * aspect);
  const objectHeight = objectWidth / aspect;
  const subjectX = subjectCount > 1 ? width * (positionIndex + .5) / subjectCount - objectWidth / 2 : Math.round(asset.x * width);
  const subjectY = subjectCount > 1 ? height * .42 - objectHeight / 2 : Math.round(asset.y * height);
  return {
    x: isSubject ? Math.round(subjectX) : textObject ? Math.round(textObject.x) : Math.round((width - objectWidth) / 2),
    y: isSubject ? Math.round(subjectY) : textObject ? Math.round(textObject.y - textObject.fontSize * .9) : Math.round(height * .43),
    width: objectWidth,
    height: objectHeight,
    scale: 100
  };
}

$('generate-button').addEventListener('click', async () => {
  if (!plan) return;
  $('review-callout').hidden = true;
  $('copy-editor').classList.remove('review-ready');
  const button = $('generate-button');
  button.disabled = true;
  button.querySelector('span').textContent = '레이어를 생성하고 있어요…';
  const chosenSubjects = subjectPlan ? [subjectPlan] : [];
  backgroundData = '';
  subjectAssets = [];
  subjectAssetCatalog = [];
  for (const id of Object.keys(editorObjects)) if (isSubjectObject(id)) delete editorObjects[id];
  for (const id of ['svg-button', 'png-button', 'psd-button', 'background-button', 'element-svg-button', 'element-png-button']) $(id).disabled = true;
  editHistory = [];
  historyIndex = -1;
  updateHistoryButtons();
  setImageOptions();
  needsRegenerate = false;
  $('svg-button').disabled = true;
  $('png-button').disabled = true;
  poster.innerHTML = '<div class="generation-state"><span class="loader"></span><b>캠페인 이미지 리소스를 만들고 있어요</b><small>배경과 핵심 피사체 하나를 각각 별도 이미지 요청으로 생성합니다.</small></div>';
  let activeSubjectName = '';
  try {
    const selectedStyle = style.value === 'Auto recommend' ? plan.recommended_style : style.value;
    const [width, height] = ratioSizes[ratio.value];
    setStatus('캠페인 배경 생성 중… AI 이미지 생성 API 비용은 개발자에게 발생합니다.');
    backgroundData = await generateAsset('background', `${$('background-prompt').value}. Create a restrained public-service campaign background only. Use a realistic, quiet environment or tactile surface and a simple visual metaphor; leave generous negative space for editable typography. No subject, text, lettering, numbers, logos, watermarks, signage, decorative clutter, or competing focal points. Visual direction: ${selectedStyle}. ${ratio.value} composition.`);

    for (const [index, option] of chosenSubjects.entries()) {
      activeSubjectName = option.name;
      setStatus(`피사체 ${index + 1}/${chosenSubjects.length} 생성 중: ${option.name}… AI 이미지 생성 API 비용은 개발자에게 발생합니다.`);
      const rawSubject = await generateAsset('subject', `Create this selected campaign asset and nothing else: ${option.name}. Concept: ${option.idea}. Follow this visual description exactly: ${option.prompt}. The named subject must be clearly recognizable and must remain the main subject. Do not replace it with a different object, person, metaphor, or interpretation. Create exactly one isolated subject, full silhouette visible, on a transparent background. No scenery, text, letters, logos, watermarks, extra objects, or competing details. Clean, readable silhouette; restrained detail. Visual direction: ${selectedStyle}.`);
      const trimmed = await trimTransparent(rawSubject);
      const asset = { ...trimmed, id: option.id, name: option.name, idea: option.idea };
      subjectAssets.push(asset);
      subjectAssetCatalog.push(asset);
    }
    subjectAssets.forEach((asset, index) => {
      editorObjects[asset.id] = createImageObject(asset, width, height, 'subject', index, subjectAssets.length);
    });

    layoutTextObjects();
    defaultObjects = structuredClone(editorObjects);
    updatePoster();
    setImageOptions();
    resetEditHistory();
    $('svg-button').disabled = false;
    $('png-button').disabled = false;
    $('result-title').textContent = '디자인 리소스가 준비됐어요';
    $('result-sub').textContent = '문구와 생성된 리소스를 각각 편집하거나 다운로드할 수 있어요.';
    const layers = ['배경', subjectAssets.length ? `피사체 ${subjectAssets.length}개` : ''].filter(Boolean).join('·');
    setStatus(`완성! ${layers} 리소스를 만들었어요. 필요한 요소를 각각 내려받아 디자인에 활용하세요.`);
  } catch (error) {
    if (backgroundData) {
      subjectAssets.forEach((asset, index) => {
        editorObjects[asset.id] = createImageObject(asset, ...ratioSizes[ratio.value], 'subject', index, subjectAssets.length);
      });
      layoutTextObjects();
      updatePoster();
      setImageOptions();
      resetEditHistory();
      $('svg-button').disabled = false;
      $('png-button').disabled = false;
      $('result-title').textContent = '일부 이미지 리소스가 준비되지 않았어요';
      $('result-sub').textContent = '생성된 배경은 PNG, 문구와 전체 구성은 SVG로 받을 수 있어요.';
    }
    setStatus(activeSubjectName ? `${activeSubjectName} 피사체 생성에 실패했어요: ${error.message}` : error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = '캠페인 이미지 리소스 생성';
  }
});

function saveBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1200);
}

function saveDataUrl(dataUrl, name) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = name;
  link.click();
}

function selectedElementSvg() {
  const parser = new DOMParser();
  const sourceSvg = parser.parseFromString(makeSvg(true), 'image/svg+xml').documentElement;
  const target = [...sourceSvg.querySelectorAll('[data-editable-object]')].find(node => node.dataset.editableObject === selectedObject);
  if (!target) throw new Error('선택한 개체를 찾지 못했어요. 포스터에서 다시 선택해 주세요.');
  const [width, height] = ratioSizes[ratio.value];
  const output = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  output.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  output.setAttribute('xmlns:inkscape', 'http://www.inkscape.org/namespaces/inkscape');
  output.setAttribute('width', width);
  output.setAttribute('height', height);
  output.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const defs = sourceSvg.querySelector('defs');
  if (defs) output.append(defs.cloneNode(true));
  output.append(target.cloneNode(true));
  return new XMLSerializer().serializeToString(output);
}

function selectedAssetName() {
  return selectedObject.replace(/-line-/, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function saveSelectedSvg() {
  if (!backgroundData) return;
  try {
    saveBlob(new Blob([selectedElementSvg()], { type: 'image/svg+xml;charset=utf-8' }), `poster-element-${selectedAssetName()}.svg`);
  } catch (error) { setStatus(error.message, true); }
}

function saveSelectedPng() {
  if (!backgroundData) return;
  const [width, height] = ratioSizes[ratio.value];
  const url = URL.createObjectURL(new Blob([selectedElementSvg()], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    canvas.toBlob(blob => {
      if (blob) saveBlob(blob, `poster-element-${selectedAssetName()}.png`);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); setStatus('선택한 요소 PNG 저장에 실패했어요.', true); };
  image.src = url;
}

function loadCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('PSD 레이어 이미지를 읽지 못했어요.'));
    image.src = dataUrl;
  });
}

async function savePsdResources() {
  if (!backgroundData || !window.agPsd?.writePsd) return setStatus('PSD 내보내기 모듈을 불러오지 못했어요. 페이지를 새로고침해 주세요.', true);
  const [width, height] = ratioSizes[ratio.value];
  const backgroundCanvas = await loadCanvas(backgroundData);
  const composite = document.createElement('canvas');
  composite.width = width; composite.height = height;
  const context = composite.getContext('2d');
  context.drawImage(backgroundCanvas, 0, 0, width, height);
  const children = [];
  for (const asset of subjectAssets) {
    const subjectCanvas = document.createElement('canvas');
    subjectCanvas.width = width; subjectCanvas.height = height;
    const subjectContext = subjectCanvas.getContext('2d');
    const image = await loadCanvas(asset.data);
    const object = editorObjects[asset.id];
    const displayWidth = object.width * (object.scale || 100) / 100;
    const displayHeight = object.height * (object.scale || 100) / 100;
    const centerX = object.x + displayWidth / 2;
    const centerY = object.y + displayHeight / 2;
    subjectContext.translate(centerX, centerY);
    subjectContext.rotate((object.rotation || 0) * Math.PI / 180);
    subjectContext.drawImage(image, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
    context.drawImage(subjectCanvas, 0, 0);
    children.push({ name: `02 ${asset.name}`, left: 0, top: 0, right: width, bottom: height, canvas: subjectCanvas });
  }
  children.push({ name: '01 Background', left: 0, top: 0, right: width, bottom: height, canvas: compositeBackgroundCanvas(backgroundCanvas, width, height) });
  const data = window.agPsd.writePsd({ width, height, children, canvas: composite });
  saveBlob(new Blob([data], { type: 'application/octet-stream' }), 'public-campaign-resources.psd');
  setStatus(`배경과 피사체 ${subjectAssets.length}개를 독립 레이어로 담은 PSD를 저장했어요. 텍스트는 SVG에서 편집할 수 있어요.`);
}

function compositeBackgroundCanvas(sourceCanvas, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(sourceCanvas, 0, 0, width, height);
  return canvas;
}

function saveSvg() {
  if (!backgroundData || needsRegenerate) return;
  saveBlob(new Blob([makeSvg(true)], { type: 'image/svg+xml;charset=utf-8' }), 'poster-maker-editable.svg');
  setStatus('전체 SVG를 저장했어요. Illustrator에서 문구 줄과 피사체를 선택해 편집할 수 있어요.');
}

function savePng() {
  if (!backgroundData || needsRegenerate) return;
  const [width, height] = ratioSizes[ratio.value];
  const url = URL.createObjectURL(new Blob([makeSvg(true)], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    canvas.toBlob(blob => {
      if (blob) saveBlob(blob, 'poster-maker.png');
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); setStatus('PNG 저장에 실패했어요. SVG로 저장해 주세요.', true); };
  image.src = url;
}

$('editor-target').addEventListener('change', () => {
  selectedObject = $('editor-target').value;
  setImageOptions();
  updatePoster();
});
['editor-font', 'editor-size', 'editor-line-height', 'editor-letter-spacing', 'editor-color', 'editor-shadow'].forEach(id => {
  $(id).addEventListener('input', () => setTextStyle(selectedObject));
  $(id).addEventListener('change', () => setTextStyle(selectedObject));
});
$('editor-image-scale').addEventListener('input', updateImageScale);
$('editor-rotation').addEventListener('input', updateRotation);
$('reset-object').addEventListener('click', resetSelectedObject);
$('undo-button').addEventListener('click', undoEdit);
$('redo-button').addEventListener('click', redoEdit);
document.addEventListener('keydown', event => {
  if (!backgroundData) return;
  const active = document.activeElement;
  if (active?.classList.contains('poster-inline-editor')) return;
  const isTypingField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLButtonElement || (active instanceof HTMLSelectElement && active.id !== 'editor-target');
  if (event.key === 'Delete' && !isTypingField) {
    if (!editorObjects[selectedObject]) return;
    event.preventDefault();
    deleteSelectedObject();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  const undo = key === 'z' && !event.shiftKey;
  const redo = key === 'y' || (key === 'z' && event.shiftKey);
  if (!undo && !redo) return;
  event.preventDefault();
  if (undo) undoEdit();
  else redoEdit();
});
$('svg-button').addEventListener('click', saveSvg);
$('png-button').addEventListener('click', savePng);
$('background-button').addEventListener('click', () => backgroundData && saveDataUrl(backgroundData, 'campaign-background.png'));
$('element-svg-button').addEventListener('click', saveSelectedSvg);
$('element-png-button').addEventListener('click', saveSelectedPng);
$('psd-button').addEventListener('click', async () => {
  const button = $('psd-button');
  button.disabled = true;
  try { await savePsdResources(); }
  catch (error) { setStatus(error.message || 'PSD 저장에 실패했어요.', true); }
  finally { button.disabled = !backgroundData || !window.agPsd?.writePsd; }
});

updateFrame();
