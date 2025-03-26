let inited = false

function init(openAtOnce = false) {
  if (inited) return

  const playerDom = document.querySelector('.fixed.bottom-0.w-full')
  if (!playerDom) {
    // 未初始化完成，后续让用户手动初始化
    return
  }
  inited = true

  // get doms
  const coverElem = playerDom.querySelector('[class*=" AudioPlayer_album_pic_overlay_"]')
  const infoElem = playerDom.querySelector('[class*=" AudioPlayer_album_pic_overlay_"] + div')
  const titleElem = infoElem.children[0]
  const artistElem = infoElem.children[1]
  const sliderElem = playerDom.querySelector('[role="slider"]')
  const controllerDom = playerDom.children[0].children[1].children[0]
  const prevElem = controllerDom.children[0]
  const playElem = controllerDom.children[1]
  const nextElem = controllerDom.children[2]

  /**
   * @typedef {Object} PlayerInfo
   * @property {string} coverUrl 歌曲封面 url
   * @property {string} title 歌曲标题
   * @property {string} artist 艺术家
   * @property {boolean} isPlaying 是否正在播放
   * @property {number} progress 进度
   * @property {number} max 最大进度
   */

  /**
   * 获取当前播放状态
   * @return {PlayerInfo}
   */
  function getCurrentPlayerInfo() {
    return {
      coverUrl: coverElem.children[0].src,
      title: titleElem.innerText,
      artist: artistElem.innerText,
      isPlaying: playElem.children[0].children.length === 3,
      progress: Number(sliderElem.getAttribute('aria-valuenow')),
      max: Number(sliderElem.getAttribute('aria-valuemax')),
    }
  }

  // if support picture-in-picture, insert 'toggle' button
  if ('documentPictureInPicture' in window) {
    const togglePipButton = document.createElement('div')
    togglePipButton.innerHTML = pipBtnSvg
    togglePipButton.style.cssText = `
      position: absolute;
      right: 12px;
      top: 12px;
      color: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.95);
      border-radius: 999px;
      padding: 6px;
      cursor: pointer;
    `
    togglePipButton.addEventListener("click", togglePictureInPicture, false);

    playerDom.append(togglePipButton)
  }

  let syncInterval = 0
  let onDestroyCallback = null

  async function togglePictureInPicture() {
    // Early return if there's already a Picture-in-Picture window open
    if (window.documentPictureInPicture.window) {
      clearInterval(syncInterval)
      onDestroyCallback?.()
      window.documentPictureInPicture.window.close()
      return
    }

    // Open a Picture-in-Picture window.
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 400,
      height: 80,
      // disallowReturnToOpener: true,
      preferInitialWindowPlacement: true
    })

    // add css
    const style = document.createElement("style")
    style.textContent = pipCss
    pipWindow.document.head.appendChild(style)

    // add html
    const nextTickSync = () => setTimeout(() => onUpdate(getCurrentPlayerInfo()), 0)
    const { onUpdate, onDestroy } = usePipDocument(pipWindow.document, getCurrentPlayerInfo(), {
      onPrev: () => {
        prevElem.click()
        nextTickSync()
      },
      onNext: () => {
        nextElem.click()
        nextTickSync()
      },
      onPlay: () => {
        playElem.click()
        nextTickSync()
      },
      onClose: () => {
        pipWindow.close()
        window.focus()
      }
    })
    onDestroyCallback = onDestroy
    // poll to sync
    syncInterval = setInterval(() => onUpdate(getCurrentPlayerInfo()), 1000)

    // 通过系统控件引发 close 事件
    pipWindow.addEventListener("pagehide", () => {
      clearInterval(syncInterval)
      onDestroy()
    })
  }

  // 处理打开事件
  if (openAtOnce) {
    togglePictureInPicture()
  }

  // 监听 popup 的请求
  chrome.runtime.onMessage.addListener(request => {
    if (request.action === 'toggle' && !window.documentPictureInPicture.window) {
      togglePictureInPicture()
    }
  })
}

/**
 * 创建浮窗内文档
 * @param {Document} document
 * @param {PlayerInfo} initialState
 * @param listeners
 * @param {() => void} listeners.onPrev
 * @param {() => void} listeners.onNext
 * @param {() => void} listeners.onPlay
 * @param {() => void} listeners.onClose
 * @return {{ onUpdate: (info: PlayerInfo) => void, onDestroy: () => void }}
 */
