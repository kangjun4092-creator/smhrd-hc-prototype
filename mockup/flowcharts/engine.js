// 재사용 플로우차트 렌더러: nodes는 CSS Grid 셀에 배치되고, edges는 렌더 후 실제 DOM
// 위치를 측정해서 SVG 꺾은선으로 그린다. 좌표를 손으로 계산할 필요가 없어 여러 장의
// 복잡한 플로우차트를 같은 엔진으로 빠르게 만들 수 있다.
function renderFlowchart(rootId, cfg){
  const root = document.getElementById(rootId);
  let html = `<div class="fc-title">${cfg.title}</div><hr class="fc-hr">`;
  if(cfg.legend!==false){
    html += `<div class="fc-legend"><span class="s1">시작</span><span class="s2">종료</span></div>`;
  }
  if(cfg.subtitle) html += `<div class="fc-subtitle">${cfg.subtitle}</div>`;
  const cols = cfg.cols || 6;
  html += `<div class="fc-canvas" id="${rootId}-canvas" style="grid-template-columns:repeat(${cols},1fr);">`;
  (cfg.zones||[]).forEach(z=>{
    html += `<div class="fc-zone fc-zone-${z.color}" style="grid-column:${z.col};grid-row:${z.row};"></div>`;
  });
  cfg.nodes.forEach(n=>{
    const cls = ['fc-node', 'fc-'+n.type].concat(n.className?[n.className]:[]).join(' ');
    html += `<div class="${cls}" id="${n.id}" style="grid-column:${n.col};grid-row:${n.row};">${n.label}</div>`;
  });
  (cfg.labels||[]).forEach((l,i)=>{
    html += `<div class="fc-label" id="${rootId}-lab${i}" style="grid-column:${l.col};grid-row:${l.row};">${l.text}</div>`;
  });
  html += `<svg class="fc-svg" id="${rootId}-svg"></svg></div>`;
  root.innerHTML = html;

  const canvas = document.getElementById(`${rootId}-canvas`);
  const svg = document.getElementById(`${rootId}-svg`);

  function pt(el, side){
    const r = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const x0=r.left-c.left, y0=r.top-c.top, w=r.width, h=r.height;
    if(side==='top') return [x0+w/2, y0];
    if(side==='bottom') return [x0+w/2, y0+h];
    if(side==='left') return [x0, y0+h/2];
    return [x0+w, y0+h/2]; // right
  }
  // fromSide 축(수직 top/bottom vs 수평 left/right)을 기준으로 첫 구간 방향을 정하고,
  // 중간에서 한 번 꺾어 p2까지 잇는다 — toSide 조합을 일일이 나열하지 않아도 되는 범용 라우팅.
  function elbow(p1, p2, fromSide){
    const vertical = fromSide==='top' || fromSide==='bottom';
    if(vertical){
      if(Math.abs(p1[0]-p2[0])<2) return `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
      const midY=(p1[1]+p2[1])/2;
      return `M${p1[0]},${p1[1]} L${p1[0]},${midY} L${p2[0]},${midY} L${p2[0]},${p2[1]}`;
    }
    if(Math.abs(p1[1]-p2[1])<2) return `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
    const midX=(p1[0]+p2[0])/2;
    return `M${p1[0]},${p1[1]} L${midX},${p1[1]} L${midX},${p2[1]} L${p2[0]},${p2[1]}`;
  }

  function draw(){
    const cw = canvas.scrollWidth, ch = canvas.scrollHeight;
    svg.setAttribute('width', cw);
    svg.setAttribute('height', ch);
    svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    let inner = `<defs><marker id="${rootId}-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#222"/></marker></defs>`;
    cfg.edges.forEach(e=>{
      const a = document.getElementById(e.from), b = document.getElementById(e.to);
      if(!a||!b) return;
      const fromSide = e.fromSide || 'bottom';
      const toSide = e.toSide || 'top';
      const p1 = pt(a, fromSide), p2 = pt(b, toSide);
      const d = elbow(p1, p2, fromSide);
      const dash = e.dashed ? ' stroke-dasharray="5,4"' : '';
      inner += `<path d="${d}" stroke="#222" stroke-width="1.8" fill="none" marker-end="url(#${rootId}-arrow)"${dash}/>`;
      if(e.label){
        const lx = fromSide==='right'||fromSide==='left' ? (p1[0]+p2[0])/2 : p1[0]+ (e.labelDx||14);
        const ly = fromSide==='bottom'||fromSide==='top' ? (p1[1]+p2[1])/2 : p1[1]-8;
        inner += `<rect x="${lx-4}" y="${ly-11}" width="${e.label.length*7+8}" height="15" fill="#fff"/>`;
        inner += `<text x="${lx}" y="${ly}" font-size="11.5" font-weight="700" fill="#1a1a1a">${e.label}</text>`;
      }
    });
    svg.innerHTML = inner;
  }
  draw();
  window.addEventListener('resize', draw);
  document.title = 'READY';
}
