(function() {
  window.addEventListener('DOMContentLoaded', () => {
    // inject css
    const css = `
      .invisible {
        display: none !important;
      }
      
      .player-mini {
        height: 80px !important;
        user-select: none;
        -webkit-user-select: none;
      }
      
      .player-mini > div:first-child {
        width: 400px !important;
        height: 80px !important;
        padding: 0 16px !important;
      }
      
      .player-mini > div:first-child > div:first-child {
        margin-top: 0 !important;
        align-items: center !important;
        height: 100% !important;
      }
      
      .player-mini > div:first-child > div:first-child > div:last-child {
        width: 160px !important;
      }
      
      .player-mini > div:first-child > div:nth-child(2) {
        padding-top: 0 !important;
      }
    `
    const style = document.createElement('style')
    style.innerHTML = css
    document.head.appendChild(style)
  });

  const HEADER_SELECTOR = 'body > header'
  const MAIN_SELECTOR = 'body > header + div'
  const FOOTER_SELECTOR = 'body > footer'
  const PLAYER_SELECTOR = '.fixed.bottom-0.w-full'
  const SLIDER_SELECTOR = '[role="slider"]'

  window.setMiniMode = mini => {
    [HEADER_SELECTOR, MAIN_SELECTOR, FOOTER_SELECTOR].forEach(selector => {
      const elem = document.querySelector(selector)
      if (!elem) return
      if (mini) {
        elem.classList.add('invisible')
      } else {
        elem.classList.remove('invisible')
      }
    })
    const playerElem = document.querySelector(PLAYER_SELECTOR)
    if (!playerElem) return
    if (mini) {
      playerElem.classList.add('player-mini')
      showCustomProgressBar(playerElem)
      setDraggable(playerElem)
      setToggler(playerElem)
      showColorPicker(playerElem)
    } else {
      playerElem.classList.remove('player-mini')
      hideCustomProgressBar(playerElem)
      cancelDraggable(playerElem)
      cancelToggler(playerElem)
      hideColorPicker(playerElem)
    }
  }

  // 浮窗拖动事件
  const dragListener = (e) => {
    // 左键单击
    if (e.buttons === 1 && e.detail !== 2) {
      const target = e.target
      // windows 下设置 startDragging 会导致本身的点击事件失效，因此要过滤掉原来有点击事件的区域
      if ((target.tagName === 'DIV' || target.tagName === 'P') && !target.className.includes(' AudioPlayer_album_pic_overlay_expand')) {
        const { getCurrentWindow } = window.__TAURI__.window
        const appWindow = getCurrentWindow()
        appWindow.startDragging()
      }
    }
  }

  function setDraggable(domElem) {
    // 用 data-tauri-drag-region 还会导致双击最大化窗口，我们不想要这个行为，因此只能手动添加 listener
    // @see https://github.com/tauri-apps/tauri/issues/1839#issuecomment-1002857444
    domElem.addEventListener('mousedown', dragListener)
  }

  function cancelDraggable(domElem) {
    domElem.removeEventListener('mousedown', dragListener)
  }

  // 点击恢复正常窗口
  const toggleMenuListener = async (e) => {
    e.stopPropagation()
    const { invoke } = window.__TAURI__.core
    await invoke("click_go_normal")
  }

  function setToggler(domElem) {
    const coverElem = domElem.querySelector('[class*=" AudioPlayer_album_pic_overlay_expand"]')
    if (!coverElem) return
    coverElem.addEventListener('click', toggleMenuListener)
  }

  function cancelToggler(domElem) {
    const coverElem = domElem.querySelector('[class*=" AudioPlayer_album_pic_overlay_expand"]')
    if (!coverElem) return
    coverElem.removeEventListener('click', toggleMenuListener)
  }

  // 显示自定义进度条
  let customProgressBarInterval = undefined

  function showCustomProgressBar(playerElem) {
    const sliderElem = playerElem.querySelector(SLIDER_SELECTOR)
    if (!sliderElem) return
    let progressBarElem = playerElem.querySelector('#custom-progress-bar')
    if (!progressBarElem) {
      progressBarElem = _createProgressBar()
      playerElem.appendChild(progressBarElem)
    }
    customProgressBarInterval = setInterval(() => {
      const progress = sliderElem.getAttribute('aria-valuenow')
      const max = sliderElem.getAttribute('aria-valuemax')
      if (!progress || !max) return
      progressBarElem.style.setProperty('--progress', `${Number(progress) / Number(max) * 100}%`)
    }, 1000)
  }

  function hideCustomProgressBar(playerElem) {
    if (customProgressBarInterval) {
      clearInterval(customProgressBarInterval)
      customProgressBarInterval = undefined
    }
    const progressBarElem = playerElem.querySelector('#custom-progress-bar')
    if (progressBarElem) {
      progressBarElem.remove()
    }
  }

  function _createProgressBar() {
    const elem = document.createElement('div')
    elem.id = 'custom-progress-bar'
    elem.style.cssText = `
      --bg: ${getCookie('progress-bar-color') ?? '#181818'};
      position: absolute;
      left: 0;
      bottom: 0;
      width: var(--progress, 0);
      height: 4px;
      background-color: var(--bg, #181818);
    `
    return elem
  }

  function showColorPicker(playerElem) {
    let colorPickerElem = playerElem.querySelector('#custom-color-picker')
    if (!colorPickerElem) {
      colorPickerElem = _createColorPicker()
      playerElem.appendChild(colorPickerElem)
    }
  }

  function hideColorPicker(playerElem) {
    const colorPickerElem = playerElem.querySelector('#custom-color-picker')
    if (colorPickerElem) {
      colorPickerElem.remove()
    }
  }

  function _createColorPicker() {
    const elem = document.createElement('input')
    elem.id = 'custom-color-picker'
    elem.type = 'color'
    elem.value = getCookie('progress-bar-color') ?? '#181818'
    elem.style.cssText = `
      position: absolute;
      left: 0;
      bottom: 0;
      width: 10px;
      height: 10px;
      opacity: 0;
    `
    elem.addEventListener('change', event => {
      const color = event.target.value
      setCookie('progress-bar-color', color)
      const progressBarElem = document.querySelector('#custom-progress-bar')
      if (progressBarElem) {
        progressBarElem.style.setProperty('--bg', color)
      }
    })
    return elem
  }

  // https://www.w3schools.com/js/js_cookies.asp
  function setCookie(cname, cvalue, exdays = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }

  function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }
})();
