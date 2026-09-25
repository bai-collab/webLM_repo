import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const gsap=window.gsap,$=s=>document.querySelector(s);
const canvas=$('#webgl'),narration=$('#narration'),nextBtn=$('#nextBtn'),chatBtn=$('#chatBtn'),chooser=$('#bookChooser'),lockOverlay=$('#lockOverlay');
const quizEl=$('#quiz'),quizQ=$('#quizQ'),answersEl=$('#answers'),quizFeedback=$('#quizFeedback'),badge=$('#badge'),badgeIcon=$('#badgeIcon'),badgeText=$('#badgeText'),closeQuiz=$('#closeQuiz');
const ending=$('#ending'),endBadges=$('#endBadges');
const chatBackdrop=$('#chatBackdrop'),chatPanel=$('#chatPanel'),chatCloseBtn=$('#chatCloseBtn'),chatCharacterName=$('#chatCharacterName'),chatSceneInfo=$('#chatSceneInfo'),chatCharacterSelect=$('#chatCharacterSelect'),loadModelBtn=$('#loadModelBtn'),llmStatus=$('#llmStatus'),llmProgress=$('#llmProgress'),webgpuHint=$('#webgpuHint'),quickPrompts=$('#quickPrompts'),chatMessages=$('#chatMessages'),chatInput=$('#chatInput'),clearChatBtn=$('#clearChatBtn'),sendChatBtn=$('#sendChatBtn');

const STATES={BOOKSHELF:'BOOKSHELF',BOOK_ZOOM:'BOOK_ZOOM',OPEN_COVER:'OPEN_COVER',SCENE_INTERACTION:'SCENE_INTERACTION',PAGE_TURN:'PAGE_TURN',QUIZ:'QUIZ',ENDING:'ENDING'};
let state=STATES.BOOKSHELF,locked=false,currentBook=-1,currentScene=0,completed=new Set(),interacted=false,activeRoot=null,openBook=null,currentCharacters=[],currentCharacterId='';
let webllm=null,engine=null,llmReady=false,llmBusy=false,llmLoading=null,WEBLLM_MODEL='SmolLM2-360M-Instruct-q4f16_1-MLC';

const BOOKS=[
 {title:'桃園三結義',color:0xd86f79,badge:'同心結',icon:'🪢',q:'三人結拜時最重視的承諾是什麼？',a:['A. 很多財寶','B. 誠信與同心協力'],ok:1,scenes:[['第一幕・相遇','桃花輕輕飄落。劉備遇見志同道合的夥伴。','點一下劉備。'],['第二幕・結拜誓言','三人約定彼此扶持，為百姓盡一份心力。','點一下中央酒杯。'],['第三幕・桃花盛放','桃花盛開，三位夥伴向你揮手。','點一下任一角色。']]},
 {title:'草船借箭',color:0x5c7d7b,badge:'神機妙算',icon:'🪶',q:'諸葛亮能借到箭，最關鍵的思維是什麼？',a:['A. 善用天時與逆向思考','B. 船跑得特別快'],ok:0,scenes:[['第一幕・受命','周瑜提出造箭難題，諸葛亮先觀察條件。','點一下羽扇。'],['第二幕・江上大霧','濃霧掩住江面，草船等待曹軍反應。','點一下戰鼓。'],['第三幕・滿載而歸','箭矢插滿草人，輕舟順流返航。','點一下諸葛亮。']]},
 {title:'空城計',color:0x87929c,badge:'臨危不亂',icon:'🎵',q:'面對巨大的困難或恐慌時，我們該學諸葛亮怎麼做？',a:['A. 轉身逃跑','B. 保持冷靜與沉著'],ok:1,scenes:[['第一幕・大開城門','大軍將至，城內兵力不足。城門卻緩緩打開，書僮仍安靜掃地。','點一下城門。'],['第二幕・城樓撫琴','諸葛亮坐在城樓上，神色平靜。','點一下古琴。'],['第三幕・退兵解危','司馬懿懷疑城內有伏兵，最後下令撤退。','點一下司馬懿。']]}
];

