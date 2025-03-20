(function() {
  window.addEventListener('DOMContentLoaded', () => {
    // inject css
    const css = `
      .invisible {
        display: none !important;
      }
      
      .player-mini {
        height: 80px !important;
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
    } else {
      playerElem.classList.remove('player-mini')
      hideCustomProgressBar(playerElem)
      cancelDraggable(playerElem)
    }
  }

  const dragListener = () => {
    const { getCurrentWindow } = window.__TAURI__.window
    const appWindow = getCurrentWindow()
    appWindow.startDragging()
  }

  function setDraggable(domElem) {
    // 用 data-tauri-drag-region 还会导致双击最大化窗口，我们不想要这个行为，因此只能手动添加 listener
    // @see https://github.com/tauri-apps/tauri/issues/1839#issuecomment-1002857444
    domElem.addEventListener('mousedown', dragListener)
  }

  function cancelDraggable(domElem) {
    domElem.removeEventListener('mousedown', dragListener)
  }

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
      --bg: ${localStorage.getItem('progress-bar-color') ?? '#00ff00'};
      position: absolute;
      left: 0;
      bottom: 0;
      width: var(--progress, 0);
      height: 4px;
      background-color: var(--bg, #00ff00);
    `
    return elem
  }

  window.setProgressBarColor = () => {
    const progressBarElem = document.querySelector('#custom-progress-bar')
    if (!progressBarElem) return
    const color = window.prompt('输入 CSS 色值', localStorage.getItem('progress-bar-color') ?? '')
    if (color !== null) {
      progressBarElem.style.setProperty('--bg', color)
      localStorage.setItem('progress-bar-color', color)
    }
  }
})();
