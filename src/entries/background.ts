chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'omni-open',
    title: 'Open Omni',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener(() => {
  chrome.sidePanel.open({ windowId: -1 } as any);
});

chrome.action.onClicked.addListener(() => {
  chrome.sidePanel.open({ windowId: -1 } as any);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEPANEL') {
    chrome.sidePanel.open({ windowId: -1 } as any).then(() => sendResponse({ success: true }));
    return true;
  }
});
