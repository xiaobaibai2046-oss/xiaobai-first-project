import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url),out=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/'):new URL('../dist/',import.meta.url);
await mkdir(out,{recursive:true});
const modules=['macd.js','indicators.js','research.js','providers.js','integrations.js','conclusion.js','quick.js','app.js'];let script='const __modules={};\n';
for(const file of modules){let text=await readFile(new URL(file,root),'utf8');const exports=[...text.matchAll(/^export (?:(?:async )?function|const|let|class) (\w+)/gm)].map(x=>x[1]);text=text.replace(/^import \{([^}]+)\} from '([^']+)';\r?\n/gm,(_,names,path)=>`const {${names}}=__modules[${JSON.stringify(path)}];\n`).replace(/^export /gm,'');script+=`__modules[${JSON.stringify('./'+file)}]=(()=>{\n${text}\nreturn {${exports.join(',')}};\n})();\n`;}
let html=await readFile(new URL('index.html',root),'utf8'),css=await readFile(new URL('style.css',root),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<meta name="data-transport" content="browser"><meta name="theme-color" content="#24594c"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><style>${css.replace(/<\/style/gi,'<\\/style')}</style>`).replace('<script type="module" src="app.js"></script>',()=>`<script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(new URL('index.html',out),html);
await writeFile(new URL('.nojekyll',out),'');
await writeFile(new URL('manifest.webmanifest',out),JSON.stringify({name:'知衡 · A股研究台',short_name:'知衡研究',lang:'zh-CN',start_url:'./',scope:'./',display:'standalone',theme_color:'#24594c',background_color:'#f4f6f3',icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},null,2));
await writeFile(new URL('icon.svg',out),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#24594c"/><text x="96" y="127" text-anchor="middle" font-size="102" fill="white" font-family="sans-serif">衡</text></svg>');
console.log('Built '+out.pathname+'index.html: self-contained mobile site, isolated browser data transport; no Python service required.');
