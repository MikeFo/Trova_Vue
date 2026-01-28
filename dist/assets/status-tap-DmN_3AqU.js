import{f as a,h as i,j as c,w as d,s as l}from"./index-CkJ7yJ3n.js";/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const h=()=>{const e=window;e.addEventListener("statusTap",()=>{a(()=>{const o=e.innerWidth,s=e.innerHeight,n=document.elementFromPoint(o/2,s/2);if(!n)return;const t=i(n);t&&new Promise(r=>c(t,r)).then(()=>{d(async()=>{t.style.setProperty("--overflow","hidden"),await l(t,300),t.style.removeProperty("--overflow")})})})})};export{h as startStatusTap};
