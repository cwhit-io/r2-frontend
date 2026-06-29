import type { FileRecord } from './types';
import { htmlEscape } from './utils';

function page(title: string, body: string): Response {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script src="https://unpkg.com/htmx.org@1.9.12"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-slate-100 text-slate-900">${body}</body>
</html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export function renderLogin(): Response {
  return page(
    'File Host — Login',
    `<main class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 class="text-xl font-bold text-slate-900 mb-1">File Host</h1>
        <p class="text-sm text-slate-500 mb-6">Sign in to continue</p>
        <form action="/login" method="post" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input name="password" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required autofocus />
          </div>
          <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors" type="submit">Sign in</button>
        </form>
      </div>
    </main>`
  );
}

export function renderAdmin(records: FileRecord[], origin: string): Response {
  return page(
    'File Host',
    `<main class="max-w-5xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">File Host</h1>
          <p class="text-sm text-slate-500 mt-0.5">Upload and manage files</p>
        </div>
        <form action="/logout" method="post">
          <button class="text-sm text-slate-500 hover:text-slate-900 border border-slate-200 bg-white rounded-lg px-4 py-2 hover:bg-slate-50 transition-all" type="submit">Sign out</button>
        </form>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Upload Files</h2>

        <div id="drop-zone" class="relative border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-indigo-300 hover:bg-slate-50 transition-all">
          <svg class="mx-auto mb-3 text-slate-300 pointer-events-none" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <p class="font-medium text-slate-600 pointer-events-none">Drop files here</p>
          <p class="text-sm text-slate-400 mt-1 pointer-events-none">or <span class="text-indigo-500">click to browse</span></p>
          <input id="file-input" type="file" multiple class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </div>

        <div id="file-queue" class="hidden mt-4 space-y-2"></div>

        <div id="upload-actions" class="hidden mt-4 flex items-center justify-between">
          <span id="queue-summary" class="text-sm text-slate-500"></span>
          <div class="flex gap-2">
            <button id="clear-btn" type="button" class="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Clear all</button>
            <button id="upload-btn" type="button" class="text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Upload</button>
          </div>
        </div>
      </div>

      ${renderFilesTable(records, origin)}
    </main>

    <div id="toast-container" class="fixed bottom-5 right-5 space-y-2 z-50 pointer-events-none"></div>

    <script>
    (function(){
      var dz=document.getElementById('drop-zone'),
          fi=document.getElementById('file-input'),
          fq=document.getElementById('file-queue'),
          ua=document.getElementById('upload-actions'),
          qs=document.getElementById('queue-summary'),
          ub=document.getElementById('upload-btn'),
          cb=document.getElementById('clear-btn');
      var files=[],uploading=false;

      function fmt(b){
        return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';
      }
      function esc(s){
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
      function toast(msg,isErr){
        var el=document.createElement('div');
        el.className='pointer-events-auto px-4 py-3 rounded-xl text-white text-sm shadow-lg font-medium '+(isErr?'bg-red-600':'bg-emerald-600');
        el.style.cssText='opacity:0;transform:translateY(6px);transition:opacity 0.2s,transform 0.2s';
        el.textContent=msg;
        document.getElementById('toast-container').appendChild(el);
        requestAnimationFrame(function(){el.style.opacity='1';el.style.transform='translateY(0)';});
        setTimeout(function(){el.style.opacity='0';el.style.transform='translateY(6px)';setTimeout(function(){el.remove();},200);},3500);
      }
      window._toast=toast;

      function renderQueue(){
        fq.innerHTML=files.map(function(f,i){
          return '<div class="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">'+
            '<div class="flex-1 min-w-0">'+
              '<p class="text-sm font-medium text-slate-800 truncate">'+esc(f.file.name)+'</p>'+
              '<div class="flex items-center gap-2 mt-1.5">'+
                '<div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">'+
                  '<div id="pb-'+i+'" class="h-full bg-indigo-500 transition-all duration-200 rounded-full" style="width:0%"></div>'+
                '</div>'+
                '<span class="text-xs text-slate-400 shrink-0 tabular-nums">'+fmt(f.file.size)+'</span>'+
              '</div>'+
            '</div>'+
            '<span id="st-'+i+'" class="text-xs text-slate-400 shrink-0 w-20 text-right">Queued</span>'+
            (!uploading?'<button onclick="window._rmFile('+i+')" class="ml-1 text-slate-300 hover:text-red-400 transition-colors text-xl leading-none shrink-0" type="button">&times;</button>':'')+
          '</div>';
        }).join('');
        var total=files.reduce(function(s,f){return s+f.file.size;},0);
        qs.textContent=files.length+' file'+(files.length!==1?'s':'')+' \u2014 '+fmt(total);
        fq.classList.toggle('hidden',files.length===0);
        ua.classList.toggle('hidden',files.length===0);
        ub.disabled=uploading;
        cb.disabled=uploading;
      }

      window._rmFile=function(i){files.splice(i,1);renderQueue();};

      function addFiles(list){
        for(var i=0;i<list.length;i++) files.push({file:list[i]});
        renderQueue();
      }

      fi.addEventListener('change',function(){addFiles(fi.files);fi.value='';});
      dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('border-indigo-400','bg-indigo-50');});
      dz.addEventListener('dragleave',function(e){if(!dz.contains(e.relatedTarget))dz.classList.remove('border-indigo-400','bg-indigo-50');});
      dz.addEventListener('drop',function(){setTimeout(function(){dz.classList.remove('border-indigo-400','bg-indigo-50');},0);});
      cb.addEventListener('click',function(){if(!uploading){files=[];renderQueue();}});

      function uploadOne(entry,qi,done){
        var pb=document.getElementById('pb-'+qi),st=document.getElementById('st-'+qi);
        if(st){st.textContent='Uploading\u2026';st.className='text-xs text-indigo-500 shrink-0 w-20 text-right';}
        var fd=new FormData();
        fd.append('file',entry.file);
        var xhr=new XMLHttpRequest();
        xhr.open('POST','/api/upload');
        xhr.upload.onprogress=function(e){
          if(e.lengthComputable&&pb) pb.style.width=Math.round(e.loaded/e.total*100)+'%';
        };
        xhr.onload=function(){
          if(xhr.status>=200&&xhr.status<300){
            if(pb){pb.style.width='100%';pb.classList.remove('bg-indigo-500');pb.classList.add('bg-emerald-500');}
            if(st){st.textContent='\u2713 Done';st.className='text-xs text-emerald-600 shrink-0 w-20 text-right';}
            done(true);
          } else {
            if(pb){pb.classList.remove('bg-indigo-500');pb.classList.add('bg-red-400');}
            if(st){st.textContent='Failed';st.className='text-xs text-red-500 shrink-0 w-20 text-right';}
            toast('Failed to upload "'+entry.file.name+'"',true);
            done(false);
          }
        };
        xhr.onerror=function(){
          if(st){st.textContent='Error';st.className='text-xs text-red-500 shrink-0 w-20 text-right';}
          toast('Network error uploading "'+entry.file.name+'"',true);
          done(false);
        };
        xhr.send(fd);
      }

      ub.addEventListener('click',function(){
        if(uploading||!files.length) return;
        uploading=true;
        ub.textContent='Uploading\u2026';
        renderQueue();
        var i=0,ok=0;
        function next(){
          if(i>=files.length){
            fetch('/api/files-table').then(function(r){return r.text();}).then(function(html){
              var t=document.getElementById('files-table');
              if(!t) return;
              var d=document.createElement('div');d.innerHTML=html;
              var ns=d.firstChild;
              t.replaceWith(ns);
              ns.querySelectorAll('script:not([type]),script[type="text/javascript"]').forEach(function(s){
                var n=document.createElement('script');n.textContent=s.textContent;document.head.appendChild(n);n.remove();
              });
              htmx.process(document.body);
            });
            if(ok>0) toast(ok+' file'+(ok!==1?'s':'')+' uploaded successfully',false);
            uploading=false;
            setTimeout(function(){files=[];ub.textContent='Upload';renderQueue();},1500);
            return;
          }
          uploadOne(files[i],i,function(success){if(success)ok++;i++;next();});
        }
        next();
      });
    })();
    <\/script>`
  );
}

export function renderFilesTable(records: FileRecord[], origin: string): string {
  // Embed data as JSON (safe for <script> embedding)
  type RecordData = FileRecord & { _url: string };
  const data: RecordData[] = records.map((r) => ({ ...r, _url: `${origin}/d/${r.id}` }));
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const total = records.length;

  const tableOrEmpty = total === 0
    ? `<div class="py-16 text-center"><p class="text-slate-400 text-sm">No files uploaded yet</p></div>`
    : `<div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-slate-100 text-left">
            <th class="px-3 py-3 w-14"></th>
            <th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors" onclick="ftSort('name')">Name<span id="ft-si-name" class="ml-1 text-slate-300"></span></th>
            <th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors" onclick="ftSort('date')">Uploaded<span id="ft-si-date" class="ml-1 text-slate-400">\u2193</span></th>
            <th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors" onclick="ftSort('downloads')">DLs<span id="ft-si-downloads" class="ml-1 text-slate-300"></span></th>
            <th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">URL</th>
            <th class="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody id="ft-body"></tbody>
      </table>
    </div>
    <div id="ft-pager" class="px-6 py-3 border-t border-slate-100 min-h-0"></div>`;

  return `<section id="files-table" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
      <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-auto">Files</h2>
      ${total > 0 ? `<input id="ft-search" type="search" placeholder="Search\u2026" class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />` : ''}
      <span id="ft-count" class="text-xs text-slate-400">${total} file${total !== 1 ? 's' : ''}</span>
    </div>
    ${tableOrEmpty}
    <script type="application/json" id="ft-data">${json}<\/script>
    <script>
    (function(){
      window._ftState=window._ftState||{q:'',col:'date',dir:'desc',page:0};
      var S=window._ftState;
      var PAGE=20;
      var data=JSON.parse(document.getElementById('ft-data').textContent);
      var bodyEl=document.getElementById('ft-body');
      var pagerEl=document.getElementById('ft-pager');
      var countEl=document.getElementById('ft-count');
      var searchEl=document.getElementById('ft-search');
      if(searchEl){searchEl.value=S.q;searchEl.oninput=function(){S.q=searchEl.value;S.page=0;render();};}

      function he(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      function isImg(fn){return /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(fn);}
      function fileExt(fn){return(fn.split('.').pop()||'').toLowerCase().slice(0,4)||'?';}

      function thumbHtml(r){
        if(isImg(r.filename)){
          return '<img src="'+he(r._url)+'" loading="lazy" class="w-10 h-10 object-cover rounded-lg bg-slate-100" onerror="this.style.opacity=0" />';
        }
        var e=fileExt(r.filename);
        var cls=/^pdf$/.test(e)?'bg-red-100 text-red-600':
                /^(mp4|mov|avi|mkv|webm)$/.test(e)?'bg-violet-100 text-violet-600':
                /^(mp3|wav|ogg|flac|aac|m4a)$/.test(e)?'bg-blue-100 text-blue-600':
                /^(zip|tar|gz|7z|rar)$/.test(e)?'bg-amber-100 text-amber-600':
                'bg-slate-100 text-slate-500';
        return '<div class="w-10 h-10 rounded-lg '+cls+' flex items-center justify-center text-xs font-bold uppercase leading-none">'+he(e)+'</div>';
      }

      function rowHtml(r){
        var url=he(r._url);
        var date=r.created_at.replace('T',' ').slice(0,16);
        return '<tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">'+
          '<td class="px-3 py-2"><div class="flex items-center justify-center">'+thumbHtml(r)+'</div></td>'+
          '<td class="px-4 py-3 text-sm font-medium text-slate-800"><div class="truncate max-w-xs" title="'+he(r.filename)+'">'+he(r.filename)+'</div></td>'+
          '<td class="px-4 py-3 text-sm text-slate-500 whitespace-nowrap tabular-nums">'+he(date)+'</td>'+
          '<td class="px-4 py-3 text-sm text-slate-500 tabular-nums">'+r.downloads+'</td>'+
          '<td class="px-4 py-3">'+
            '<div class="flex items-center gap-2">'+
              '<code class="text-xs text-slate-500 truncate max-w-xs block" title="'+url+'">'+url+'</code>'+
              '<button class="shrink-0 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors font-medium whitespace-nowrap" data-url="'+url+'" onclick="var b=this,u=b.getAttribute(&quot;data-url&quot;);navigator.clipboard.writeText(u).then(function(){b.textContent=&quot;Copied!&quot;;setTimeout(function(){b.textContent=&quot;Copy&quot;;},2000)})" type="button">Copy</button>'+
            '</div>'+
          '</td>'+
          '<td class="px-4 py-3">'+
            '<button class="text-xs text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg px-3 py-1.5 transition-all font-medium whitespace-nowrap" hx-delete="/api/files/'+r.id+'" hx-target="#files-table" hx-swap="outerHTML" hx-confirm="Delete this file?">Delete</button>'+
          '</td>'+
        '</tr>';
      }

      function render(){
        var q=S.q.toLowerCase();
        var filtered=q?data.filter(function(r){return r.filename.toLowerCase().indexOf(q)!==-1;}):data.slice();
        filtered.sort(function(a,b){
          var av=S.col==='name'?a.filename.toLowerCase():S.col==='downloads'?+a.downloads:a.created_at;
          var bv=S.col==='name'?b.filename.toLowerCase():S.col==='downloads'?+b.downloads:b.created_at;
          if(av<bv)return S.dir==='asc'?-1:1;
          if(av>bv)return S.dir==='asc'?1:-1;
          return 0;
        });
        var total=filtered.length;
        var pages=Math.max(1,Math.ceil(total/PAGE));
        if(S.page>=pages)S.page=pages-1;
        var start=S.page*PAGE;
        var page=filtered.slice(start,start+PAGE);

        if(countEl){
          countEl.textContent=total+(total!==data.length?' of '+data.length:'')+' file'+(total!==1?'s':'');
        }
        if(bodyEl){
          if(page.length===0){
            bodyEl.innerHTML='<tr><td colspan="6" class="px-4 py-12 text-center text-sm text-slate-400">'+(q?'No files matching \u201c'+he(S.q)+'\u201d':'No files')+'</td></tr>';
          } else {
            bodyEl.innerHTML=page.map(rowHtml).join('');
            htmx.process(bodyEl);
          }
        }
        ['name','date','downloads'].forEach(function(c){
          var el=document.getElementById('ft-si-'+c);
          if(!el)return;
          el.textContent=S.col===c?(S.dir==='asc'?'\u2191':'\u2193'):'';
        });
        if(pagerEl){
          if(pages<=1){pagerEl.style.display='none';}
          else{
            pagerEl.style.display='';
            var bc='px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
            pagerEl.innerHTML=
              '<div class="flex items-center gap-3">'+
              '<button class="'+bc+'" onclick="ftPage(-1)" '+(S.page===0?'disabled':'')+'>&#8592; Prev</button>'+
              '<span class="text-xs text-slate-500 tabular-nums">Page '+(S.page+1)+' of '+pages+'</span>'+
              '<button class="'+bc+'" onclick="ftPage(1)" '+(S.page>=pages-1?'disabled':'')+'>Next &#8594;</button>'+
              '</div>';
          }
        }
      }

      window.ftSort=function(col){
        if(S.col===col)S.dir=S.dir==='asc'?'desc':'asc';
        else{S.col=col;S.dir=(col==='date'||col==='downloads')?'desc':'asc';}
        S.page=0;render();
      };
      window.ftPage=function(d){S.page+=d;render();};

      render();
    })();
    <\/script>
  </section>`;
}