const CHAR={liubei:['劉備','溫和、仁厚、重視百姓與承諾。'],guanyu:['關羽','沉穩、重義氣、講信用。'],zhangfei:['張飛','豪爽直接、熱心勇敢。'],zhuge:['諸葛亮','冷靜、善觀察、先思考再行動。'],zhouyu:['周瑜','聰明、嚴謹、會觀察別人的能力。'],simayi:['司馬懿','謹慎、多疑、會衡量風險。'],shutong:['書僮','安靜、守規矩、照安排保持鎮定。']};
const DB={
 '0_0_liubei':[
  ['在等誰？',['你在等誰','為什麼一個人在這裡','你在等朋友嗎','來桃園做什麼'],'我正在尋找志同道合的夥伴，希望能一起做對百姓有幫助的事。'],
  ['為什麼想找夥伴？',['為什麼要找夥伴','自己不行嗎','為什麼需要朋友'],'一個人的力量有限，大家有共同目標、願意互相幫忙，就能做得更好。'],
  ['你最重視什麼？',['你最重視什麼','什麼最重要','你在乎什麼'],'我重視信用、彼此信任，也希望大家把百姓放在心上。']],
 '0_0_guanyu':[
  ['你為什麼來桃園？',['為什麼來桃園','來這裡做什麼','怎麼會來'],'我也在尋找值得一起努力的夥伴，希望能用自己的力量做正直的事。'],
  ['你怎麼看劉備？',['覺得劉備怎樣','怎麼看劉備','相信劉備嗎'],'我看重一個人是不是有信用、願不願意為別人著想。'],
  ['什麼是義氣？',['什麼是義氣','義氣是什麼','朋友怎麼相處'],'義氣不是逞強，而是答應的事努力做到，在朋友需要時不輕易背棄。']],
 '0_0_zhangfei':[
  ['你為什麼也來了？',['為什麼來','怎麼也來了','來桃園做什麼'],'我喜歡和直爽、有志向的人交朋友。遇到值得一起努力的人，我當然想來認識。'],
  ['朋友需要幫忙怎麼辦？',['朋友需要幫忙','朋友有困難怎麼辦','你會幫朋友嗎'],'如果是正確的事情，我會站在夥伴身邊一起想辦法。']],
 '0_1_liubei':[
  ['為什麼要結拜？',['為什麼要結拜','你們為什麼結拜','結拜有什麼用'],'我們希望把共同理想變成長久的承諾，彼此扶持，不因困難就放棄。'],
  ['你們承諾了什麼？',['承諾什麼','約定什麼','最重要的承諾'],'我們最重視彼此誠信、同心協力，也希望一起守護百姓。'],
  ['為什麼要舉杯？',['為什麼喝酒','為什麼舉杯','酒杯代表什麼'],'舉杯是一種儀式，代表我們認真看待這份約定。']],
 '0_1_guanyu':[
  ['你最重視哪個承諾？',['最重視哪個承諾','最在意什麼','重視信用嗎'],'我最重視信用。說出口的承諾，就要盡力做到。'],
  ['同心協力是什麼？',['同心協力是什麼','怎樣才算合作','合作重要嗎'],'同心協力就是大家朝同一個目標前進，各自做好自己的部分，也願意互相補位。']],
 '0_1_zhangfei':[
  ['你會守承諾嗎？',['會守承諾嗎','說話算話嗎','會反悔嗎'],'我答應的事情會努力做到。真正的夥伴不能只在順利時才站在一起。'],
  ['結拜是為了財寶嗎？',['為了錢嗎','為了財寶嗎','想要寶物嗎'],'不是。這次結拜最重要的是信任、合作和共同理想。']],
 '0_2_liubei':[['這段故事想告訴我們什麼？',['故事告訴我們什麼','學到什麼','有什麼道理'],'真正可靠的合作來自信任、誠信和一起努力。'],['好朋友要怎麼相處？',['好朋友怎麼相處','朋友之間最重要什麼'],'要互相尊重、說到做到，也要願意好好溝通。']],
 '0_2_guanyu':[['信任重要嗎？',['信任重要嗎','為什麼要相信朋友'],'信任很重要，但也要用行動維持。'],['合作時要注意什麼？',['合作要注意什麼','怎樣合作比較好'],'先確認共同目標，再把自己的責任做好。']],
 '0_2_zhangfei':[['你從結拜學到什麼？',['你學到什麼','結拜有什麼收穫'],'我學到有力量還不夠，還要信任夥伴、一起商量。'],['為什麼需要團隊？',['為什麼需要團隊','一定要合作嗎'],'遇到大問題時，團隊能互相補足，通常走得更遠。']],
 '1_0_zhuge':[
  ['為什麼三天就夠？',['為什麼三天就夠','三天真的可以嗎','為什麼不用十天'],'我沒有打算一支一支製造，而是先觀察天候、江面和對方可能的反應。'],
  ['遇到難題先做什麼？',['遇到難題先做什麼','怎麼想辦法','第一步是什麼'],'我會先看清楚條件和限制，再找能利用的資源。'],
  ['羽扇是法寶嗎？',['羽扇有什麼用','為什麼搖羽扇','扇子是法寶嗎'],'羽扇不是法寶。真正重要的是觀察、判斷和事前準備。']],
 '1_0_zhouyu':[
  ['為什麼出造箭難題？',['為什麼出難題','為什麼叫他造箭','為什麼考諸葛亮'],'軍中需要箭，我也想看看諸葛亮面對困難時會怎麼處理。'],
  ['你相信三天做得到嗎？',['相信三天嗎','三天做得到嗎','相信諸葛亮嗎'],'三天聽起來很難，所以我也在觀察他到底準備了什麼方法。']],
 '1_2_zhuge':[
  ['為什麼成功借到箭？',['為什麼成功','怎麼借到箭','箭怎麼來的'],'我利用大霧，再用草人和船承接射來的箭，把對方的行動變成自己的資源。'],
  ['為什麼還能喝茶？',['為什麼喝茶','怎麼這麼冷靜','你不緊張嗎'],'因為重要條件事前已經想過，也準備了應變方式。'],
  ['什麼是逆向思考？',['什麼是逆向思考','逆向思考是什麼','為什麼不用自己造箭'],'不只問「怎麼製造箭」，還能問「哪裡已經有箭，我能不能讓它來到我這裡？」。']],
 '2_0_shutong':[
  ['你為什麼還在掃地？',['為什麼還在掃地','敵人來了為什麼掃地','大軍來了還掃'],'我們照諸葛先生的安排，像平常一樣掃地，讓城外的人看不出城裡正在緊張。'],
  ['你會害怕嗎？',['你會害怕嗎','你不怕嗎','你會緊張嗎','為何不逃跑'],'其實會有一點害怕，但越緊張越要先穩住自己，把眼前該做的事情做好。'],
  ['你看到什麼情況？',['你看到什麼','外面怎麼了','看到軍隊嗎'],'我看到城外有大軍靠近，但城門仍然打開，我們也照平常的樣子做自己的事情。'],
  ['為什麼城門要打開？',['為什麼城門打開','城門怎麼不關','開門不危險嗎'],'城門大開、城裡又很平靜，反而可能讓對方懷疑是不是有埋伏。']],
 '2_1_zhuge':[
  ['你為什麼要彈琴？',['為什麼彈琴','怎麼還在彈琴','彈琴有什麼用'],'彈琴能讓城外的人看到我很平靜，進一步懷疑城裡是不是早有準備。'],
  ['你怎麼保持冷靜？',['怎麼保持冷靜','你不怕嗎','怎麼不緊張'],'害怕不代表一定要慌亂。我會先看清楚目前能控制的事情，再穩定行動。'],
  ['這個計畫不危險嗎？',['計畫不危險嗎','如果失敗怎麼辦','不怕被識破嗎'],'這個計畫確實有風險，所以必須建立在對情勢與對手的判斷上。']],
 '2_2_simayi':[
  ['你為什麼撤退？',['為什麼撤退','怎麼退兵了','為什麼不進城'],'城門大開、城內又異常平靜，讓我懷疑裡面可能藏有伏兵，所以先撤退避免冒險。'],
  ['你在懷疑什麼？',['懷疑什麼','在怕什麼','擔心什麼'],'我擔心眼前的平靜是故意做給我看的，如果貿然進城，可能中了安排。'],
  ['謹慎有什麼好處？',['謹慎有什麼好處','為什麼要謹慎','是不是太多疑'],'謹慎能避免資訊不足時做出太冒險的決定，但過度懷疑也可能錯過機會。']]
};

