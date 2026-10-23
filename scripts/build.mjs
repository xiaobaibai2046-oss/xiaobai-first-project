import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const [template,css,restaurants,guides,map,preparation,data,app]=await Promise.all(['scripts/index.template.html','style.css','restaurants.js','recommendations.js','route-map.js','preparation.js','data.js','app.js'].map(read));
const inline = source => source.replace(/^import .* from '\.\/[^']+';\r?\n/gm,'').replace(/^export /gm,'');
const script=[restaurants,guides,map,preparation,data,app].map(inline).join('\n');
// Escape HTML closing tags so script/style text cannot terminate their container.
const html=template.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style>').replace('<script type="module" src="app.js"></script>',()=>'<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
await writeFile(new URL('index.html',root),html);
console.log('Built self-contained index.html');
