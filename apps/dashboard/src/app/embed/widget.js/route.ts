import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const org = searchParams.get("org") ?? ""
  const agent = searchParams.get("agent") ?? ""
  const theme = searchParams.get("theme") ?? "dark"
  const position = searchParams.get("position") ?? "br"
  const accent = searchParams.get("accent") ?? "#3B82F6"

  const positionStyles: Record<string, string> = {
    br: "bottom:20px;right:20px;",
    bl: "bottom:20px;left:20px;",
    tr: "top:20px;right:20px;",
    tl: "top:20px;left:20px;",
  }

  const posStyle = positionStyles[position] || positionStyles.br

  const iframePositionStyles: Record<string, string> = {
    br: "bottom:80px;right:20px;",
    bl: "bottom:80px;left:20px;",
    tr: "top:80px;right:20px;",
    tl: "top:80px;left:20px;",
  }

  const iframePosStyle = iframePositionStyles[position] || iframePositionStyles.br

  const origin = request.nextUrl.origin

  const js = `(function(){
  if(document.getElementById("struere-widget"))return;

  var btn=document.createElement("div");
  btn.id="struere-widget";
  btn.style.cssText="position:fixed;${posStyle}z-index:2147483647;width:56px;height:56px;border-radius:50%;background:${accent};cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s ease;";
  btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  btn.onmouseenter=function(){btn.style.transform="scale(1.1)";};
  btn.onmouseleave=function(){btn.style.transform="scale(1)";};

  var frame=document.createElement("div");
  frame.id="struere-frame";
  frame.style.cssText="position:fixed;${iframePosStyle}z-index:2147483646;width:400px;height:600px;max-height:80vh;max-width:calc(100vw - 40px);border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.2);display:none;transition:opacity 0.2s ease,transform 0.2s ease;opacity:0;transform:translateY(10px);";
  frame.innerHTML='<iframe src="${origin}/embed/${org}/${agent}?theme=${theme}" style="width:100%;height:100%;border:none;" allow="clipboard-read;clipboard-write"></iframe>';

  document.body.appendChild(btn);
  document.body.appendChild(frame);

  var open=false;
  btn.onclick=function(){
    open=!open;
    if(open){
      frame.style.display="block";
      setTimeout(function(){frame.style.opacity="1";frame.style.transform="translateY(0)";},10);
      btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }else{
      frame.style.opacity="0";
      frame.style.transform="translateY(10px)";
      setTimeout(function(){frame.style.display="none";},200);
      btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    }
  };

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
