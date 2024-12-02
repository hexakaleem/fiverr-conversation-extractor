// Update status message in popup
function updateStatus(message, isError = false, isProgress = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${isError ? 'error' : isProgress ? 'progress' : 'success'}`;
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'size unknown';
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Add log entry
function addLogEntry(message, isError = false) {
  const progressLog = document.getElementById('progressLog');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry${isError ? ' error' : ''}`;
  logEntry.textContent = message;
  progressLog.appendChild(logEntry);
  progressLog.scrollTop = progressLog.scrollHeight;
}

// Update contact counter
function updateContactCounter(count) {
  const counterDiv = document.getElementById('progressCounter');
  const countSpan = document.getElementById('contactCount');
  counterDiv.style.display = 'block';
  countSpan.textContent = count;
}

// Display attachments in popup
function displayAttachments(messages) {
  const attachmentsDiv = document.getElementById('attachments');
  attachmentsDiv.innerHTML = '';

  messages.forEach(message => {
    if (message.attachments && message.attachments.length > 0) {
      message.attachments.forEach(attachment => {
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-item';
        
        const info = document.createElement('div');
        info.className = 'attachment-info';
        info.textContent = `${attachment.filename} (${formatFileSize(attachment.fileSize)})`;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => {
          chrome.downloads.download({
            url: attachment.downloadUrl,
            filename: attachment.filename,
            saveAs: true
          });
        };

        attachmentDiv.appendChild(info);
        attachmentDiv.appendChild(downloadBtn);
        attachmentsDiv.appendChild(attachmentDiv);
      });
    }
  });
}

// Display contacts in popup
function displayContacts(contacts) {
  const contactsDiv = document.getElementById('contacts');
  const contactsList = document.getElementById('contactsList');
  contactsDiv.innerHTML = '';
  contactsList.style.display = 'block';

  contacts.forEach(contact => {
    const contactDiv = document.createElement('div');
    contactDiv.className = 'contact-item';
    contactDiv.textContent = `${contact.username} (${new Date(contact.recentMessageDate).toLocaleDateString()})`;
    contactDiv.onclick = () => {
      // Store username and trigger extraction
      chrome.storage.local.set({ currentUsername: contact.username }, () => {
        // Only send message after storage is set
        chrome.runtime.sendMessage({ type: 'EXTRACT_CONVERSATION' });
        updateStatus(`Extracting conversation with ${contact.username}...`, false, true);
      });
    };
    contactsDiv.appendChild(contactDiv);
  });
}

// Show conversation actions
function showConversationActions(username) {
  const actionsDiv = document.getElementById('conversationActions');
  actionsDiv.style.display = 'block';
}

