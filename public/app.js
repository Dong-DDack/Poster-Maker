const $ = id => document.getElementById(id);
const source = $('source');
const style = $('style');
const ratio = $('ratio');
const language = $('language');
const poster = $('poster');
const status = $('status');
const toolbar = $('editor-toolbar');

let referenceImage = '';
let backgroundData = '';
let subjectAsset = null;
let textArtAssets = { title: [], subtitle: [], details: [] };
let textArtOutdated = { title: false, subtitle: false, details: false };
let plan = null;
let editorObjects = {};
let defaultObjects = {};
let selectedObject = 'title';
let needsRegenerate = false;
let activeDrag = null;

const ratioSizes = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '2:3': [1080, 1620],
  '3:4': [1080, 1440],
  '9:16': [1024, 1824],
  '16:9': [1600, 900]
};
const fontOptions = {
  title: { family: 'Noto Sans KR, sans-serif', color: '#fffaf2', shadow: true, letterSpacing: -1, lineHeight: 1.08 },
  subtitle: { family: 'DM Sans, Noto Sans KR, sans-serif', color: '#d9e7c2', shadow: true, letterSpacing: 1.2, lineHeight: 1.25 },
  details: { family: 'DM Sans, Noto Sans KR, sans-serif', color: '#fffaf2', shadow: true, letterSpacing: 0, lineHeight: 1.35 }
};
const styleClass = name => 'style-' + String(name || 'auto').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

source.addEventListener('input', () => $('char-count').textContent = `${source.value.length} / 5000`);

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

function refreshTextLineOptions() {
  const select = $('editor-target');
  const selected = select.value;
  select.querySelectorAll('option[data-line-option]').forEach(option => option.remove());
  select.querySelectorAll('option[value="title"],option[value="subtitle"],option[value="details"]').forEach(option => option.remove());
  select.querySelectorAll('option[value="art-title"],option[value="art-subtitle"],option[value="art-details"]').forEach(option => option.remove());
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
      option.disabled = Boolean(textArtAssets[key]?.length && !textArtOutdated[key] && $(`art-${key}-enabled`).checked);
      fragment.append(option);
    }
    const artLineCount = textArtAssets[key]?.length || 0;
    for (let index = 1; index <= artLineCount; index++) {
      const option = document.createElement('option');
      option.value = `art-${key}-line-${index}`;
      option.dataset.lineOption = 'true';
      option.textContent = `${label} 그림 글씨 ${index}번째 줄`;
      option.disabled = textArtOutdated[key] || !$(`art-${key}-enabled`).checked;
      fragment.append(option);
    }
  }
  select.insertBefore(fragment, select.querySelector('option[value="subject"]'));
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