function usePipDocument(document, initialState, listeners) {
  // create template
  document.body.innerHTML = generatePipHtml(initialState)
  const coverElem = document.getElementById('cover')
  const titleElem = document.getElementById('title')
  const artistElem = document.getElementById('artist')
  const prevElem = document.getElementById('prev')
  const nextElem = document.getElementById('next')
  const playElem = document.getElementById('play')
  const progressBarElem = document.getElementById('progress-bar')

  // add event listeners
  prevElem.onclick = listeners.onPrev
  nextElem.onclick = listeners.onNext
  playElem.onclick = listeners.onPlay
  coverElem.onclick = listeners.onClose

  // sync settings
  const PROGRESS_COLOR_CACHE_KEY = 'progressBarColor'
  chrome.storage.local.get([PROGRESS_COLOR_CACHE_KEY]).then(result => {
    progressBarElem.style.setProperty('--bg', result[PROGRESS_COLOR_CACHE_KEY] || '#181818')
  })

  const onChromeStorageChange = (changes) => {
    if (changes[PROGRESS_COLOR_CACHE_KEY]) {
      progressBarElem.style.setProperty('--bg', changes[PROGRESS_COLOR_CACHE_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onChromeStorageChange)

  /** @type PlayerInfo */ let _lastInfo = initialState
  /**
   * Update latest information to pip window
   * @param {PlayerInfo} playerInfo
   */
  const onUpdate = playerInfo => {
    if (playerInfo.coverUrl !== _lastInfo?.coverUrl) {
      coverElem.children[0].src = playerInfo.coverUrl
      titleElem.innerText = playerInfo.title
      artistElem.innerText = playerInfo.artist
    }
    // 避免频繁更新
    if (playerInfo.isPlaying !== _lastInfo?.isPlaying) {
      playElem.innerHTML = playerInfo.isPlaying ? pauseBtnSvg : playBtnSvg
    }
    progressBarElem.style.setProperty('--progress', `${playerInfo.progress / playerInfo.max * 100}%`)
    _lastInfo = playerInfo
  }

  const onDestroy = () => {
    chrome.storage.onChanged.removeListener(onChromeStorageChange)
  }

  return { onUpdate, onDestroy }
}

function generatePipHtml(playerInfo) {
  return `
    <div id="root">
      <div id="cover">
        <img src="${playerInfo.coverUrl}" />
      </div>
      <div id="info">
        <div id="title" class="text-overflow">${playerInfo.title}</div>
        <div id="artist" class="text-overflow">${playerInfo.artist}</div>
      </div>
      <div id="controls">
        <div id="prev">${toggleBtnSvg}</div>
        <div id="play">${playerInfo.isPlaying ? pauseBtnSvg : playBtnSvg}</div>
        <div id="next">${toggleBtnSvg}</div>
      </div>
      <div id="progress-bar" />
    </div>
  `
}

const pipCss = `
  @font-face {
    font-family: D-DINExp;
    src: url(/fonts/D-DINExp.otf) format("opentype")
  }
  
  body {
    padding: 16px;
    margin: 0;
    font-family: D-DINExp, -apple-system, BlinkMacSystemFont, PingFang SC, Helvetica Neue, STHeiti, Microsoft Yahei, Tahoma, Simsun, sans-serif;
    overflow: hidden;
  }

  #root {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  #cover {
    width: 48px;
    height: 48px;
    background-color: black;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
  }
  
  #cover img {
    display: block;
    width: 100%;
    height: 100%;
  }
  
  #info {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 160px;
  }
  
  #title {
    font-size: 15px;
    line-height: 21px;
    margin-top: 4px;
    color: rgba(0, 0, 0, 0.95);
  }
  
  #artist {
    font-size: 12px;
    line-height: 17px;
    margin-top: 4px;
    color: rgba(0, 0, 0, 0.7);
  }
  
  .text-overflow {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  #controls {
    display: flex;
    align-items: center;
    gap: 18px;
    margin: 0 8px;
  }
  
  #prev {
    transform: rotate(180deg);
  }
  
  #prev,#next {
    width: 22px;
    height: 22px;
    color: rgba(0, 0, 0, 0.7);
    cursor: pointer;
  }
  
  #prev:hover,#next:hover {
    color: rgba(0, 0, 0, 0.95);
  }
  
  #play {
    color: #c43737;
    cursor: pointer;
  }
  
  #play:hover {
    color: #b13232;
  }
  
  #progress-bar {
    position: absolute;
    left: 0;
    bottom: 0;
    width: var(--progress, 0);
    height: 4px;
    background-color: var(--bg, #181818);
  }
`

const toggleBtnSvg = '<svg width="22" height="22" viewBox="0 0 28 28" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M19.8333 5.36009C19.8333 5.02405 19.8333 4.85604 19.8987 4.72769C19.9562 4.61479 20.048 4.52301 20.1609 4.46548C20.2893 4.40009 20.4573 4.40009 20.7933 4.40009H22.3733C22.7094 4.40009 22.8774 4.40009 23.0057 4.46548C23.1186 4.52301 23.2104 4.61479 23.2679 4.72769C23.3333 4.85604 23.3333 5.02405 23.3333 5.36009V22.6401C23.3333 22.9761 23.3333 23.1441 23.2679 23.2725C23.2104 23.3854 23.1186 23.4772 23.0057 23.5347C22.8774 23.6001 22.7094 23.6001 22.3733 23.6001H20.7933C20.4573 23.6001 20.2893 23.6001 20.1609 23.5347C20.048 23.4772 19.9562 23.3854 19.8987 23.2725C19.8333 23.1441 19.8333 22.9761 19.8333 22.6401V5.36009Z"></path><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M17.2415 13.0134C17.9308 13.4906 17.9308 14.5095 17.2415 14.9867L5.38306 23.1964C4.58718 23.7474 3.50001 23.1778 3.50001 22.2098L3.50001 5.79034C3.50001 4.82235 4.58718 4.25272 5.38306 4.80371L17.2415 13.0134Z"></path></svg>'
const playBtnSvg = '<svg width="38" height="38" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="27" cy="27" r="27" fill="currentColor"></circle><path fill-rule="evenodd" clip-rule="evenodd" d="M20.0103 10.2691C21.3409 11.0395 21.3409 12.9605 20.0103 13.7309L7.00207 21.262C5.66874 22.0339 4 21.0718 4 19.5311L4 4.4689C4 2.92823 5.66874 1.96611 7.00207 2.73804L20.0103 10.2691Z" fill="white" fill-opacity="0.95" transform="translate(15, 15)"></path></svg>'
const pauseBtnSvg = '<svg width="38" height="38" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="27" cy="27" r="27" fill="currentColor"></circle><rect x="20.7" y="18.9" width="4.5" height="16.2" rx="0.736" fill="white"></rect><rect x="28.8" y="18.9" width="4.5" height="16.2" rx="0.736" fill="white"></rect></svg>'
const pipBtnSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="m11.5 20h-1.5c-3.77124 0-5.65685 0-6.82843-1.1716-1.17157-1.1715-1.17157-3.0572-1.17157-6.8284 0-3.77124 0-5.65685 1.17157-6.82843 1.17158-1.17157 3.05719-1.17157 6.82843-1.17157h4c3.7712 0 5.6569 0 6.8284 1.17157 1.1186 1.11861 1.1692 2.88817 1.1715 6.32843" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="m6.53033 7.46967c-.29289-.29289-.76777-.29289-1.06066 0s-.29289.76777 0 1.06066zm1.03267 4.71723c-.41275-.0348-.77556.2716-.81035.6843-.03479.4128.2716.7756.68435.8104zm4.1186-2.74991c-.0348-.41275-.3976-.71914-.8104-.68434-.4127.0348-.7191.39761-.6843.81035zm-.407 2.77691-4.74427-4.74423-1.06066 1.06066 4.74423 4.74427zm-1.0607 0c.0833-.0833.1424-.0834.0581-.0588-.0621.0182-.1616.0378-.30199.0542-.27892.0326-.63544.0431-1.00232.0402-.36238-.0028-.71465-.0185-.9778-.0336-.13111-.0076-.23901-.0149-.31366-.0203-.0373-.0027-.06624-.005-.08554-.0065-.00966-.0007-.01689-.0013-.02156-.0017-.00234-.0002-.00403-.0003-.00506-.0004-.00051-.0001-.00086-.0001-.00104-.0001-.00009 0-.00014 0-.00014 0h.00002c.00004 0 .00009 0-.06291.7473-.063.7474-.06293.7474-.06285.7474h.00022c.00016 0 .00037 0 .00062.0001.00051 0 .00118.0001.00202.0001.00168.0002.00404.0004.00705.0006.00602.0005.01465.0012.02573.0021.02217.0017.05417.0042.09472.0071.08106.0059.19655.0138.3362.0218.27835.016.65699.033 1.05224.0361.39074.0031.81857-.0072 1.18805-.0503.1837-.0215.3744-.0534.5482-.1041.1516-.0442.3922-.1304.5824-.3205zm.7203-2.7139c-.7473.063-.7473.06296-.7473.06292v-.00003.00015c0 .00018 0 .00053.0001.00104 0 .00103.0002.00272.0004.00505.0004.00467.0009.01191.0017.02156.0015.0193.0037.04824.0065.08554.0054.07465.0127.18256.0203.31366.0151.26311.0308.61541.0336.97781.0029.3669-.0076.7234-.0402 1.0023-.0164.1404-.036.2399-.0541.302-.0246.0843-.0245.0251.0587-.0581l1.0607 1.0607c.1901-.1902.2763-.4308.3205-.5824.0507-.1738.0826-.3645.1041-.5482.0431-.3695.0534-.7973.0503-1.1881-.0031-.3952-.0201-.7739-.0361-1.0522-.008-.13965-.0159-.25514-.0218-.3362-.0029-.04056-.0054-.07256-.0071-.09472-.0009-.01109-.0016-.01972-.0021-.02573-.0003-.00301-.0004-.00537-.0006-.00705-.0001-.00084-.0001-.00152-.0002-.00202 0-.00025 0-.00046 0-.00063 0-.00008 0-.00017 0-.00021 0-.00008 0-.00015-.7474.06286z" fill="currentColor"/><rect height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" width="8" x="14" y="14"/></svg>'

setTimeout(init, 1000)

chrome.runtime.onMessage.addListener(request => {
  // 已经 inited 的情况，交给内部处理
  if (request.action === 'toggle' && !inited) {
    init(true)
  }
})
