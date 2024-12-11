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
  const contactCount = document.getElementById('contactCount');
  const progressCounter = document.getElementById('progressCounter');
  if (contactCount && progressCounter) {
    contactCount.textContent = count;
    progressCounter.style.display = 'block';
    
    // Update storage with latest count
    chrome.storage.local.set({ lastContactCount: count });
  }
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
            filename: `${message.username}/attachments/${attachment.filename}`,
            saveAs: false
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
  const contactsList = document.getElementById('contactsList');
  if (!contactsList) return;

  contactsList.innerHTML = ''; // Clear existing contacts
  
  if (!contacts || contacts.length === 0) {
    contactsList.innerHTML = '<div class="no-contacts">No contacts found</div>';
    return;
  }

  contacts.forEach(contact => {
    const contactDiv = document.createElement('div');
    contactDiv.className = 'contact-item';
    
    const username = contact.username || 'Unknown User';
    const lastMessage = new Date(contact.recentMessageDate).toLocaleString();
    
    contactDiv.innerHTML = `
      <div class="contact-name">${username}</div>
      <div class="contact-last-message">Last message: ${lastMessage}</div>
    `;
    
    contactDiv.addEventListener('click', () => {
      // Store username and trigger extraction
      chrome.storage.local.set({ currentUsername: username }, () => {
        // Only send message after storage is set
        chrome.runtime.sendMessage({ type: 'EXTRACT_CONVERSATION' });
        updateStatus(`Extracting conversation with ${username}...`, false, true);
      });
    });
    
    contactsList.appendChild(contactDiv);
  });
}

// Function to load stored contacts
function loadStoredContacts() {
  chrome.storage.local.get(['allContacts', 'lastContactsFetch', 'lastContactCount'], function(result) {
    if (result.allContacts && result.allContacts.length > 0) {
      displayContacts(result.allContacts);
      
      // Use the actual contacts length for the counter
      updateContactCounter(result.allContacts.length);
      
      // Show last fetch time if available
      if (result.lastContactsFetch) {
        const lastFetch = new Date(result.lastContactsFetch).toLocaleString();
        const progressCounter = document.getElementById('progressCounter');
        if (progressCounter) {
          progressCounter.style.display = 'block';
          progressCounter.innerHTML = `Total Contacts: <span id="contactCount">${result.allContacts.length}</span><br>Last updated: ${lastFetch}`;
        }
      }
    }
  });
}

// Function to update last fetch time
function updateLastFetchTime() {
    const progressCounter = document.getElementById('progressCounter');
    if (progressCounter) {
        const lastFetch = new Date().toLocaleString();
        progressCounter.style.display = 'block';
        progressCounter.innerHTML = `Total Contacts: <span id="contactCount">${document.getElementById('contactCount')?.textContent || '0'}</span><br>Last updated: ${lastFetch}`;
    }
}

// Show conversation actions
function showConversationActions(username) {
  const actionsDiv = document.getElementById('conversationActions');
  actionsDiv.style.display = 'block';
}

// Handle conversation extraction success
function handleConversationExtracted(data, message) {
  updateStatus(message || 'Conversation extracted successfully!');
  
  // Extract username from message
  const usernameMatch = message?.match(/Conversation with (.+) extracted successfully!/);
  const username = usernameMatch ? usernameMatch[1] : '';
  
  // Update and show current conversation
  const currentConversationDiv = document.getElementById('currentConversation');
  if (currentConversationDiv && username) {
    currentConversationDiv.textContent = `Conversation with ${username}`;
    currentConversationDiv.style.display = 'block';
    
    // Store current conversation info
    chrome.storage.local.set({ 
      currentConversationUsername: username,
      lastExtractedTime: Date.now()
    });
  }
  
  // Show conversation actions
  const actionsDiv = document.getElementById('conversationActions');
  actionsDiv.style.display = 'block';

  // Handle attachments if any
  const attachmentsDiv = document.getElementById('attachments');
  const viewAttachmentsBtn = document.getElementById('viewAttachmentsBtn');
  attachmentsDiv.innerHTML = ''; // Clear previous attachments
  
  let hasAttachments = false;
  let totalAttachments = 0;

  // Process attachments from all messages
  if (data && data.messages) {
    data.messages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        hasAttachments = true;
        totalAttachments += message.attachments.length;
        message.attachments.forEach(attachment => {
          // Check if attachment has required fields
          if (attachment && typeof attachment === 'object') {
            const fileName = attachment.file_name || attachment.filename || 'Unnamed File';
            const fileSize = attachment.file_size || attachment.fileSize || 0;
            const downloadUrl = attachment.download_url || attachment.downloadUrl;

            if (downloadUrl) {
              const attachmentDiv = document.createElement('div');
              attachmentDiv.className = 'attachment-item';
              
              const info = document.createElement('div');
              info.className = 'attachment-info';
              info.textContent = `${fileName} (${formatFileSize(fileSize)})`;
              
              const downloadBtn = document.createElement('button');
              downloadBtn.className = 'download-btn';
              downloadBtn.textContent = 'Download';
              downloadBtn.onclick = () => {
                chrome.downloads.download({
                  url: downloadUrl,
                  filename: `${username}/attachments/${fileName}`,
                  saveAs: false
                });
              };

              attachmentDiv.appendChild(info);
              attachmentDiv.appendChild(downloadBtn);
              attachmentsDiv.appendChild(attachmentDiv);
            }
          }
        });
      }
    });
  }

  // Show/Hide attachments button based on whether there are attachments
  if (viewAttachmentsBtn) {
    if (hasAttachments) {
      viewAttachmentsBtn.style.display = 'block';
      viewAttachmentsBtn.onclick = () => {
        const isVisible = attachmentsDiv.style.display === 'block';
        attachmentsDiv.style.display = isVisible ? 'none' : 'block';
        viewAttachmentsBtn.textContent = isVisible 
            ? `📎 View Attachments (${totalAttachments})` 
            : `📎 Hide Attachments (${totalAttachments})`;
      };
      // Set initial button text with attachment count
      viewAttachmentsBtn.textContent = `📎 View Attachments (${totalAttachments})`;
    } else {
      viewAttachmentsBtn.style.display = 'none';
    }
  }
}

