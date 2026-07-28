const hex = h => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const lum = rgb => { const a = rgb.map(v=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; };
const ratio = (a,b) => { const l1=lum(hex(a)), l2=lum(hex(b)); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };
console.log('--- white text on candidate cyan button fills ---');
for (const c of ['#16b5d8','#0f93b3','#0b7f9e','#0a7189','#086478','#075a6c']) {
  console.log(`  white on ${c}: ${ratio('#ffffff',c).toFixed(2)}:1`);
}
console.log('--- dark text on the bright cyan (alternative) ---');
for (const t of ['#04141a','#062733','#070b12']) {
  console.log(`  ${t} on #16b5d8: ${ratio(t,'#16b5d8').toFixed(2)}:1`);
}
console.log('--- white on steel-blue gradient end candidates ---');
for (const c of ['#4c82d8','#3f6fc0','#3a63ad','#33589b']) {
  console.log(`  white on ${c}: ${ratio('#ffffff',c).toFixed(2)}:1`);
}
