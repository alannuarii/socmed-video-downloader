document.addEventListener('DOMContentLoaded', () => {

  // --- Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.error('Service Worker Registration Failed:', err));
  }
  // -----------------------------------

  const form = document.getElementById('downloadForm');
  const urlInput = document.getElementById('videoUrl');
  const submitBtn = document.getElementById('submitBtn');
  const errorMsg = document.getElementById('errorMsg');
  
  const progressArea = document.getElementById('progressArea');
  const statusText = document.getElementById('statusText');
  const progressBar = document.getElementById('progressBar');
  const speedText = document.getElementById('speedText');
  const etaText = document.getElementById('etaText');
  const percentText = document.getElementById('percentText');
  
  const successArea = document.getElementById('successArea');
  const downloadAgainBtn = document.getElementById('downloadAgainBtn');

  let eventSource = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    
    if (!url) return;
    
    // Reset UI
    errorMsg.classList.add('hidden');
    progressArea.classList.remove('hidden');
    successArea.classList.add('hidden');
    submitBtn.disabled = true;
    urlInput.disabled = true;
    
    // Reset Progress Stats
    progressBar.style.width = '0%';
    percentText.textContent = '0%';
    speedText.textContent = '--';
    etaText.textContent = '--';
    statusText.textContent = 'Initializing download...';

    try {
      // POST request to start download
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start download');
      }

      const downloadId = data.id;

      // Start SSE connection to listen for progress
      startListening(downloadId);

    } catch (err) {
      handleError(err.message);
    }
  });

  function startListening(id) {
    if (eventSource) {
      eventSource.close();
    }
    
    eventSource = new EventSource(`/api/progress/${id}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'downloading') {
        statusText.textContent = 'Downloading media...';
        progressBar.style.width = `${data.percent}%`;
        percentText.textContent = `${data.percent}%`;
        speedText.textContent = data.speed || '--';
        etaText.textContent = data.eta || '--';
      } 
      else if (data.status === 'completed') {
        // Close SSE
        eventSource.close();
        handleSuccess(data.filename);
      } 
      else if (data.status === 'error') {
        eventSource.close();
        handleError(data.error);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
      // Normally, don't show an error here if it just closed cleanly
      // but if it errors out before completion, we should handle it
      if (!successArea.classList.contains('hidden')) return;
      handleError('Connection to server lost.');
    };
  }

  function handleSuccess(filename) {
    progressArea.classList.add('hidden');
    successArea.classList.remove('hidden');
    
    // Automatically trigger the download
    const downloadUrl = `/api/file/${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleError(message) {
    progressArea.classList.add('hidden');
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    resetInputs();
  }

  function resetInputs() {
    submitBtn.disabled = false;
    urlInput.disabled = false;
  }

  downloadAgainBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
    successArea.classList.add('hidden');
    resetInputs();
  });
});
