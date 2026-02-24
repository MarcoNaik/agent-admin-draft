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

  var el=document.createElement("div");
  el.id="struere-widget";
  el.style.cssText="position:fixed;${posStyle}z-index:2147483647;width:56px;height:56px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(20,30,50,0.45) 0%,rgba(20,30,50,0.3) 50%,rgba(20,30,50,0.2) 100%);border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 1px 0 0 rgba(255,255,255,0.25),inset 0 -1px 0 0 rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.15);overflow:hidden;cursor:pointer;max-width:calc(100vw - 40px);max-height:80vh;transition:width 600ms ${ease},height 600ms ${ease},border-radius 600ms ${ease},box-shadow 500ms ${ease},border-color 500ms ${ease},transform 500ms ${ease};";

  var icon=document.createElement("div");
  icon.style.cssText="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;transition:opacity 250ms ${ease};";
  icon.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var bar=document.createElement("div");
  bar.style.cssText="position:absolute;top:0;left:0;right:0;z-index:3;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(20,30,50,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity 300ms ${ease};";
  var label=document.createElement("span");
  label.style.cssText="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:10px;letter-spacing:0.05em;color:rgba(255,255,255,0.5);";
  label.textContent="Powered by Struere";
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
  iframe.style.cssText="position:absolute;top:28px;left:0;right:0;bottom:0;width:100%;height:calc(100% - 28px);border:none;opacity:0;pointer-events:none;transition:opacity 400ms ${ease};";

  el.appendChild(iframe);
  el.appendChild(icon);
  el.appendChild(bar);
  document.body.appendChild(el);

  var open=false;

  el.onmouseenter=function(){if(!open){el.style.transform="scale(1.08)";el.style.borderColor="rgba(255,255,255,0.3)";el.style.boxShadow="inset 0 1px 0 0 rgba(255,255,255,0.3),inset 0 -1px 0 0 rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.2),0 0 24px rgba(180,140,100,0.12)";}};
  el.onmouseleave=function(){if(!open){el.style.transform="scale(1)";el.style.borderColor="rgba(255,255,255,0.15)";el.style.boxShadow="inset 0 1px 0 0 rgba(255,255,255,0.25),inset 0 -1px 0 0 rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.15)";}};

  el.onclick=function(){
    if(open)return;
    open=true;
    el.style.width="400px";
    el.style.height="600px";
    el.style.borderRadius="16px";
    el.style.cursor="default";
    el.style.transform="scale(1)";
    el.style.boxShadow="inset 0 1px 0 0 rgba(255,255,255,0.15),0 8px 32px rgba(0,0,0,0.3),0 32px 64px rgba(0,0,0,0.15)";
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
      icon.style.opacity="1";
      icon.style.pointerEvents="auto";
      el.style.width="56px";
      el.style.height="56px";
      el.style.borderRadius="50%";
      el.style.cursor="pointer";
      el.style.boxShadow="inset 0 1px 0 0 rgba(255,255,255,0.25),inset 0 -1px 0 0 rgba(255,255,255,0.05),0 8px 32px rgba(0,0,0,0.15)";
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
