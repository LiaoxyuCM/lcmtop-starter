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
          ["history &lt;option&gt;", "设置历史记录 (参照 /doc history)"],
          ["engine &lt;engine-name&gt;", "设置搜索引擎"],
          ["hitokoto &lt;option&gt;", "设置一言 (仅屏幕宽&gt;550px才会生效)"],
          ["doc &lt;keyword&gt;", "查看详细内容"],
          ["disable-command", "关闭命令"]
        ].map(
          (cmd: string[]) => `<p>/${cmd[0]} <span class="description">${cmd[1]}</span></p>`
        ).join("")
      }
    </div>
    <div class="command-help__lvl--sub command-help__scope--theme">
      ${
        [
          ["&lt;color 输入框高亮&gt; &lt;color 输入文本&gt; &lt;color 输入框&gt; &lt;color 背景&gt;", "自定义 (参数详情见/doc colorpattern)"],
          ["light", "亮色 (fff eee 999 121212)"],
          ["dark", "暗色 (000 111 666 ededed)"]
        ].map(
          (theme: string[]) => `<p>/theme ${theme[0]} <span class="description">${theme[1]}</span></p>`
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
          (historyOption: string[]) => `<p>/history ${historyOption[0]} <span class="description">${historyOption[1]}</span></p>`
        ).join("")
      }
    </div>
    <div class="command-help__lvl--sub command-help__scope--hitokoto">
      ${
        [
          ["show", "显示一言"],
          ["hide", "隐藏一言"],
          ["refresh", "刷新"]
        ].map(
          (hitokoto: string[]) => `<p>/hitokoto ${hitokoto[0]} <span class="description">${hitokoto[1]}</span></p>`
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
          (engine: string[]) => `<p>/engine ~ ${engine[0]} <span class="description">${engine[1]}</span></p>`
        ).join("")
      }
    </div>
  </div>
  <div class="doc-help__lvl--root doc-help-doc">
    <div class="doc-help__lvl--sub"></div>
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
let historyContent: string[] = [];
let historyIdx: number = -1;
let searchEngine: string = localStorage.getItem("engine") ?? "bing";
let starterTheme: string = localStorage.getItem("starter-theme");
if (!["light", "dark", "custom"].includes(starterTheme)) {
  localStorage.setItem("starter-theme", "dark");
  starterTheme = localStorage.getItem("starter-theme");
}
document.body.className = "body__theme--"+(starterTheme || "dark");
const customTheme: string = localStorage.getItem("custom-theme") ?? "000 111 666 ededed";
const parts: string[] = ["theme", "history", "engine-commands", "engine", "hitokoto", ""];
let activePart: string = "";
let commandHelps: Record<string, JQuery<HTMLElement>> = {};
let rawQuery: string = "";
let hitokotoAvailable: boolean = Boolean(localStorage.getItem("hitokoto-available") ?? true);
let docActive: boolean = false;
let helpDocs: Record<string, {content: string, cmd: string}> = {
  "set-engines": {
    content: "<p><code>name</code> 要求只能有英文字母,数字,下划线或横杠;</p><p><code>url</code> 不需要引号包裹,也不能包含空格(使用%20代替)</p>",
    cmd: "/engine ~ set "
  },
  "del-engines": {
    content: "<p>只有要删除的搜索引擎不是你现在设置的搜索引擎, 才会执行删除</p>",
    cmd: "/engine ~ unset "
  },
  "history": {
    content: "<p>关闭标签页后网页内保存的历史数据将会被清除</p><p>按下↑或↓浏览当前会话的搜索历史</p>",
    cmd: "/history "
  },
  "colorpattern": {
    content: "<p>参数color可以填 rrggbb型 或者 rgb型 (都不带#) 但不支持填颜色短语</p>",
    cmd: "/theme "
  }
};
const htmlEscape: (raw: string) => string = (raw: string) => raw.replace(/[&<>"'/]/g, (match) => {
  switch (match) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case "'": return '&#x27;';
    case '/': return '&#x2F;';
    default: return match;
  }
});