// Add status checking functionality
let statusCheckInterval = null;

function updateUIWithStatus(status) {
    const contactsStatus = status?.contacts;
    const conversationStatus = status?.conversations;

    // Update contacts UI
    if (contactsStatus) {
        const contactsButton = document.getElementById('fetchContactsButton');
        const contactsProgress = document.getElementById('contactsProgress');
        
        if (contactsStatus.status === 'running') {
            contactsButton.disabled = true;
            contactsProgress.textContent = contactsStatus.progress || 'Processing...';
            contactsProgress.style.display = 'block';
        } else if (contactsStatus.status === 'completed') {
            contactsButton.disabled = false;
            contactsProgress.textContent = contactsStatus.message || 'Completed!';
            setTimeout(() => {
                contactsProgress.style.display = 'none';
            }, 3000);
        }
    }

    // Update conversation UI
    if (conversationStatus) {
        const extractButton = document.getElementById('extractButton');
        const extractionProgress = document.getElementById('extractionProgress');
        
        if (conversationStatus.status === 'running') {
            extractButton.disabled = true;
            extractionProgress.textContent = conversationStatus.progress || 'Processing...';
            extractionProgress.style.display = 'block';
        } else if (conversationStatus.status === 'completed') {
            extractButton.disabled = false;
            extractionProgress.textContent = conversationStatus.message || 'Completed!';
            setTimeout(() => {
                extractionProgress.style.display = 'none';
            }, 3000);
        } else if (conversationStatus.status === 'error') {
            extractButton.disabled = false;
            extractionProgress.textContent = `Error: ${conversationStatus.error}`;
            extractionProgress.style.display = 'block';
        }
    }
}

function startStatusChecking() {
    if (statusCheckInterval) return;
    
    // Check status immediately
    chrome.runtime.sendMessage({ type: 'GET_PROCESS_STATUS' }, updateUIWithStatus);
    
    // Then check every 2 seconds
    statusCheckInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'GET_PROCESS_STATUS' }, updateUIWithStatus);
    }, 2000);
}

function stopStatusChecking() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
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

  // Load current conversation if exists
  chrome.storage.local.get(['currentConversationUsername', 'lastExtractedTime'], function(result) {
    if (result.currentConversationUsername) {
      const currentConversationDiv = document.getElementById('currentConversation');
      if (currentConversationDiv) {
        currentConversationDiv.textContent = `Conversation with ${result.currentConversationUsername}`;
        currentConversationDiv.style.display = 'block';
        
        // Show conversation actions
        const actionsDiv = document.getElementById('conversationActions');
        actionsDiv.style.display = 'block';
      }
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
        chrome.downloads.download({
          url: URL.createObjectURL(blob),
          filename: `${result.currentUsername}/conversations/fiverr_conversation_${result.currentUsername}_${new Date().toISOString().split('T')[0]}.md`,
          saveAs: false
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
        chrome.tabs.create({ url: URL.createObjectURL(blob) });
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
        chrome.downloads.download({
          url: URL.createObjectURL(blob),
          filename: `${result.currentUsername}/conversations/${result.currentUsername}_conversation.json`,
          saveAs: false
        });
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
        chrome.tabs.create({ url: URL.createObjectURL(blob) });
      } else {
        updateStatus('Please extract the conversation first.', true);
      }
    });
  });

  // Load stored contacts when popup opens
  loadStoredContacts();
  
  // Start status checking
  startStatusChecking();
  
  // Initialize attachments button if there's stored conversation data
  chrome.storage.local.get(['conversationData'], function(result) {
    if (result.conversationData) {
      handleConversationExtracted(result.conversationData);
    }
  });
});

// Handle messages from content script
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
      if (request.data) {
        displayContacts(request.data);
        updateContactCounter(request.data.length);
        updateLastFetchTime(); // Update the timestamp immediately
      }
      break;
    
    case 'CONVERSATION_EXTRACTED':
      handleConversationExtracted(request.data, request.message);
      break;
    
    case 'EXTRACTION_ERROR':
      updateStatus(request.error, true);
      break;
  }
});

// Stop checking when popup closes
window.addEventListener('unload', () => {
  stopStatusChecking();
});
