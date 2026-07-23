import './style.scss';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <div class="divition">
    <input type="text" name="q" class="eng-c" autocomplete="off" placeholder="请打开JavaScript，否则起始页没有任何作用" autofocus/>
  </div>
  <div class="command-help__lvl--root">
    <div class="command-help__lvl--sub command-help__scope--">
      <div class="command-help__layout--root">
        ${
          [
            [
              ["theme &lt;color-theme&gt;", "设置颜色主题"],
              ["history &lt;option&gt;", "设置历史记录 (参照 /doc history)"],
              ["engine &lt;engine-name&gt;", "设置搜索引擎"],
              ["data &lt;option&gt;", "导入/导出数据"]
            ],
            [
              ["hitokoto &lt;option&gt;", "设置一言 (仅屏幕宽&gt;550px才会生效)"],
              ["doc &lt;keyword&gt;", "查看文档 (更多起始页技巧已在 /doc tricks 中阐明)"],
              ["disable-command", "关闭命令"],
              ["/&lt;keywords&gt;", "正常搜索以 \"/\" 开头的关键词 (前两个\"/\"会被合并为一个\"/\")"]
            ]
          ].map(
            (layout: string[][]) => (
              `<div class="command-help__layout--sub">${layout.map(
                (cmd: string[]) => `<p>/${cmd[0]} <span class="description">${cmd[1]}</span></p>`
              ).join("")}</div>`
            )
          ).join("")
        }
      </div>
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
    <div class="command-help__lvl--sub command-help__scope--history command-help__desc-align--right">
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
    <div class="command-help__lvl--sub command-help__scope--hitokoto command-help__desc-align--right">
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
    <div class="command-help__lvl--sub command-help__scope--data">
      ${
        [
          ["export clipboard", "导出数据至剪贴板"],
          ["export file", "导出数据并下载成文件"],
          ["import &lt;data 粘贴JSON数据&gt;", "导入数据 (1. 由于技术原因, 暂不支持文件上传; 2. <b>只能导入你信任的数据</b>)"]
        ].map(
          (dataOption: string[]) => `<p>/data ${dataOption[0]} <span class="description">${dataOption[1]}</span></p>`
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
`.replace(/\n\s*/g, "");
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
const special: {"/theme": Record<string, string[]>, "/history": Record<string, () => void>} = {
  "/theme": {
    light: ["000", "111", "666", "ededed"],
    dark:  ["fff", "eee", "999", "121212"]
  },
  "/history": {
    enable: () => {historyEnabled = true; localStorage.setItem("history", ".")},
    disable: () => {historyEnabled = false; localStorage.setItem("history", "")},
    clear: () => {historyContent = []; historyIdx = -1;}
  }
}
let customTheme: string[] = (
  localStorage.getItem("custom-theme") ?? "fff eee 999 121212"
).split(" ");
const parts: string[] = ["theme", "history", "engine-commands", "engine", "hitokoto", "data", ""];
let activePart: string = "";
let commandHelps: Record<string, JQuery<HTMLElement>> = {};
let rawQuery: string = "";
let hitokotoAvailable: boolean = Boolean(localStorage.getItem("hitokoto-available") ?? true);
let docActive: boolean = false;
let helpDocs: Record<string, {content: string, cmd: string}> = {
  "set-engines": {
    content: "<p>name 要求只能有英文字母,数字,下划线或横杠;<br>url 不需要引号包裹,也不能包含空格(使用%20代替)</p>",
    cmd: "/engine ~ set "
  },
  "del-engines": {
    content: "<p>只有要删除的搜索引擎不是你现在设置的搜索引擎, 才会执行删除</p>",
    cmd: "/engine ~ unset "
  },
  "history": {
    content: "<p>关闭标签页后网页内保存的历史数据将会被清除<br>按下↑或↓浏览当前会话的搜索历史</p>",
    cmd: "/history "
  },
  "colorpattern": {
    content: "<p>参数color可以填 rrggbb型 或者 rgb型 (都不带#) 但不支持填颜色短语<br>可以填 ~ 代表当前颜色<br>exp. /theme ~ ~ ~ 000</p>",
    cmd: "/theme "
  },
  "tricks": {
    content: "<p>欢迎使用lcmtop-starter, 下面是一些使用技巧<br>输入框默认为聚焦状态, 此时可以按ESC失焦<br>在失焦状态下, 按下 \"/\" 聚焦输入框<br>聚焦状态下再次按下 \"/\" 可以进入命令模式 (最明显的就是下面的命令补全)<br>关于历史记录的操作方法已在 /doc history 中阐明</p>",
    cmd: ""
  }
}
function htmlEscape(raw: string): string {
  return raw.replace(/[&<>"'/]/g, (match: string) => {
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
}
parts.forEach((part: string) => {
  commandHelps[part] = $(`.command-help__scope--${part}`);
});
function enKVpair(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n');
}
function deKVpair(text: string | null): Record<string, string> | null {
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
    engineHTML += `<p class="context__type--engine context__engine--${key}">/engine ${htmlEscape(key)}</p>`
  });
  $(".command-help__scope--engine").append(engineHTML);
}
function renderBgCustomTheme(theme: string[]) {
  for (let i: number = 0; i < 4; i++) {
    document.body.style.setProperty(`--c-${i+1}`, theme[i] ? `#${theme[i]}` : "");
  }
}
renderEngines();
renderBgCustomTheme(customTheme);
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
  if (event.key === 'Escape') {
    event.preventDefault();
    $text.blur();
  } else if (event.key === 'Enter') {
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
        const colorpattern: RegExp = /^[\da-f]{3}([\da-f]{3})?$|^\~$/i;
        if (rawQuery.startsWith("//")) {
          const query: string = encodeURIComponent(rawQuery.slice(1));
          window.open(engines[searchEngine].replace(/%s/g, query), "_blank");
        } else switch (rootKw) {
          case "/theme":
            subKw = kwSplits[1];
            if (special[rootKw][subKw]) {
              const themeTemp: string[] = [...special[rootKw][subKw]];
              renderBgCustomTheme(themeTemp);
              customTheme = [...themeTemp];
              localStorage.setItem("custom-theme", themeTemp.join(" "));
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
                showError(`颜色不合法 /theme ${htmlEscape(kwSplits[1])} ${
                  htmlEscape(nNerr.map((i: number) => kwSplits[i] + " ").join(""))
                }<b>${htmlEscape(kwSplits[nErr])}</b>`);
              } else {
                const themeLs: string[] = [...kwSplits].slice(1).map((clr: string, idx: number) => {
                  if (clr == "~") {
                    return customTheme[idx];
                  } else {
                    return clr;
                  }
                });
                renderBgCustomTheme(themeLs);
                customTheme = [...themeLs];
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
          case "/data":
            subKw = kwSplits[1];
            if (subKw == "export") {
              const data2export: string = JSON.stringify({starter:{
                history: historyEnabled ? "." : "",
                engine: searchEngine,
                engines: enKVpair(engines),
                hitokoto: hitokotoAvailable ? "." : "",
                theme: customTheme.join(" ")
              }});
              if (kwSplits[2] == "file") {
                const blob: Blob = new Blob([data2export], {type: 'application/json'});
                const anchor: HTMLAnchorElement = document.createElement('a');
                anchor.href = URL.createObjectURL(blob);
                anchor.download = 'starterdata.json';
                anchor.click();
              } else if (kwSplits[2] == "clipboard") {
                setTimeout(async () => {
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(data2export);
                    $(".doc-help__lvl--sub")
                      .html("已复制到剪贴板")
                      .css({display: "block"});
                    docActive = true;
                  } else {
                    showError("浏览器不支持navigator.clipboard, 请更换新版浏览器", false);
                  }
                }, 0);
              } else {
                showError(`你要怎么导入数据? /data export <b>${htmlEscape(kwSplits[2])}</b>`);
              }
            } else if (subKw == "import") {
              try {
                const importedData = JSON.parse(rawQuery.slice(13));
                if (!importedData.starter) {
                  showError('无效的配置文件: 缺少 starter 字段', false);
                  return;
                }
                const config = importedData.starter;

                if (config.history) localStorage.setItem("history", config.history);
                if (config.engine) localStorage.setItem("engine", config.engine);
                if (config.engines) localStorage.setItem("engines", config.engines);
                if (config.hitokoto) localStorage.setItem("hitokoto-available", config.hitokoto);
                if (config.theme) localStorage.setItem("custom-theme", config.theme);

                $(".doc-help__lvl--sub")
                  .html("配置已导入, 请刷新(Ctrl/Cmd+R)以生效")
                  .css({display: "block"});
                docActive = true;
              } catch (_) {
                showError("解析失败", false);
              }
            } else {
              showError(`不知道你要对数据干什么 /data <b>${htmlEscape(subKw)}</b>`);
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

$(document.body).on("keydown", (event: JQuery.KeyboardEventBase) => {
  if (event.key == "/" && (!$text.is(":focus"))) {
    event.preventDefault();
    $text.focus();
  }
});

