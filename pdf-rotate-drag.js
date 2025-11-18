// js/pdf-rotate-drag.js
const pdfjsLib = window["pdfjsLib"];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', function(){
  const input = document.getElementById('rotatePdfInput');
  const pagesList = document.getElementById('pagesList');
  const applyBtn = document.getElementById('applyChangesBtn');
  const status = document.getElementById('rotateStatus');
  const downloadArea = document.getElementById('rotateDownloadArea');

  let loadedPdf = null;
  let pageState = []; // {index, rotation, canvasEl}

  function createThumb(i, pageCanvas, rotation){
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item draggable';
    wrapper.draggable = true;
    wrapper.dataset.pos = pageState.length;
    wrapper.style.width = '140px';
    const thumb = document.createElement('div');
    thumb.appendChild(pageCanvas);
    thumb.style.width='120px'; thumb.style.height='160px'; thumb.style.overflow='hidden';
    const controls = document.createElement('div');
    controls.style.display='flex'; controls.style.justifyContent='space-between'; controls.style.marginTop='6px';
    const rotBtn = document.createElement('button'); rotBtn.className='small-btn'; rotBtn.textContent = rotation + '°';
    const removeBtn = document.createElement('button'); removeBtn.className='small-btn'; removeBtn.textContent='Remove';
    controls.appendChild(rotBtn); controls.appendChild(removeBtn);
    wrapper.appendChild(thumb);
    wrapper.appendChild(controls);

    // events
    rotBtn.addEventListener('click', ()=>{
      const idx = pageState.findIndex(p=>p.canvasEl===pageCanvas);
      if(idx>=0){ pageState[idx].rotation = (pageState[idx].rotation + 90) % 360; rotBtn.textContent = pageState[idx].rotation + '°'; }
    });
    removeBtn.addEventListener('click', ()=>{
      const idx = pageState.findIndex(p=>p.canvasEl===pageCanvas);
      if(idx>=0){ pageState.splice(idx,1); renderList(); }
    });

    // drag handlers
    wrapper.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', pageState.indexOf(pageState.find(p=>p.canvasEl===pageCanvas))); wrapper.classList.add('dragging'); });
    wrapper.addEventListener('dragend', ()=>{ wrapper.classList.remove('dragging'); });

    wrapper.addEventListener('dragover', (e)=>{ e.preventDefault(); const dragging = document.querySelector('.dragging'); if(!dragging) return; const from = parseInt(dragging.dataset.pos,10); const to = parseInt(wrapper.dataset.pos,10); if(from===to) return; // reorder array
      const item = pageState.splice(from,1)[0]; pageState.splice(to,0,item); renderList();
    });

    return wrapper;
  }

  async function renderList(){
    pagesList.innerHTML='';
    pageState.forEach((p, i)=>{
      const thumbCanvas = p.canvasEl;
      const wrapper = createThumb(p.index, thumbCanvas, p.rotation);
      wrapper.dataset.pos = i;
      pagesList.appendChild(wrapper);
    });
  }

  input && input.addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    pagesList.innerHTML = 'Loading...'; status.textContent=''; downloadArea.innerHTML='';
    const data = await file.arrayBuffer();
    loadedPdf = await pdfjsLib.getDocument({data}).promise;
    const num = loadedPdf.numPages;
    pageState = [];
    for(let i=1;i<=num;i++){
      const page = await loadedPdf.getPage(i);
      const viewport = page.getViewport({scale:1.0});
      const scale = Math.min(120/viewport.width, 160/viewport.height);
      const renderViewport = page.getViewport({scale});
      const canvas = document.createElement('canvas');
      canvas.width = renderViewport.width; canvas.height = renderViewport.height;
      await page.render({canvasContext: canvas.getContext('2d'), viewport: renderViewport}).promise;
      pageState.push({index: i-1, rotation: 0, canvasEl: canvas});
    }
    renderList();
  });

  applyBtn && applyBtn.addEventListener('click', async ()=>{
    if(!loadedPdf){ status.textContent='Load a PDF first'; return; }
    status.textContent='Building PDF...'; downloadArea.innerHTML='';
    try{
      const { PDFDocument, degrees } = PDFLib;
      const srcBytes = await input.files[0].arrayBuffer();
      const src = await PDFDocument.load(srcBytes);
      const out = await PDFDocument.create();
      for(const p of pageState){
        const [copied] = await out.copyPages(src, [p.index]);
        if(typeof copied.setRotation === 'function'){
          copied.setRotation(degrees(p.rotation));
        }
        out.addPage(copied);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], {type:'application/pdf'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='rotated-reordered.pdf'; a.textContent='Download rotated-reordered.pdf'; a.className='download-link';
      downloadArea.appendChild(a);
      status.textContent='Done';
    }catch(e){ console.error(e); status.textContent='Error'; }
  });
});