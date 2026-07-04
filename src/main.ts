import './style.scss';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <div class="divition">
    <input type="text" name="q" class="eng-c" autocomplete="off" placeholder="请打开JavaScript，否则起始页没有任何作用" autofocus/>
  </div>
  <div class="command-help__lvl--root">
    <div class="command-help__lvl--sub command-help__scope--">
      ${
        [
          ["theme &lt;color-theme&gt;", "设置颜色主题"],
          ["history &lt;option&gt;", "设置历史记录"],
          ["engine &lt;engine-name&gt;", "设置搜索引擎"],
          ["doc &lt;keyword&gt;", "查看详细内容"],
          ["disable-command", "关闭命令"]
        ].map(
          (cmd) => `<p>/${cmd[0]} <span class="description">${cmd[1]}</span></p>`
        ).join("")
      }
    </div>
    <div class="command-help__lvl--sub command-help__scope--theme command-help__desc-align--right">
      ${
        [
          ["light", "亮色"],
          ["dark", "暗色"],
          ["blue", "海蓝"],
          ["warm", "暖阳"],
          ["forest", "森林"],
          ["twilight", "暮光"],
          ["sakura", "樱花"],
          ["aurora", "极光"]
        ].map(
          (theme) => `<p>/theme ${theme[0]} <span class="description">${theme[1]}</span></p>`
        ).join("")
      }
    </div>
    <div class="command-help__lvl--sub command-help__scope--history">
      ${
        [
          ["enable", "记录历史"],
          ["disable", "停止记录历史"],
          ["clear", "清除历史"]
        ].map(
          (history) => `<p>/history ${history[0]} <span class="description">${history[1]}</span></p>`
        ).join("")
      }
    </div>
    <div class="command-help__lvl--sub command-help__scope--engine">
      <p>/engine ~ &lt;option&gt; &lt;parameter(s)&gt; <span class="description">添加/删除/修改搜索引擎</span></p>
    </div>
    <div class="command-help__lvl--sub command-help__scope--engine-commands">
      ${
        [
          ["set &lt;name&gt; &lt;url&gt;", "添加/修改搜索引擎 (参数用法: /doc set-engines)"],
          ["unset &lt;name&gt;", "删除搜索引擎 (参考: /doc del-engines)"],
          ["reset", "将配置的搜索引擎恢复到初始状态 (没有确认, <b>请三思而后行</b>)"]
        ].map(
          (engine) => `<p>/engine ~ ${engine[0]} <span class="description">${engine[1]}</span></p>`
        ).join("")
      }
    </div>
  </div>
  <div class="doc-help__lvl--root doc-help-doc">
    ${
      [
        ["set-engines", "<p><code>name</code> 要求只能有英文字母,数字,下划线或横杠;</p><p><code>url</code> 不需要引号包裹,也不能包含空格(使用%20代替)</p>"],
        ["del-engines", "<p>只有要删除的搜索引擎不是你现在设置的搜索引擎, 才会执行删除</p>"],
        ["history", "<p>关闭标签页后网页内保存的历史数据将会被清除(当然是因为功能还没写完)</p>"]
      ].map(
        (doc) => `<div class="doc-help__lvl--sub doc-help__scope--${doc[0]}">${doc[1]}</div>`
      ).join("")
    }
  </div>