function textGroup(id, object, value, lines, opacity = 1) {
  const filter = object.shadow ? ' filter="url(#soft-shadow)"' : '';
  return lines.map((line, index) => {
    const lineId = `${id}-line-${index + 1}`;
    const item = editorObjects[lineId] || { ...object, y: object.y + index * object.fontSize * object.lineHeight, rotation: 0 };
    const transform = `translate(${item.x} ${item.y}) rotate(${item.rotation || 0})`;
    return `<g id="editable-${lineId}" class="editable-object" data-editable-object="${lineId}" data-x="${item.x}" data-y="${item.y}" transform="${transform}" opacity="${opacity}"${opacity === 0 ? ' pointer-events="none"' : ''}><text x="0" y="0" font-family="${escapeXml(item.family)}" font-size="${item.fontSize}" font-weight="${id === 'title' ? 700 : 500}" letter-spacing="${item.letterSpacing}" line-height="${item.lineHeight}" fill="${item.color}"${filter}>${escapeXml(line)}</text></g>`;
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
  const subjectNode = imageGroup('subject', subjectAsset, editorObjects.subject, width, height);
  const showTextArt = Object.fromEntries(['title', 'subtitle', 'details'].map(key => [key, Boolean(textArtAssets[key]?.length && !textArtOutdated[key] && $(`art-${key}-enabled`).checked)]));
  const textArtNodes = Object.fromEntries(['title', 'subtitle', 'details'].map(key => [key, showTextArt[key] ? textArtAssets[key].map((asset, index) => imageGroup(`art-${key}-line-${index + 1}`, asset, editorObjects[`art-${key}-line-${index + 1}`], width, height)).join('') : '']));
  const titleMaxChars = Math.max(5, Math.floor(maxWidth / (editorObjects.title.fontSize * .92)));
  const subtitleMaxChars = Math.max(8, Math.floor(maxWidth / (editorObjects.subtitle.fontSize * .9)));
  const detailsMaxChars = Math.max(10, Math.floor(maxWidth / (editorObjects.details.fontSize * .95)));
  const titleLines = wrapLines($('title').value, titleMaxChars);
  const subtitleLines = wrapLines($('subtitle').value, subtitleMaxChars);
  const detailLines = wrapLines($('details').value, detailsMaxChars);
  const titleText = textGroup('title', editorObjects.title, $('title').value, titleLines, showTextArt.title ? 0 : 1);
  const subtitleText = textGroup('subtitle', editorObjects.subtitle, $('subtitle').value, subtitleLines, showTextArt.subtitle ? 0 : 1);
  const detailText = textGroup('details', editorObjects.details, $('details').value, detailLines, showTextArt.details ? 0 : 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="poster-artwork"><defs><linearGradient id="poster-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#090b0c" stop-opacity=".14"/><stop offset="43%" stop-color="#090b0c" stop-opacity=".02"/><stop offset="100%" stop-color="#070909" stop-opacity=".72"/></linearGradient><filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity=".55"/></filter></defs><g id="01-background" inkscape:label="Background"><image id="background-image" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="${backgroundData}"/></g>${subjectNode}<rect id="poster-shading" x="0" y="0" width="${width}" height="${height}" fill="url(#poster-shade)" pointer-events="none"/><g id="03-typography" inkscape:label="Typography">${subtitleText}${textArtNodes.subtitle}${titleText}${textArtNodes.title}<path id="accent-rule" d="M${marginX} ${height - Math.round(height * .13)}h${Math.round(width * .042)}" stroke="#c2f078" stroke-width="4" pointer-events="none"/>${detailText}${textArtNodes.details}</g></svg>`;
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
  svg.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-editable-object]');
    if (!target) return;
    selectedObject = target.dataset.editableObject;
    $('editor-target').value = selectedObject;
    syncToolbar();
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
    if (selectedObject === 'subject' && subjectAsset) {
      subjectAsset.x = editorObjects.subject.x;
      subjectAsset.y = editorObjects.subject.y;
    }
    activeDrag = null;
  };
  svg.addEventListener('pointerup', finishDrag);
  svg.addEventListener('pointercancel', finishDrag);
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
  if (selectedObject === 'subject' && subjectAsset) { subjectAsset.x = initial.x; subjectAsset.y = initial.y; }
  syncToolbar();
  updatePoster();
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
}

function updateImageScale() {
  const object = editorObjects[selectedObject];
  if (!object || !object.width) return;
  object.scale = Number($('editor-image-scale').value);
  if (selectedObject === 'subject' && subjectAsset) subjectAsset.scale = object.scale;
  $('editor-image-scale-label').textContent = `${object.scale}%`;
  updatePoster();
}

function updateRotation() {
  const object = editorObjects[selectedObject];
  if (!object) return;
  object.rotation = Number($('editor-rotation').value);
  $('editor-rotation-label').textContent = `${object.rotation}°`;
  updatePoster();
}

function setImageOptions() {
  $('editor-target').querySelector('option[value="subject"]').disabled = !subjectAsset;
  refreshTextLineOptions();
  toolbar.hidden = !backgroundData;
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
    $('recommended-style').textContent = style.value;
    $('style-reason').textContent = 'Selected by you. Update the image descriptions if needed.';
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
  if (textArtAssets[key]?.length) {
    textArtOutdated[key] = true;
    if (selectedObject.startsWith(`art-${key}-line-`)) {
      selectedObject = `${key}-line-1`;
      $('editor-target').value = selectedObject;
    }
    setStatus(`${key === 'title' ? '제목' : key === 'subtitle' ? '부제목' : '상세 정보'}를 바꿨어요. 해당 그림 글씨를 다시 생성해 주세요.`);
  }
  if (backgroundData) layoutTextObjects();
  updatePoster();
  if (backgroundData) setImageOptions();
}));
['background-prompt', 'subject-prompt'].forEach(key => $(key).addEventListener('input', updatePoster));
$('subject-needed').addEventListener('change', () => $('subject-prompt').disabled = !$('subject-needed').checked);
for (const key of ['title', 'subtitle', 'details']) $(`art-${key}-enabled`).addEventListener('change', () => {
  if (!$(`art-${key}-enabled`).checked && selectedObject.startsWith(`art-${key}-line-`)) {
    selectedObject = `${key}-line-1`;
    $('editor-target').value = selectedObject;
  }
  if (textArtAssets[key]?.length && $(`art-${key}-enabled`).checked && textArtOutdated[key]) setStatus('문구를 수정했어요. 최신 문구로 그림 글씨를 다시 생성해 주세요.');
  if (backgroundData) setImageOptions();
  updatePoster();
});

$('reference').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    event.target.value = '';
    setStatus('참고 이미지는 8MB 이하로 선택해 주세요.', true);
    return;
  }
  referenceImage = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  $('file-name').textContent = file.name;
  setStatus('참고 이미지는 주 피사체 레이어 생성에 사용돼요.');
});

$('plan-button').addEventListener('click', async () => {
  if (source.value.trim().length < 8) return setStatus('포스터로 만들 내용을 조금 더 적어 주세요.', true);
  const button = $('plan-button');
  button.disabled = true;
  button.querySelector('span').textContent = '구성안을 만들고 있어요…';
  setStatus('AI가 문구, 배경, 주 피사체 레이어를 계획하고 있어요.');
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
    $('subject-needed').checked = Boolean(data.subject_needed);
    $('subject-prompt').value = data.subject_prompt || '';
    $('subject-prompt').disabled = !data.subject_needed;
    $('recommended-style').textContent = data.recommended_style;
    $('style-reason').textContent = data.style_reason;
    $('recommendation').classList.remove('hidden');
    $('copy-editor').classList.remove('hidden');
    layoutTextObjects();
    updateFrame();
    updatePoster();
    $('result-title').textContent = '구성안이 준비됐어요';
    $('result-sub').textContent = '문구와 이미지 레이어 설명을 확인한 다음 생성하세요.';
    setStatus('중요한 사실 정보를 확인해 주세요. 배경·피사체·그림 글씨 생성은 각각 별도 API 요청이에요.');
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
    body: JSON.stringify({ role, prompt, ratio: ratio.value, referenceImage: role === 'subject' ? referenceImage : '' })
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `${role === 'subject' ? '주 피사체' : role === 'lettering' ? '그림 글씨' : '배경'} 생성에 실패했어요.`);
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

function createImageObject(asset, width, height, kind) {
  const isSubject = kind === 'subject';
  const match = kind.match(/^art-(title|subtitle|details)-line-(\d+)$/);
  const textKey = match ? `${match[1]}-line-${match[2]}` : '';
  const textObject = textKey ? editorObjects[textKey] : null;
  const maxWidth = width * (isSubject ? .58 : .86);
  const maxHeight = isSubject ? height * .36 : textObject ? textObject.fontSize * 1.65 : height * .19;
  const aspect = asset.width / asset.height;
  const objectWidth = Math.min(maxWidth, maxHeight * aspect);
  const objectHeight = objectWidth / aspect;
  return {
    x: isSubject ? Math.round(asset.x * width) : textObject ? Math.round(textObject.x) : Math.round((width - objectWidth) / 2),
    y: isSubject ? Math.round(asset.y * height) : textObject ? Math.round(textObject.y - textObject.fontSize * .9) : Math.round(height * .43),
    width: objectWidth,
    height: objectHeight,
    scale: 100
  };
}

$('generate-button').addEventListener('click', async () => {
  if (!plan) return;
  const button = $('generate-button');
  button.disabled = true;
  button.querySelector('span').textContent = '레이어를 생성하고 있어요…';
  backgroundData = '';
  subjectAsset = null;
  textArtAssets = { title: [], subtitle: [], details: [] };
  textArtOutdated = { title: false, subtitle: false, details: false };
  needsRegenerate = false;
  $('svg-button').disabled = true;
  $('png-button').disabled = true;
  poster.innerHTML = '<div class="generation-state"><span class="loader"></span><b>이미지 레이어를 준비하고 있어요</b><small>선택한 이미지 레이어는 각각 별도 요청으로 생성합니다.</small></div>';
  try {
    const selectedStyle = style.value === 'Auto recommend' ? plan.recommended_style : style.value;
    const [width, height] = ratioSizes[ratio.value];
    setStatus('배경 레이어 생성 중… 이미지 생성 API 사용료가 발생합니다.');
    backgroundData = await generateAsset('background', `${$('background-prompt').value}. Background only: no main character, no central hero object, no lettering, text, numbers, logos, watermarks, or readable signage. Leave clear negative space for separately added headline and details. Style: ${selectedStyle}. ${ratio.value} composition.`);

    if ($('subject-needed').checked) {
      setStatus('주 피사체를 투명 배경 레이어로 생성 중… 별도 이미지 생성 비용이 발생합니다.');
      const rawSubject = await generateAsset('subject', `${$('subject-prompt').value}. Isolated single main subject only, full silhouette visible, transparent background, no scenery, no text, no letters, no logos, no watermarks, no extra props. Compose at a scale suitable to overlay on a ${ratio.value} poster. Visual style: ${selectedStyle}.`);
      subjectAsset = await trimTransparent(rawSubject);
      editorObjects.subject = createImageObject(subjectAsset, width, height, 'subject');
    }

    const artFields = [
      { key: 'title', label: '제목' },
      { key: 'subtitle', label: '부제목' },
      { key: 'details', label: '상세 정보' }
    ];
    for (const { key, label } of artFields) {
      if (!$(`art-${key}-enabled`).checked) continue;
      const exactText = $(`${key}`).value.trim();
      if (!exactText) continue;
      const maxChars = Math.max(5, Math.floor((width * .86) / (editorObjects[key].fontSize * (key === 'title' ? .92 : key === 'subtitle' ? .9 : .95))));
      const lines = wrapLines(exactText, maxChars);
      textArtAssets[key] = [];
      textArtOutdated[key] = false;
      for (let index = 0; index < lines.length; index++) {
        setStatus(`${label} 그림 글씨 ${index + 1}/${lines.length}줄 생성 중… 각 줄마다 이미지 API 요청 1회가 사용됩니다.`);
        const rawArt = await generateAsset('lettering', `Create one expressive Korean typographic lettering artwork containing exactly this single line and no other words: "${lines[index]}". Preserve every Korean character exactly. Hand-crafted editorial poster lettering, strong readable letter shapes, tasteful texture. Transparent background. No scenery, objects, logos, or watermark. Keep all characters inside the canvas with margins. Style direction: ${selectedStyle}.`);
        const asset = await trimTransparent(rawArt);
        textArtAssets[key].push(asset);
        const objectId = `art-${key}-line-${index + 1}`;
        editorObjects[objectId] = createImageObject(asset, width, height, objectId);
      }
    }

    layoutTextObjects();
    defaultObjects = structuredClone(editorObjects);
    updatePoster();
    setImageOptions();
    $('svg-button').disabled = false;
    $('png-button').disabled = false;
    $('result-title').textContent = '편집 가능한 포스터가 완성됐어요';
    $('result-sub').textContent = '문구·주 피사체·그림 글씨를 클릭해 편집할 수 있어요.';
    const artLabels = artFields.filter(({ key }) => textArtAssets[key].length).map(({ key, label }) => `${label} 그림 글씨 ${textArtAssets[key].length}줄`);
    const layers = ['배경', subjectAsset && '주 피사체', ...artLabels].filter(Boolean).join('·');
    setStatus(`완성! ${layers}가 만들어졌어요. 글자를 클릭해 조정하고, 개체를 드래그해 위치를 바꾼 뒤 SVG 또는 PNG로 저장하세요.`);
  } catch (error) {
    if (backgroundData) {
      layoutTextObjects();
      updatePoster();
      setImageOptions();
      $('svg-button').disabled = false;
      $('png-button').disabled = false;
      $('result-title').textContent = '일부 이미지 레이어를 만들지 못했어요';
      $('result-sub').textContent = '완성된 배경과 문구는 편집용 SVG 또는 PNG로 저장할 수 있어요.';
    }
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = '레이어별 이미지 생성';
  }
});

function saveBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1200);
}

function saveSvg() {
  if (!backgroundData || needsRegenerate) return;
  saveBlob(new Blob([makeSvg(true)], { type: 'image/svg+xml;charset=utf-8' }), 'poster-maker-editable.svg');
  setStatus('SVG를 저장했어요. Illustrator에서 개별 글자·그림 개체를 선택할 수 있어요.');
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
  syncToolbar();
  updatePoster();
});
['editor-font', 'editor-size', 'editor-line-height', 'editor-letter-spacing', 'editor-color', 'editor-shadow'].forEach(id => {
  $(id).addEventListener('input', () => setTextStyle(selectedObject));
  $(id).addEventListener('change', () => setTextStyle(selectedObject));
});
$('editor-image-scale').addEventListener('input', updateImageScale);
$('editor-rotation').addEventListener('input', updateRotation);
$('reset-object').addEventListener('click', resetSelectedObject);
$('svg-button').addEventListener('click', saveSvg);
$('png-button').addEventListener('click', savePng);

updateFrame();
