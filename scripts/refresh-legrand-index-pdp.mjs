import fs from "node:fs";
const UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126 Safari/537.36"};
const urls=JSON.parse(fs.readFileSync("/tmp/legrand-urls.json","utf8"));
const out=[]; let done=0, fail=0;
async function one(u){
  try{
    const r=await fetch(u,{headers:UA}); if(!r.ok){fail++;return;}
    const h=await r.text();
    const name=(h.match(/"name":"([^"]{4,120})"/)||[])[1];
    const sku=(h.match(/\bSKU\b[^0-9A-Z]{0,40}([0-9A-Z][0-9A-Z ]{4,12})/)||[])[1]?.trim();
    const prices=[...h.matchAll(/<span class="price">\s*₹\s*([\d,]+(?:\.\d+)?)/g)].map(m=>Number(m[1].replace(/,/g,"")));
    const img=(h.match(/(https:\/\/shop\.legrand\.co\.in\/media\/catalog\/product[^"\\]+?\.(?:jpg|png|webp))/)||[])[1];
    const oos=/out of stock|availability:\s*out/i.test(h);
    if(name&&prices.length){
      const sell=prices[0], mrp=prices.length>1?Math.max(...prices.slice(0,2)):prices[0];
      out.push({url:u,slug:u.replace("https://shop.legrand.co.in/",""),name,sku:sku?.replace(/\s+/g,"")||null,sell,mrp,img:img||null,inStock:!oos});
    } else fail++;
  }catch{fail++;}
  finally{done++; if(done%150===0) console.log(`  ${done}/${urls.length}...`);}
}
const CONC=6;
for(let i=0;i<urls.length;i+=CONC){ await Promise.all(urls.slice(i,i+CONC).map(one)); }
fs.writeFileSync("/tmp/legrand-index.json",JSON.stringify(out,null,0));
console.log(`indexed ${out.length}/${urls.length} (failed ${fail}) | with SKU: ${out.filter(x=>x.sku).length}`);
