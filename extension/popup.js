const btn = document.getElementById('syncBtn');
const statusEl = document.getElementById('status');
const lastSyncEl = document.getElementById('lastSync');

chrome.storage.local.get(['lastSync', 'lastCount'], (data) => {
  if (data.lastSync) {
    const d = new Date(data.lastSync);
    lastSyncEl.textContent = `上次同步：${d.toLocaleString()}\n共 ${data.lastCount || 0} 题`;
  } else {
    lastSyncEl.textContent = '尚未同步过，点击下方按钮开始同步';
  }
});

btn.addEventListener('click', () => {
  btn.disabled = true;
  statusEl.textContent = '同步中，请稍候...';
  chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' }, (resp) => {
    btn.disabled = false;
    if (resp?.error) {
      statusEl.textContent = '失败：' + resp.error;
      statusEl.style.color = '#ef4444';
    } else {
      statusEl.textContent = `完成！同步了 ${resp?.synced || 0} 题`;
      statusEl.style.color = '#22c55e';
      chrome.storage.local.get(['lastSync', 'lastCount'], (data) => {
        if (data.lastSync) {
          lastSyncEl.textContent = `上次同步：${new Date(data.lastSync).toLocaleString()}\n共 ${data.lastCount} 题`;
        }
      });
    }
  });
});

document.getElementById('openApp').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
});