const scene=new THREE.Scene();scene.background=new THREE.Color(0xefe4cf);scene.fog=new THREE.Fog(0xefe4cf,18,42);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(0,7,16);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
const controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=true;controls.target.set(0,1,0);
scene.add(new THREE.HemisphereLight(0xfff5df,0x6c7f68,2.3));const sun=new THREE.DirectionalLight(0xfff0cf,4);sun.position.set(7,13,9);sun.castShadow=true;scene.add(sun);
const world=new THREE.Group();scene.add(world);
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.82});const box=(w,h,d,c)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));const sph=(r,c)=>new THREE.Mesh(new THREE.SphereGeometry(r,14,10),mat(c));const cyl=(r1,r2,h,c)=>new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,12),mat(c));
function add(p,o,x=0,y=0,z=0){o.position.set(x,y,z);p.add(o);o.castShadow=o.receiveShadow=true;return o}
add(world,box(13,.65,6.5,0x9a6746),0,.55,2.2);const shelf=new THREE.Group();shelf.position.set(0,3.6,-5.3);world.add(shelf);add(shelf,box(14,7,.55,0x7c5137),0,0,.4);for(const y of [-2.6,0,2.6])add(shelf,box(13.5,.35,1.6,0x70472f),0,y,0);
const books=[];[-3.3,0,3.3].forEach((x,i)=>{const g=new THREE.Group();add(g,box(2.55,3.78,.2,BOOKS[i].color),0,0,.25);add(g,box(2.4,3.6,.35,0xf9edcf));g.position.set(x,3.55,-4.2);g.userData.book=i;books.push(g);world.add(g)});
function person(id,robe){const g=new THREE.Group();add(g,cyl(.5,.68,1.25,robe),0,1.15,0);add(g,sph(.48,0xf1c7a0),0,2.1,0);add(g,sph(.49,0x332a29),0,2.28,-.08).scale.set(1,.52,1);for(const x of [-.16,.16])add(g,sph(.042,0x302a28),x,2.13,.44);add(g,cyl(.13,.16,.82,robe),-.62,1.3,0).rotation.z=-.35;add(g,cyl(.13,.16,.82,robe),.62,1.3,0).rotation.z=.35;g.userData.id=id;return g}
function openPages(){const g=new THREE.Group();g.position.set(0,1.18,1.65);add(g,box(10.8,.18,6.7,0xf3e5c3));add(g,box(5.15,.12,6.2,0xfffbec),-2.64,.18,0);add(g,box(5.15,.12,6.2,0xfffbec),2.64,.18,0);return g}
function interactive(o,fn){o.userData.action=fn;return o}function bounce(o){gsap.timeline().to(o.scale,{x:1.12,y:.85,z:1.12,duration:.12}).to(o.scale,{x:1,y:1,z:1,duration:.35,ease:'elastic.out(1,.5)'})}function done(){if(!interacted){interacted=true;nextBtn.classList.add('show')}}
function register(id,obj){currentCharacters.push({id,obj,name:CHAR[id]?.[0]||id,persona:CHAR[id]?.[1]||''})}
function buildScene(){if(activeRoot)activeRoot.removeFromParent();activeRoot=new THREE.Group();activeRoot.position.set(0,1.42,1.25);world.add(activeRoot);currentCharacters=[];interacted=false;nextBtn.classList.remove('show');const b=currentBook,s=currentScene;
 if(b===0){[-4,4].forEach(x=>{add(activeRoot,cyl(.25,.35,2.5,0x815438),x,1.25,-1.5);add(activeRoot,sph(1.05,s===2?0xf0a7b0:0x8bad70),x,3,-1.5)});const ids=['liubei','guanyu','zhangfei'],robes=[0x6686a2,0x6c9570,0x9a5d58];ids.forEach((id,i)=>{const p=person(id,robes[i]);p.position.set((i-1)*2.1,0,.4);activeRoot.add(p);register(id,p);interactive(p,()=>{bounce(p);done()})});if(s===1){const c=add(activeRoot,cyl(.3,.2,.5,0xe0b65f),0,.55,2.1);interactive(c,()=>{gsap.to(c.position,{y:1.2,duration:.3,yoyo:true,repeat:1});done()})}}
 if(b===1){const z=person('zhuge',0x8896a5);z.position.set(1.7,0,.4);activeRoot.add(z);register('zhuge',z);if(s===0){const y=person('zhouyu',0x7a5960);y.position.set(-1.8,0,.4);activeRoot.add(y);register('zhouyu',y);interactive(z,()=>{bounce(z);done()})}if(s===1){const boat=add(activeRoot,box(5,.6,1.5,0x71503b),-1,.4,.4);const drum=add(activeRoot,cyl(.5,.5,.7,0xb6604d),3.6,.8,.3);drum.rotation.z=Math.PI/2;interactive(drum,()=>{gsap.to(boat.position,{x:1,duration:1.2});done()})}if(s===2)interactive(z,()=>{bounce(z);done()})}
 if(b===2){if(s===0){const gate=add(activeRoot,box(5.8,4.6,.35,0x76523c),0,2.3,-1);const a=person('shutong',0xb5a68c),c=person('shutong',0xb5a68c);a.scale.set(.58,.58,.58);c.scale.set(.58,.58,.58);a.position.set(-1.4,0,1.2);c.position.set(1.4,0,1.2);activeRoot.add(a,c);register('shutong',a);interactive(gate,()=>{gsap.to(gate.scale,{x:.05,duration:1});done()})}if(s===1){const z=person('zhuge',0x8799a7);z.position.set(0,1.2,0);activeRoot.add(z);register('zhuge',z);const q=add(activeRoot,box(2.5,.18,.65,0x68453a),0,1.7,1);interactive(q,()=>{bounce(z);done()})}if(s===2){const p=person('simayi',0x4f5963);p.position.set(2.2,0,1);activeRoot.add(p);register('simayi',p);interactive(p,()=>{gsap.to(p.position,{x:7,duration:1.6});done()})}}
 gsap.from(activeRoot.scale,{x:.01,y:.01,z:.01,duration:.7,ease:'back.out(1.5)'});updateChatButton();}
