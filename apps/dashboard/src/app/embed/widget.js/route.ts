import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const org = searchParams.get("org") ?? ""
  const agent = searchParams.get("agent") ?? ""
  const theme = searchParams.get("theme") ?? "dark"
  const position = searchParams.get("position") ?? "br"

  const positionStyles: Record<string, string> = {
    br: "bottom:20px;right:20px;",
    bl: "bottom:20px;left:20px;",
    tr: "top:20px;right:20px;",
    tl: "top:20px;left:20px;",
  }

  const posStyle = positionStyles[position] || positionStyles.br

  const origin = request.nextUrl.origin
  const ease = "cubic-bezier(0.16,1,0.3,1)"

  const js = `(function(){
  if(document.getElementById("struere-widget"))return;

  var isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var openW=isMobile?Math.min(400,window.innerWidth-24)+"px":"400px";
  var openH=isMobile?Math.min(600,window.innerHeight-40)+"px":"600px";
  var openR=isMobile?"12px":"16px";

  var el=document.createElement("div");
  el.id="struere-widget";
  el.style.cssText="position:fixed;${posStyle}z-index:2147483647;width:56px;height:56px;background:none;border:none;overflow:visible;cursor:pointer;max-width:calc(100vw - 24px);max-height:calc(100vh - 40px);transition:width 600ms ${ease},height 600ms ${ease},border-radius 600ms ${ease},box-shadow 500ms ${ease},border-color 500ms ${ease},transform 500ms ${ease},background 400ms ${ease},border 400ms ${ease};-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);";

  var icon=document.createElement("div");
  icon.style.cssText="position:absolute;inset:0;z-index:2;transition:opacity 250ms ${ease},transform 500ms ${ease};filter:drop-shadow(0 4px 16px rgba(0,0,0,0.3));";
  var clipPath="path("+'"'+"M42 30a4 4 0 0 1-4 4H14l-8 8V10a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4z"+'"'+")";
  icon.innerHTML='<div style="position:absolute;inset:4px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:radial-gradient(ellipse at center,rgba(10,15,30,0.85) 0%,rgba(15,20,40,0.75) 50%,rgba(20,30,50,0.65) 100%);"></div><svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:4px;" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.5" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  icon.firstChild.style.clipPath=clipPath;

  var bar=document.createElement("div");
  bar.style.cssText="position:absolute;top:0;left:0;right:0;z-index:3;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(20,30,50,0.6);opacity:0;pointer-events:none;transition:opacity 300ms ${ease};";
  var link=document.createElement("link");
  link.rel="stylesheet";
  link.href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap";
  document.head.appendChild(link);

  var label=document.createElement("span");
  label.style.cssText="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:11px;letter-spacing:0.05em;color:rgba(255,255,255,0.5);";
  label.innerHTML='Powered by <span style="font-family:Fraunces,Georgia,serif;font-weight:600;font-size:12px;letter-spacing:0.01em;">Struere</span>';
  var xBtn=document.createElement("div");
  xBtn.style.cssText="width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:4px;transition:background 200ms;";
  xBtn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  xBtn.onmouseenter=function(){xBtn.style.background="rgba(255,255,255,0.1)";};
  xBtn.onmouseleave=function(){xBtn.style.background="transparent";};
  bar.appendChild(label);
  bar.appendChild(xBtn);

  var iframe=document.createElement("iframe");
  iframe.src="${origin}/embed/${org}/${agent}?theme=${theme}";
  iframe.allow="clipboard-read;clipboard-write";
  iframe.style.cssText="position:absolute;top:28px;left:0;right:0;bottom:0;width:100%;height:calc(100% - 28px);border:none;opacity:0;pointer-events:none;transition:opacity 400ms ${ease};background:transparent;color-scheme:normal;";
  iframe.setAttribute("scrolling","no");

  el.appendChild(iframe);
  el.appendChild(icon);
  el.appendChild(bar);
  document.body.appendChild(el);

  var open=false;

  el.onmouseenter=function(){if(!open){icon.style.transform="scale(1.1)";}};
  el.onmouseleave=function(){if(!open){icon.style.transform="scale(1)";}};

  el.onclick=function(){
    if(open)return;
    open=true;
    el.style.transition="none";
    el.style.overflow="hidden";
    el.style.background="radial-gradient(ellipse at center,rgba(20,30,50,0.45) 0%,rgba(20,30,50,0.3) 50%,rgba(20,30,50,0.2) 100%)";
    el.style.border="1px solid rgba(255,255,255,0.15)";
    el.style.backdropFilter="blur(20px)";
    el.style.webkitBackdropFilter="blur(20px)";
    el.style.boxShadow="inset 0 1px 0 0 rgba(255,255,255,0.15),0 8px 32px rgba(0,0,0,0.3),0 32px 64px rgba(0,0,0,0.15)";
    el.offsetHeight;
    el.style.transition="width 600ms ${ease},height 600ms ${ease},border-radius 600ms ${ease},box-shadow 500ms ${ease},transform 500ms ${ease}";
    el.style.width=openW;
    el.style.height=openH;
    el.style.borderRadius=openR;
    el.style.cursor="default";
    el.style.transform="scale(1) translate3d(0,0,0)";
    icon.style.opacity="0";
    icon.style.pointerEvents="none";
    setTimeout(function(){
      iframe.style.opacity="1";
      iframe.style.pointerEvents="auto";
      bar.style.opacity="1";
      bar.style.pointerEvents="auto";
    },300);
  };

  function closeWidget(){
    open=false;
    iframe.style.opacity="0";
    iframe.style.pointerEvents="none";
    bar.style.opacity="0";
    bar.style.pointerEvents="none";
    setTimeout(function(){
      el.style.transition="none";
      el.style.width="56px";
      el.style.height="56px";
      el.style.borderRadius="0";
      el.style.cursor="pointer";
      el.style.overflow="visible";
      el.style.background="none";
      el.style.border="none";
      el.style.backdropFilter="none";
      el.style.webkitBackdropFilter="none";
      el.style.boxShadow="none";
      el.offsetHeight;
      el.style.transition="transform 500ms ${ease}";
      icon.style.opacity="1";
      icon.style.pointerEvents="auto";
    },150);
  }

  xBtn.onclick=function(e){e.stopPropagation();closeWidget();};

  window.addEventListener("message",function(e){
    if(e.data&&e.data.type==="struere:message"){
      var evt=new CustomEvent("struere:message",{detail:e.data});
      window.dispatchEvent(evt);
    }
  });
})();`

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
