import fs from "node:fs";
const UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126 Safari/537.36"};
const get=async(u,tries=2)=>{for(let i=0;i<tries;i++){try{const r=await fetch(u,{headers:UA});if(r.ok)return await r.text();}catch{}await new Promise(r=>setTimeout(r,400));}return null;};
const cats=fs.readFileSync("/tmp/lgcats.txt","utf8").trim().split("\n")
  .filter(u=>!/policy|contact|deals|about|faq|blog|login|checkout|cart|account|terms|privacy|cancellations|track/.test(u));
console.log("category URLs:",cats.length);
const slugs=new Set();
let pages=0;
for(const c of cats){
  for(let p=1;p<=30;p++){
    const html=await get(p===1?c:`${c}?p=${p}`); pages++;
    if(!html) break;
    const links=[...html.matchAll(/class="product-item-link"[^>]*href="(https:\/\/shop\.legrand\.co\.in\/(?:[a-z0-9-]+|catalog\/product\/view\/[^"]+?))"/g)].map(m=>m[1].replace(/\/category\/\d+\/?$/,""));
    links.forEach(l=>slugs.add(l));
    if(!links.length) break;   // an empty page means past the last page
  }
}
console.log(`listing pages fetched: ${pages} | unique product URLs: ${slugs.size}`);
fs.writeFileSync("/tmp/legrand-urls.json",JSON.stringify([...slugs]));
