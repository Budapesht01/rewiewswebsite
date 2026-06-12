// Background service worker — keeps popup↔content bridge alive
// No heavy logic here; popup.js handles the WebSocket directly
chrome.runtime.onInstalled.addListener(() => {
  console.log('RATED Watch Party installed');
});