function cameraMove(y=6.5,z=15){gsap.to(camera.position,{x:0,y,z,duration:1,ease:'power2.inOut'});gsap.to(controls.target,{x:0,y:1.3,z:1,duration:1})}
function narrate(){const d=BOOKS[currentBook].scenes[currentScene];$('#sceneTitle').textContent=`${BOOKS[currentBook].title}｜${d[0]}`;$('#storyText').textContent=d[1];$('#hintText').textContent=d[2];narration.classList.remove('hidden')}
function startBook(i){if(locked||state!==STATES.BOOKSHELF)return;currentBook=i;state=STATES.BOOK_ZOOM;locked=true;chooser.style.display='none';books.forEach((b,j)=>{if(j!==i)gsap.to(b.scale,{x:.01,y:.01,z:.01,duration:.4})});gsap.to(books[i].position,{x:0,y:3.5,z:1,duration:.8,onComplete:()=>{books[i].visible=false;openBook=openPages();world.add(openBook);currentScene=0;state=STATES.SCENE_INTERACTION;locked=false;narrate();buildScene();cameraMove()}})}
function nextPage(){if(!interacted||locked)return;locked=true;state=STATES.PAGE_TURN;gsap.to(activeRoot.scale,{x:.2,y:.02,z:.02,duration:.3,onComplete:()=>{if(currentScene<2){currentScene++;state=STATES.SCENE_INTERACTION;locked=false;narrate();buildScene()}else showQuiz()}})}
function showQuiz(){state=STATES.QUIZ;locked=false;narration.classList.add('hidden');chatPanel.classList.remove('show');chatBackdrop.classList.remove('show');const d=BOOKS[currentBook];quizQ.textContent=d.q;answersEl.innerHTML='';quizFeedback.textContent='';badge.classList.remove('show');closeQuiz.classList.remove('show');d.a.forEach((t,i)=>{const b=document.createElement('button');b.className='answer';b.textContent=t;b.onclick=()=>{if(i===d.ok){quizFeedback.textContent='答對了！';badgeIcon.textContent=d.icon;badgeText.textContent=`獲得「${d.badge}」徽章`;badge.classList.add('show');closeQuiz.classList.add('show');completed.add(currentBook)}else quizFeedback.textContent='再想一下：故事人物是靠什麼解決問題的？'};answersEl.appendChild(b)});quizEl.classList.add('show')}
function backShelf(){quizEl.classList.remove('show');if(activeRoot)activeRoot.removeFromParent();if(openBook)openBook.removeFromParent();books.forEach((b,i)=>{b.visible=true;b.position.set([-3.3,0,3.3][i],3.55,-4.2);b.scale.set(1,1,1)});narration.classList.add('hidden');chooser.style.display='flex';currentBook=-1;state=STATES.BOOKSHELF;cameraMove(7,16);if(completed.size===3){endBadges.innerHTML=BOOKS.map(x=>`<span class="endBadge">${x.icon} ${x.badge}</span>`).join('');ending.style.display='flex';state=STATES.ENDING}}

