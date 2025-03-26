const PROGRESS_COLOR_CACHE_KEY = 'progressBarColor'

const restoreOptions = () => {
  chrome.storage.local.get([PROGRESS_COLOR_CACHE_KEY]).then(result => {
    document.getElementById('progressBarColorInput').value = result[PROGRESS_COLOR_CACHE_KEY] || '#181818'
  })
}
document.addEventListener('DOMContentLoaded', restoreOptions)

const onProgressBarColorChange = event => {
  const value = event.target.value
  chrome.storage.local.set({ [PROGRESS_COLOR_CACHE_KEY]: value }).then(() => {
    console.log('set progress bar color to', value)
  })
}
document.getElementById('progressBarColorInput').onchange = onProgressBarColorChange

document.getElementById('toggle').onclick = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => {
    const tab = tabs[0]
    if (tab?.url?.includes('indie.cn')) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' })
    }
  })
}