</main>
`
//////////////////////////
import $ from "jquery";
// Focus input bar
const $text = $(".eng-c");
// Init
let commandMode: boolean = true;
let historyEnabled: boolean = Boolean(localStorage.getItem("history") ?? true);
let history: string[] = [];
let historyIdx: number = -1;
let searchEngine: string = localStorage.getItem("engine") ?? "bing";
document.body.className = "body__theme--"+(localStorage.getItem("starter-theme") || "dark");
const parts: string[] = ["theme", "history", "engine-commands", "engine", ""];
let activePart: string = "";
let commandHelps: Record<string, JQuery<HTMLElement>> = {};
let commandHelpsLock: boolean = false;
let rawQuery: string = "";
let activeDoc: string = "";
parts.forEach(part => {
  commandHelps[part] = $(`.command-help__scope--${part}`);
});
const special: {"/theme": string[], "/history": Record<string, () => void>} = {
  "/theme": [
    "light",
    "dark",
    "blue",
    "warm",
    "forest",
    "twilight",
    "sakura",
    "aurora"
  ],
  "/history": {
    "enable": () => {historyEnabled = true; localStorage.setItem("history", ".")},
    "disable": () => {historyEnabled = false; localStorage.setItem("history", "")},
    "clear": () => {history = []; historyIdx = -1;}
  }
}
function enKVpair(data: Record<string, string>) {
  return Object.entries(data)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n');
}
function deKVpair(text: string | null) {
  return text != null ? Object.fromEntries(
    text.split('\n').map(pair => {
      const [key, ...urlParts] = pair.split(' ');
      return [key, urlParts.join(' ')];
    })
  ) : text;
}
const egDF: Record<string, string> = {
  "baidu": "https://baidu.com/s?wd=%s",
  "bilibili": "https://search.bilibili.com/all?keyword=%s",
  "bing": "https://bing.com/?q=%s",
  "duckduckgo": "https://duckduckgo.com/?q=%s",
  "github": "https://github.com/search?q=%s",
  "google": "https://google.com/search?q=%s",
  "sogou": "https://sogou.com/web?query=%s",
  "yandex": "https://yandex.com/search/?text=%s"
}
let engines: Record<string, string> = deKVpair(localStorage.getItem("engines")) ?? { ...egDF }
function renderEngines(){
  let engineHTML = "";
  Object.entries(engines).map(([key, _]) => {
    engineHTML += `<p class="context__type--engine context__engine--${key}">/engine ${key}</p>`
  });
  $(".command-help__scope--engine").append(engineHTML);
}
renderEngines();
// Get hitokoto
let hitokoto: string = '';
let rawHitokoto: string = '';
$.get("https://v1.hitokoto.cn/").done((data) => {
  rawHitokoto = data.hitokoto;
  hitokoto = ' - ' + rawHitokoto;
}).fail((_) => {});
// Setup placeholder
const month: string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const now: Date = new Date();
const pad: (x: number) => string = (x: number) => String(x).padStart(2,'0');
let baseText: string = '';
let subText: string = '';
function updateClock(){
  now.setTime(Date.now());
  baseText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  subText = `, ${month[now.getMonth()]} ${pad(now.getDate())}, ${now.getFullYear()}`;
  $text.attr("placeholder", baseText + ($(window).width() ?? 500 > 220 ? subText : "") + ($(window).width() ?? 500 > 550 ? hitokoto : ""));
  requestAnimationFrame(updateClock);
}
updateClock();
// Handle search
$text.on('keydown', (event: JQuery.KeyboardEventBase) => {
  // do search and commands
  if (activeDoc) {
    $(`.doc-help__scope--${activeDoc}`).css({"display": "none"});
    activeDoc = "";
  }
  if (event.key === 'Enter') {
    rawQuery = (String($text.val() ?? "")).trim();
    $text.val("");
    if (historyEnabled) {
      historyIdx += 1;
      if (history[historyIdx]) {
        history.splice(historyIdx);
      }
    }
    if (rawQuery.startsWith("/") && commandMode) {
      if (historyEnabled) {
        history.push(rawQuery);
      }
      try {
        const kwSplits: string[] = rawQuery.split(" ");
        const rootKw: string = kwSplits[0];
        let subKw = "";
        switch (rootKw) {
          case "/theme":
            subKw = kwSplits[1];
            if (special[rootKw].includes(subKw)) {
              document.body.className = "body__theme--"+subKw;
              localStorage.setItem("starter-theme", subKw);
            }
            break;
          case "/history":
            subKw = kwSplits[1];
            if (special[rootKw][subKw]) {
              special[rootKw][subKw]();
            }
            break;
          case "/engine":
            subKw = kwSplits[1];
            if (subKw != "~") {
              if (engines[subKw]) {
                searchEngine = subKw;
                localStorage.setItem("engine", subKw);
              }
              break;
            }
            const option = kwSplits[2];
            const name = kwSplits[3];
            if (!(/^[A-Za-z0-9\-_]+$/.test(name))) {
              break; // ERR: NAME ILLEGAL
            }
            if (option == "set") {
              const url = kwSplits[4];
              engines[name] = url;
              $(".command-help__scope--engine").append(`<p class="context__engine--${name}">/engine ${name}</p>`);
            } else if (option == "unset") {
              if (searchEngine != name) { // ERR (NOT_MATCHED): CANNOT DELETE THIS ENGINE BECUZ IT IS USING
                delete engines[name];
                $(`.context__engine--${name}`).remove();
              }
            } else if (option == "reset") {
              engines = { ...egDF };
              searchEngine = "bing";
              localStorage.setItem("engine", "bing");
              $(".context__type--engine").remove();
              renderEngines();
            }
            
            localStorage.setItem("engines", enKVpair(engines));
            break;
          case "/doc":
            subKw = kwSplits[1];
            
            if ($(`.doc-help__scope--${subKw}`)) {
              $(`.doc-help__scope--${subKw}`).css({"display": "block"});
              activeDoc = subKw;
            }
            break;
          case "/disable-command":
            commandMode = false;
            break;
        }
        commandHelps[activePart].css({"display": "none"});
      } catch (e) {}
    } else {
      const query = encodeURIComponent(rawQuery) || ($(window).width() ?? 500 > 550 ? encodeURIComponent(rawHitokoto) : "");
      if (historyEnabled) {
        history.push(rawQuery || rawHitokoto);
      }
      window.open(engines[searchEngine].replace(/%s/g, query), "_blank");
    }
  } else if (event.key === 'ArrowUp') {
    if (history && historyIdx > 0 && $text.val()) {
      historyIdx -= 1;
    }
    $text.val(history[historyIdx]);
  } else if (event.key === 'ArrowDown') {
    if (history && historyIdx < history.length-1 && $text.val()) {
      historyIdx += 1;
    }
    $text.val(history[historyIdx]);
  }
});
$text.on("input", () => {
  // commandhelp
  if (!commandMode) {
    return;
  }
  rawQuery = String($text.val());
  commandHelps[activePart].css({"display": "none"});
  parts.forEach(part => {
    const ptc = part ? (part == "engine-commands" ? "engine ~ " : part+" ") : "";
    if (!commandHelpsLock && rawQuery.startsWith(`/${ptc}`)) {
      commandHelps[part].css({"display": "block"});
      activePart = part;
      commandHelpsLock = true;
    }
  });
    
  commandHelpsLock = false;
});