function key(){const id=currentCharacterId.startsWith('shutong')?'shutong':currentCharacterId;return `${currentBook}_${currentScene}_${id}`}
function intents(){return DB[key()]||[]}
function updateChatButton(){const ok=currentCharacters.some(c=>DB[`${currentBook}_${currentScene}_${c.id.startsWith('shutong')?'shutong':c.id}`]);chatBtn.classList.toggle('show',state===STATES.SCENE_INTERACTION);chatBtn.disabled=!ok}
function renderQuick(){quickPrompts.innerHTML='';intents().forEach(it=>{const b=document.createElement('button');b.className='quickChip';b.textContent=it[0];b.onclick=()=>{chatInput.value=it[0];chatInput.focus()};quickPrompts.appendChild(b)})}
function openChat(){const available=currentCharacters.filter(c=>DB[`${currentBook}_${currentScene}_${c.id.startsWith('shutong')?'shutong':c.id}`]);if(!available.length)return;chatCharacterSelect.innerHTML='';available.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;chatCharacterSelect.appendChild(o)});currentCharacterId=available[0].id;chatCharacterName.textContent=available[0].name;chatSceneInfo.textContent=`${BOOKS[currentBook].title}｜${BOOKS[currentBook].scenes[currentScene][0]}｜語意模型只負責選擇預設回答。`;renderQuick();if(!chatMessages.children.length)addMsg('system','你可以用自己的說法提問；若問題不屬於目前腳本，就會回答「超出範圍」。','導覽');chatBackdrop.classList.add('show');chatPanel.classList.add('show')}
function addMsg(role,text,name){const w=document.createElement('div');w.className=`msg ${role}`;const n=document.createElement('div');n.className='msgName';n.textContent=name|| (role==='user'?'你':CHAR[currentCharacterId]?.[0]||'角色');const b=document.createElement('div');b.textContent=text;w.append(n,b);chatMessages.appendChild(w)}
function norm(s){return String(s).toLowerCase().replace(/[\s，。！？、,.!?：:；;「」『』（）()"'`~\-]/g,'')}
function fastMatch(q){const n=norm(q);for(const it of intents())for(const e of [it[0],...it[1]].map(norm))if(n===e||(e.length>=5&&(n.includes(e)||e.includes(n))))return it;return null}
async function loadLLM(){if(engine&&llmReady)return engine;if(llmLoading)return llmLoading;if(!navigator.gpu)throw new Error('此瀏覽器沒有 WebGPU');llmLoading=(async()=>{llmStatus.textContent='正在載入 WebLLM…';webllm=await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm');const adapter=await navigator.gpu.requestAdapter();const hasF16=adapter?.features?.has('shader-f16');WEBLLM_MODEL=hasF16?'SmolLM2-360M-Instruct-q4f16_1-MLC':'SmolLM2-360M-Instruct-q4f32_1-MLC';const appConfig={...webllm.prebuiltAppConfig,cacheBackend:'indexeddb'};engine=await webllm.CreateMLCEngine(WEBLLM_MODEL,{appConfig,initProgressCallback:r=>{if(typeof r.progress==='number')llmProgress.style.width=`${Math.round(r.progress*100)}%`;llmStatus.textContent=r.text||'正在載入語意模型…'}});llmReady=true;llmStatus.textContent=`語意模型已就緒：${WEBLLM_MODEL}`;loadModelBtn.textContent='語意模型已就緒';return engine})().finally(()=>llmLoading=null);return llmLoading}
async function classify(q){const hit=fastMatch(q);if(hit)return hit;const arr=intents();if(!arr.length)return null;const e=await loadLLM();const opts=arr.map((x,i)=>`I${i+1}：${x[0]}；例句：${x[1].join('、')}`).join('\n');const prompt=`你是兒童繪本的意圖分類器，不是聊天機器人。只能從 I1 到 I${arr.length} 或 OUT 選一個。問題與目前角色、場景或意圖無關就輸出 OUT。只輸出標籤，不解釋。\n${opts}\n學生問題：${q}\n標籤：`;const r=await e.chat.completions.create({messages:[{role:'user',content:prompt}],temperature:0,max_tokens:6});const raw=(r?.choices?.[0]?.message?.content||'').toUpperCase();const m=raw.match(/I([1-9])|OUT/);if(!m||m[0]==='OUT')return null;return arr[Number(m[1])-1]||null}
async function ask(){const q=chatInput.value.trim();if(!q||llmBusy)return;llmBusy=true;sendChatBtn.disabled=true;addMsg('user',q,'你');chatInput.value='';try{const it=await classify(q);addMsg('assistant',it?it[2]:'超出範圍');llmStatus.textContent=it?`已匹配：${it[0]}`:'未找到對應腳本：超出範圍'}catch(e){addMsg('system','語意模型目前無法使用。','導覽');llmStatus.textContent=`語意模型失敗：${e.message}`}finally{llmBusy=false;sendChatBtn.disabled=false}}

const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();canvas.addEventListener('pointerdown',e=>{if(locked||chatPanel.classList.contains('show'))return;mouse.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1));ray.setFromCamera(mouse,camera);if(state===STATES.BOOKSHELF){const h=ray.intersectObjects(books,true)[0];if(h){let o=h.object;while(o.parent&&!Number.isInteger(o.userData.book))o=o.parent;if(Number.isInteger(o.userData.book))startBook(o.userData.book)}return}if(state===STATES.SCENE_INTERACTION&&activeRoot){const h=ray.intersectObject(activeRoot,true)[0];if(h){let o=h.object;while(o&&o!==activeRoot&&!o.userData.action)o=o.parent;if(o?.userData.action)o.userData.action()}}});
chooser.addEventListener('click',e=>{const b=e.target.closest('[data-book]');if(b)startBook(Number(b.dataset.book))});nextBtn.addEventListener('click',nextPage);closeQuiz.addEventListener('click',backShelf);$('#restartBtn').addEventListener('click',()=>{ending.style.display='none';completed.clear();backShelf()});chatBtn.addEventListener('click',openChat);chatBackdrop.addEventListener('click',()=>{chatPanel.classList.remove('show');chatBackdrop.classList.remove('show')});chatCloseBtn.addEventListener('click',()=>{chatPanel.classList.remove('show');chatBackdrop.classList.remove('show')});chatCharacterSelect.addEventListener('change',()=>{currentCharacterId=chatCharacterSelect.value;chatCharacterName.textContent=CHAR[currentCharacterId]?.[0]||currentCharacterId;renderQuick()});loadModelBtn.addEventListener('click',async()=>{loadModelBtn.disabled=true;try{await loadLLM()}catch(e){llmStatus.textContent=`WebLLM 啟動失敗：${e.message}`}finally{loadModelBtn.disabled=false}});sendChatBtn.addEventListener('click',ask);chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}});clearChatBtn.addEventListener('click',()=>{chatMessages.innerHTML=''});

webgpuHint.textContent=navigator.gpu?'SmolLM2 僅做語意分類；回答內容來自預設腳本。':'此瀏覽器未偵測到 WebGPU。';
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
setTimeout(()=>$('#loading')?.remove(),500);window.__POPBOOK__={get state(){return state},get currentBook(){return currentBook},get currentScene(){return currentScene},loadLLM};
