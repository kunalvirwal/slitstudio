import { DEFAULT } from './model.js';
export const PALETTES = [
  ['#15100f','#e83720','#ffb296'], ['#070d13','#276ad3','#bcf5ff'],
  ['#16102b','#7247d5','#e9baff'], ['#111e1a','#4f9b7a','#e3ecc2'],
  ['#18130e','#b78b4b','#fff3ce'], ['#151b24','#5f87af','#f3f4ec'],
  ['#22132e','#e65a97','#ffd8ac'], ['#102021','#25a797','#c9ffee']
];
export const PRESETS = [
  { id:'vermilion',name:'Vermilion',description:'Warm light, sharp cuts',settings:{} },
  { id:'cobalt',name:'Cobalt',description:'A study in blue',settings:{dark:'#070d13',mid:'#276ad3',light:'#bcf5ff',flow:18,scale:57,tilt:-32,count:28,offset:32,gloss:72,seed:60214,vignette:46,phase:2} },
  { id:'iridescent',name:'Iridescent',description:'Liquid, without limits',settings:{dark:'#151b24',mid:'#3c71d1',light:'#f3f4ec',material:'chrome',flow:70,scale:125,tilt:-29,slits:false,count:20,gloss:85,grain:36,texture:'frosted',textureAmount:19,seed:8346,contrast:48,vignette:8} },
  { id:'orchid',name:'Orchid',description:'Soft edges, deep color',settings:{dark:'#16102b',mid:'#7247d5',light:'#e9baff',flow:57,scale:94,tilt:24,count:19,angle:-18,offset:48,gloss:73,seed:28416,grain:17} },
  { id:'moss',name:'Moss',description:'Something more organic',settings:{dark:'#111e1a',mid:'#4f9b7a',light:'#e3ecc2',material:'silk',flow:60,scale:65,tilt:13,count:32,offset:23,gloss:44,texture:'woven',textureAmount:30,grain:28,seed:7243} },
  { id:'champagne',name:'Champagne',description:'A softer kind of metal',settings:{dark:'#18130e',mid:'#b78b4b',light:'#fff3ce',material:'chrome',flow:27,scale:90,tilt:-36,count:20,offset:34,gloss:82,texture:'brushed',textureAmount:38,grain:16,seed:9613} }
].map(p=>({...p,recipe:{...DEFAULT,...p.settings}}));
