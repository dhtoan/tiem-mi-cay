(()=>{
'use strict';
const REWARD=300000,KEY='aunomay_pending_ref',SHOWN='aunomay_ref_zero_shown';
const $=id=>document.getElementById(id);
const money=v=>(Math.round(Number(v||0)/1000)).toLocaleString('vi-VN')+'k';
const gameName=()=>/mì cay/i.test(document.title)?'Tiệm Mì Cay':'Tiệm Trà Nhỏ';
const palette=()=>/mì cay/i.test(document.title)?{a:'#7A3346',b:'#EF4B3F',c:'#FFD6DC'}:{a:'#9A5A48',b:'#EF6F8E',c:'#FDE3B5'};
let info=null,lastZero=false;

function cleanCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16)}
function captureRef(){
  const u=new URL(location.href),code=cleanCode(u.searchParams.get('ref'));
  if(!code)return;
  try{localStorage.setItem(KEY,code)}catch{}
  u.searchParams.delete('ref');
  try{history.replaceState({},document.title,u.pathname+(u.search||'')+u.hash)}catch{}
}
async function api(path,opt={}){
  try{
    const r=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
    const j=await r.json().catch(()=>({}));
    return {ok:r.ok,status:r.status,j};
  }catch(e){return {ok:false,status:0,j:{error:'Không kết nối được máy chủ.'}}}
}
function ensureDlg(){
  let d=$('aunoReferralDlg');if(d)return d;
  d=document.createElement('dialog');d.id='aunoReferralDlg';
  d.innerHTML='<div class="arBox"><div class="arHead"><div class="arIcon">🎁</div><div><h2>Hết vốn? Rủ bạn cùng chơi</h2><p>Chia sẻ link giới thiệu để cứu két và kéo thêm bạn vào quán.</p></div></div><div class="arReward"><b>+300k cho cả hai</b><small>Bạn và người được mời đều nhận thưởng sau khi người mới đăng nhập và nhận lời mời.</small></div><div id="arGuest" class="arGuest" hidden>Đăng nhập hoặc tạo tài khoản để có link giới thiệu riêng và nhận thưởng.</div><div id="arSigned" hidden><div class="arLink"><input id="arLink" readonly aria-label="Link giới thiệu"><button class="arSecondary" id="arCopy" type="button">Chép</button></div><div class="arBtns"><button class="arPrimary" id="arShare" type="button">Chia sẻ link</button><button class="arSecondary" id="arQr" type="button">Tạo QR đẹp</button></div><div class="arPreview" id="arPreview"></div></div><div class="arBtns" id="arGuestBtns" hidden><button class="arPrimary" id="arLogin" type="button">Đăng nhập / Tạo tài khoản</button><button class="arSecondary" id="arLater" type="button">Để sau</button></div><div class="arStatus" id="arStatus"></div><button class="arClose" id="arClose" type="button">Đóng</button></div>';
  document.body.appendChild(d);
  $('arClose').onclick=()=>d.close();$('arLater').onclick=()=>d.close();
  $('arLogin').onclick=()=>{d.close();document.getElementById('cloudAccountBtn')?.click()};
  $('arCopy').onclick=()=>shareLink(false);$('arShare').onclick=()=>shareLink(true);$('arQr').onclick=makeQrCard;
  return d;
}
function status(t){const e=$('arStatus');if(e)e.textContent=t||''}
async function auth(){
  const r=await api('/api/auth/me',{method:'GET'});return r.ok&&r.j.authenticated?r.j.user:null
}
async function referralInfo(){
  const r=await api('/api/referral/me',{method:'GET'});if(!r.ok)return null;info=r.j;return info
}
async function claimPending(){
  let code='';try{code=cleanCode(localStorage.getItem(KEY))}catch{}
  const user=await auth();if(!user)return false;
  if(code){
    const r=await api('/api/referral/claim',{method:'POST',body:JSON.stringify({code})});
    if(r.ok||r.status===409){try{localStorage.removeItem(KEY)}catch{}}
  }
  await takeRewards();
  return true;
}
async function takeRewards(){
  const r=await api('/api/referral/rewards/take',{method:'POST',body:'{}'});
  const amount=Number(r.j?.amount||0);
  if(r.ok&&amount>0&&typeof window.getMoney==='function'&&typeof window.setMoney==='function'){
    window.setMoney(Number(window.getMoney()||0)+amount);
    const d=ensureDlg();d.showModal();status('🎉 Đã cộng '+money(amount)+' thưởng giới thiệu vào két!');
    lastZero=false;try{sessionStorage.removeItem(SHOWN)}catch{}
  }
}
async function open(reason='manual'){
  const d=ensureDlg();status('Đang lấy link giới thiệu…');
  const user=await auth();
  $('arGuest').hidden=!!user;$('arGuestBtns').hidden=!!user;$('arSigned').hidden=!user;
  if(!user){status('Tạo tài khoản một lần để dùng ref trên mọi thiết bị.');d.showModal();return}
  const r=await referralInfo();
  if(!r){status('Chưa tạo được link giới thiệu. Thử lại sau.');d.showModal();return}
  $('arLink').value=r.link;
  status(reason==='zero'?'Két đã cạn — chia sẻ link hoặc QR để rủ bạn cứu vốn.':'Link của bạn đã sẵn sàng.');
  d.showModal();
}
async function shareLink(native){
  if(!info)await referralInfo();if(!info)return status('Chưa có link giới thiệu.');
  const title=gameName()+' — chơi cùng mình!';
  const text='Mình đang chơi '+gameName()+'. Vào chơi bằng link này, cả hai cùng nhận 300k vốn 🎁';
  if(native&&navigator.share){try{await navigator.share({title,text,url:info.link});return}catch(e){if(e?.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(info.link);status('Đã chép link giới thiệu.')}catch{status('Giữ vào ô link để chép thủ công.')}
}
function qrCanvas(link){
  return new Promise((resolve,reject)=>{
    if(typeof QRCode==='undefined')return reject(new Error('QR chưa sẵn sàng'));
    const box=document.createElement('div');box.style.cssText='position:fixed;left:-9999px;top:-9999px;background:#fff';document.body.appendChild(box);
    new QRCode(box,{text:link,width:500,height:500,colorDark:'#251712',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    setTimeout(()=>{
      const q=box.querySelector('canvas'),im=box.querySelector('img');
      if(q){box.remove();resolve(q);return}
      if(im){const c=document.createElement('canvas');c.width=500;c.height=500;const x=c.getContext('2d');const img=new Image();img.onload=()=>{x.drawImage(img,0,0,500,500);box.remove();resolve(c)};img.onerror=reject;img.src=im.src;return}
      box.remove();reject(new Error('Không tạo được QR'));
    },80);
  })
}
async function makeQrCard(){
  if(!info)await referralInfo();if(!info)return status('Chưa có link giới thiệu.');
  status('Đang thiết kế ảnh QR…');
  try{
    const qr=await qrCanvas(info.link),p=palette(),c=document.createElement('canvas');c.width=900;c.height=1200;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,900,1200);g.addColorStop(0,p.a);g.addColorStop(1,p.b);x.fillStyle=g;x.fillRect(0,0,900,1200);
    x.fillStyle='rgba(255,255,255,.12)';for(let i=0;i<22;i++){x.beginPath();x.arc((i*137)%900,(i*211)%1200,22+(i%4)*10,0,Math.PI*2);x.fill()}
    x.fillStyle='#fffaf5';x.fillRect(70,85,760,1030);
    x.textAlign='center';x.fillStyle='#3d241d';x.font='800 52px system-ui';x.fillText(gameName(),450,175);
    x.fillStyle=p.b;x.font='900 66px system-ui';x.fillText('CỨU KÉT +300K',450,255);
    x.fillStyle='#6d5147';x.font='600 29px system-ui';x.fillText('Quét QR để vào chơi — cả hai cùng nhận thưởng',450,310);
    x.fillStyle='#fff';x.fillRect(165,365,570,570);x.drawImage(qr,200,400,500,500);
    x.fillStyle='#3d241d';x.font='800 34px system-ui';x.fillText('Quét để mở quán cùng mình',450,985);
    x.fillStyle='#80665b';x.font='500 24px system-ui';x.fillText('Aunomay · '+location.host,450,1040);
    x.fillStyle=p.c;x.fillRect(250,1075,400,6);
    const blob=await new Promise(r=>c.toBlob(r,'image/png',.95));
    const url=URL.createObjectURL(blob),im=new Image();im.src=url;im.alt='QR giới thiệu '+gameName();$('arPreview').replaceChildren(im);
    const file=new File([blob],(gameName()==='Tiệm Mì Cay'?'tiem-mi-cay':'tiem-tra-nho')+'-ref-'+info.code+'.png',{type:'image/png'});
    const canFile=!!(navigator.canShare&&navigator.canShare({files:[file]}));
    const btn=$('arQr');btn.textContent=canFile?'Chia sẻ ảnh QR':'Tải ảnh QR';
    btn.onclick=async()=>{if(canFile){try{await navigator.share({files:[file],title:gameName()+' — QR mời bạn'});return}catch(e){if(e?.name==='AbortError')return}}const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove()};
    status('Ảnh QR đã sẵn sàng.');
  }catch(e){status('Không tạo được ảnh QR trên trình duyệt này.')}
}
function monitorMoney(){
  if(typeof window.getMoney!=='function')return;
  const z=Number(window.getMoney())<=0;
  if(z&&!lastZero){let shown=false;try{shown=sessionStorage.getItem(SHOWN)==='1'}catch{}if(!shown){try{sessionStorage.setItem(SHOWN,'1')}catch{}open('zero')}}
  if(!z){try{sessionStorage.removeItem(SHOWN)}catch{}}
  lastZero=z;
}
captureRef();
addEventListener('DOMContentLoaded',()=>{ensureDlg();setTimeout(()=>claimPending(),1200);setInterval(monitorMoney,1600);setInterval(()=>claimPending(),20000)});
addEventListener('visibilitychange',()=>{if(!document.hidden)claimPending()});
window.AunomayReferral={open,claimPending,takeRewards};
})();