// Handle conversation extraction success
function handleConversationExtracted(data) {
  updateStatus('Conversation extracted successfully!');
  
  // Show conversation actions
  const actionsDiv = document.getElementById('conversationActions');
  actionsDiv.style.display = 'block';

  // Handle attachments if any
  const attachmentsDiv = document.getElementById('attachments');
  attachmentsDiv.innerHTML = ''; // Clear previous attachments
  
  let hasAttachments = false;

  // Process attachments from all messages
  if (data && data.messages) {
    data.messages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        hasAttachments = true;
        message.attachments.forEach(attachment => {
          // Check if attachment has required fields
          if (attachment && typeof attachment === 'object') {
            const fileName = attachment.file_name || attachment.filename || 'Unnamed File';
            const fileSize = attachment.file_size || attachment.fileSize || 0;
            const downloadUrl = attachment.download_url || attachment.downloadUrl;

            if (downloadUrl) {
              const downloadBtn = document.createElement('button');
              downloadBtn.className = 'attachment-button';
              downloadBtn.innerHTML = ` ${fileName} <small>(${formatFileSize(fileSize)})</small>`;
              downloadBtn.title = fileName;
              downloadBtn.onclick = () => {
                chrome.downloads.download({
                  url: downloadUrl,
                  filename: fileName,
                  saveAs: true
                });
              };
              
              attachmentsDiv.appendChild(downloadBtn);
            }
          }
        });
      }
    });
  }

  // Show attachments section if there are any
  attachmentsDiv.style.display = hasAttachments ? 'block' : 'none';
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Initialize connection with background script
  chrome.runtime.sendMessage({ type: 'INIT_POPUP' });

  // Check if we're on a Fiverr page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl.includes('fiverr.com')) {
      updateStatus('Ready to extract Fiverr data.');
      
      // Get any existing conversation data
      chrome.storage.local.get(['conversationData', 'currentUsername'], function(result) {
        if (result.conversationData) {
          displayAttachments(result.conversationData.messages);
          if (result.currentUsername) {
            showConversationActions(result.currentUsername);
          }
        }
      });
    } else {
      updateStatus('Please navigate to Fiverr to use this extension.', true);
    }
  });

  // Fetch Contacts button click handler
  document.getElementById('fetchContactsBtn').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      if (!currentUrl.includes('fiverr.com')) {
        updateStatus('Please navigate to Fiverr first.', true);
        return;
      }
      
      // Reset UI
      document.getElementById('progressLog').style.display = 'block';
      document.getElementById('progressLog').innerHTML = '';
      document.getElementById('progressCounter').style.display = 'block';
      document.getElementById('contactCount').textContent = '0';
      
      updateStatus('Fetching all contacts...', false, true);
      chrome.runtime.sendMessage({ type: 'FETCH_ALL_CONTACTS' });
    });
  });

  // Extract button click handler
  document.getElementById('extractBtn').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = tabs[0].url;
      
      // Only allow extraction from specific inbox URL format
      const match = url.match(/^https:\/\/www\.fiverr\.com\/inbox\/([^\/\?]+)$/);
      if (!match) {
        updateStatus('Please open a specific inbox URL (e.g., https://www.fiverr.com/inbox/username)', true);
        return;
      }

      const username = match[1];
      chrome.storage.local.set({ currentUsername: username });
      chrome.runtime.sendMessage({ type: 'EXTRACT_CONVERSATION' });
      updateStatus('Extracting conversation...', false, true);
    });
  });

  // Download button click handler
  document.getElementById('downloadBtn').addEventListener('click', () => {
    chrome.storage.local.get(['markdownContent', 'currentUsername'], function(result) {
      if (result.markdownContent && result.currentUsername) {
        const blob = new Blob([result.markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: url,
          filename: `fiverr_conversation_${result.currentUsername}_${new Date().toISOString().split('T')[0]}.md`,
          saveAs: true
        });
      } else {
        updateStatus('Please extract the conversation first.', true);
      }
    });
  });

  // Open in new tab button click handler
  document.getElementById('openBtn').addEventListener('click', () => {
    chrome.storage.local.get(['markdownContent'], function(result) {
      if (result.markdownContent) {
        const blob = new Blob([result.markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        chrome.tabs.create({ url: url });
      } else {
        updateStatus('Please extract the conversation first.', true);
      }
    });
  });

  // Download JSON button click handler
  document.getElementById('downloadJsonBtn').addEventListener('click', () => {
    chrome.storage.local.get(['jsonContent', 'currentUsername'], function(result) {
      if (result.jsonContent && result.currentUsername) {
        const blob = new Blob([JSON.stringify(result.jsonContent, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.currentUsername}_conversation.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        updateStatus('Please extract the conversation first.', true);
      }
    });
  });

  // View JSON button click handler
  document.getElementById('viewJsonBtn').addEventListener('click', () => {
    chrome.storage.local.get(['jsonContent'], function(result) {
      if (result.jsonContent) {
        const blob = new Blob([JSON.stringify(result.jsonContent, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        chrome.tabs.create({ url: url });
      } else {
        updateStatus('Please extract the conversation first.', true);
      }
    });
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
      case 'CONTACTS_PROGRESS':
        updateStatus(request.message, request.isError, true);
        if (request.totalContacts) {
          updateContactCounter(request.totalContacts);
        }
        break;
      
      case 'CONTACTS_FETCHED':
        updateStatus(request.message);
        displayContacts(request.data);
        break;
      
      case 'CONVERSATION_EXTRACTED':
        handleConversationExtracted(request.data);
        break;
      
      case 'EXTRACTION_ERROR':
        updateStatus(request.error, true);
        break;
    }
  });
});