parts.forEach(part => {
  commandHelps[part] = $(`.command-help__scope--${part}`);
});
const special: {"/theme": string[], "/history": Record<string, () => void>} = {
  "/theme": [
    "light",
    "dark"
  ],
  "/history": {
    "enable": () => {historyEnabled = true; localStorage.setItem("history", ".")},
    "disable": () => {historyEnabled = false; localStorage.setItem("history", "")},
    "clear": () => {historyContent = []; historyIdx = -1;}
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
function showError(text: string, here: boolean = true) {
  $(".doc-help__lvl--sub")
    .html(`错误：${text + (here ? "&lt;&lt;&lt;这里" : "")}`)
    .css({display: "block"});
  docActive = true;
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
function renderBgCustomTheme(theme: string[]) {
  for (let i: number = 0; i < 4; i++) {
    document.body.style.setProperty(`--c-${i+1}`, theme[i] ? `#${theme[i]}` : "");
  }
}
renderEngines();
if (starterTheme == "custom") {
  renderBgCustomTheme(customTheme.split(" "));
}
// Get hitokoto
let hitokoto: string = '';
let rawHitokoto: string = '';
function refreshHitokoto() {
  $.get("https://v1.hitokoto.cn/").done((data) => {
    rawHitokoto = data.hitokoto;
    hitokoto = ' - ' + rawHitokoto;
  }).fail((_) => {});
}

refreshHitokoto();
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
  $text.attr(
    "placeholder",
    baseText
    + (($(window).width() ?? 500) > 220 ? subText : "")
    + ((($(window).width() ?? 500) > 550) && hitokotoAvailable ? hitokoto : "")
  );
  requestAnimationFrame(updateClock);
}
updateClock();
// Handle search
$text.on('keydown', (event: JQuery.KeyboardEventBase) => {
  // do search and commands
  if (docActive) {
    $(`.doc-help__lvl--sub`)
      .html("")
      .css({display: "none"});
    docActive = false;
  }
  if (event.key === 'Enter') {
    rawQuery = (String($text.val() ?? "")).trim();
    $text.val("");
    if (historyEnabled) {
      historyIdx += 1;
      if (historyContent[historyIdx]) {
        historyContent.splice(historyIdx);
      }
    }
    if (rawQuery.startsWith("/") && commandMode) {
      if (historyEnabled) {
        historyContent.push(rawQuery);
      }
      try {
        const kwSplits: string[] = rawQuery.split(" ");
        const rootKw: string = kwSplits[0];
        let subKw: string = "";
        const colorpattern = /^[\da-f]{3}([\da-f]{3})?$/i;
        switch (rootKw) {
          case "/theme":
            subKw = kwSplits[1];
            if (special[rootKw].includes(subKw)) {
              if (localStorage.getItem("starter-theme") == "custom") {
                renderBgCustomTheme(["", "", "", ""]);
              }
              document.body.className = "body__theme--"+subKw;
              localStorage.setItem("starter-theme", subKw);
            } else if (colorpattern.test(kwSplits[1])) {
              if (
                 !colorpattern.test(kwSplits[2])
              || !colorpattern.test(kwSplits[3])
              || !colorpattern.test(kwSplits[4])
              ) {
                let nErr: number = 1;
                let nNerr: number[] = [];
                for (let i: number = 2; i < 5; i++) {
                  if (colorpattern.test(kwSplits[i])) {
                    nNerr.push(i);
                  } else {
                    nErr = i;
                    break;
                  }
                }
                showError(`颜色不合法 /theme ${kwSplits[1]} ${
                  nNerr.map((i: number) => kwSplits[i] + " ").join("")
                }<b>${kwSplits[nErr]}</b>`)
              } else {
                document.body.className = "body__theme--custom";
                const themeLs: string[] = [...kwSplits].slice(1);
                renderBgCustomTheme(themeLs);
                localStorage.setItem("starter-theme", "custom");
                localStorage.setItem("custom-theme", themeLs.join(" "));
              }
            } else {
              showError(`不知道你想设什么主题 /theme <b>${htmlEscape(subKw)}</b>`);
            }
            break;
          case "/history":
            subKw = kwSplits[1];
            if (special[rootKw][subKw]) {
              special[rootKw][subKw]();
            } else {
              showError(`不知道你要怎么操作历史记录 /history <b>${htmlEscape(subKw)}</b>`);
            }
            break;
          case "/engine":
            subKw = kwSplits[1];
            if (subKw != "~") {
              if (engines[subKw]) {
                searchEngine = subKw;
                localStorage.setItem("engine", subKw);
              } else {
                showError(`不知道你要切哪个搜索引擎 /engine <b>${htmlEscape(subKw)}</b>`);
              }
              break;
            }
            const option: string = kwSplits[2];
            const engname: string = kwSplits[3];
            if (!(/^[A-Za-z0-9\-_]+$/.test(engname))) {
              showError(`<code>name</code>只能包含字母,数字,横杠或下划线 /engine ~ ${htmlEscape(option)} <b>${htmlEscape(engname)}</b>`);
              break;
            }
            if (option == "set") {
              const url: string = kwSplits[4];
              engines[engname] = url;
              $(".command-help__scope--engine").append(`<p class="context__engine--${engname}">/engine ${engname}</p>`);
            } else if (option == "unset") {
              if (!engines[engname]) {
                showError(`找不到这个搜索引擎 /engine ~ unset <b>${engname}</b>`);
              }
              if (searchEngine != engname) {
                delete engines[engname];
                $(`.context__engine--${engname}`).remove();
              } else {
                showError(`删不掉当前正在用的搜索引擎 /engine ~ unset <b>${engname}</b>`);
              }
            } else if (option == "reset") {
              engines = { ...egDF };
              searchEngine = "bing";
              localStorage.setItem("engine", "bing");
              $(".context__type--engine").remove();
              renderEngines();
            } else {
              showError(`不知道你要对搜索引擎干什么 /engine ~ <b>${htmlEscape(option)}</b>`);
            }

            localStorage.setItem("engines", enKVpair(engines));
            break;
          case "/hitokoto":
            subKw = kwSplits[1];
            if (subKw == "show") {
              hitokotoAvailable = true;
              localStorage.setItem("hitokoto-available", ".");
            } else if (subKw == "hide") {
              hitokotoAvailable = false;
              localStorage.setItem("hitokoto-available", "");
            } else if (subKw == "refresh") {
              refreshHitokoto();
            } else {
              showError(`不知道你要怎么设置一言 /hitokoto <b>${htmlEscape(subKw)}</b>`);
            }
            break;
          case "/doc":
            subKw = kwSplits[1];
            if (helpDocs[subKw]) {
              $(`.doc-help__lvl--sub`)
                .html(helpDocs[subKw].content)
                .css({display: "block"});

              $text.val(helpDocs[subKw].cmd);
              docActive = true;
            } else {
              showError(`没有这个文档 /doc <b>${htmlEscape(subKw)}</b>`);
            }
            break;
          case "/disable-command":
            commandMode = false;
            break;
          default:
            showError(`不知道你想表达什么 /<b>${htmlEscape(rootKw.slice(1))}</b>`);
            break;
        }
        commandHelps[activePart].css({"display": "none"});
      } catch (e) {
        showError(`参数没传对: ${e}`, false);
      }
    } else {
      const chitokoto: string = ((($(window).width() ?? 500) > 550) && hitokotoAvailable ? rawHitokoto : "");
      const query: string = encodeURIComponent(rawQuery || chitokoto);
      if (historyEnabled) {
        if ((rawQuery || chitokoto) && historyContent[historyContent.length-1] != (rawQuery || chitokoto)) {
          historyContent.push(rawQuery || chitokoto);
        } else {
          historyIdx -= 1;
        }
      }
      window.open(engines[searchEngine].replace(/%s/g, query), "_blank");
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (historyContent && historyIdx > 0 && $text.val()) {
      historyIdx -= 1;
    }
    $text.val(historyContent[historyIdx]);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (historyContent && historyIdx < historyContent.length-1 && $text.val()) {
      historyIdx += 1;
    }
    $text.val(historyContent[historyIdx]);
  }
});
$text.on("input", () => {
  // commandhelp
  if (!commandMode) {
    return;
  }
  rawQuery = String($text.val());
  commandHelps[activePart].css({"display": "none"});
  parts.some(part => {
    const ptc: string = part ? (part == "engine-commands" ? "engine ~ " : part+" ") : "";
    if (rawQuery.startsWith(`/${ptc}`)) {
      commandHelps[part].css({"display": "block"});
      activePart = part;
      return true;
    }
    return false;
  });
});
