import React, { useState, useRef, useCallback, useEffect } from 'react';
import './AppNew.css';
import ConfirmationDialog from './ConfirmationDialog';

// --- CONFIGURATION ---
const WEBSOCKET_API_URL = process.env.REACT_APP_WEBSOCKET_URL || 'wss://x78a3l7kod.execute-api.us-east-1.amazonaws.com/prod';
const PAGE_UPDATE_API_URL = process.env.REACT_APP_PAGE_UPDATE_URL || 'https://yapgos1vs8.execute-api.us-east-1.amazonaws.com/prod/update-page';
const HTTP_API_BASE_URL = process.env.REACT_APP_HTTP_API_URL || 'https://ev4qk026s0.execute-api.us-east-1.amazonaws.com';
const WORDPRESS_SITE_URL = 'https://wordpress-1279759-5772279.cloudwaysapps.com';
const TEST_PROJECT_ID = "Taofeek";

function AppNew() {
  // Core state
  const [previewId, setPreviewId] = useState('');
  const [previewIdInput, setPreviewIdInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Not Connected');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentBotMessage, setCurrentBotMessage] = useState('');
  
  // Progress state
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('idle'); // idle, initiating, chatting, updating, complete
  
  // Update state
  const [isUpdatingPage, setIsUpdatingPage] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null); // 'queued', 'processing', 'completed', 'failed'
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Confirmation dialog state
  const [confirmationData, setConfirmationData] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const websocket = useRef(null);
  const messageEndRef = useRef(null);
  const progressEndRef = useRef(null);
  const previewIdRef = useRef(null); // Keep current preview ID in ref

  // Update preview ID ref whenever state changes
  useEffect(() => {
    previewIdRef.current = previewId;
    console.log("Preview ID ref updated to:", previewId);
  }, [previewId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, currentBotMessage]);

  // Auto-scroll to bottom of progress log
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressUpdates]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (websocket.current) {
        console.log("Closing WebSocket connection...");
        websocket.current.close();
      }
    };
  }, []);

  // Poll task status for page update
  const pollTaskStatus = useCallback(async (taskId) => {
    console.log(`Polling status for task: ${taskId}`);
    const baseUrl = PAGE_UPDATE_API_URL.endsWith('/update-page') 
        ? PAGE_UPDATE_API_URL.slice(0, -12)
        : PAGE_UPDATE_API_URL;
    const statusUrl = `${baseUrl}/task/${taskId}`;
    
    const maxAttempts = 60;
    let attempts = 0;
    let previousProgressCount = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const taskData = await response.json();
          console.log('Task status:', taskData);
          
          // Update task status
          setTaskStatus(taskData.status);
          
          // Update progress messages - only add new ones
          if (taskData.progress && taskData.progress.length > previousProgressCount) {
            const newMessages = taskData.progress.slice(previousProgressCount);
            newMessages.forEach(progressItem => {
              // Parse the message to show more detailed progress
              let icon = '📝';
              const msg = progressItem.message || progressItem;
              
              if (msg.includes('Starting') || msg.includes('Initiating')) {
                icon = '🚀';
              } else if (msg.includes('Processing') || msg.includes('Updating')) {
                icon = '⚙️';
              } else if (msg.includes('Completed') || msg.includes('Success')) {
                icon = '✅';
              } else if (msg.includes('Error') || msg.includes('Failed')) {
                icon = '❌';
              } else if (msg.includes('Publishing') || msg.includes('Saving')) {
                icon = '💾';
              } else if (msg.includes('Validating') || msg.includes('Checking')) {
                icon = '🔍';
              }
              
              addProgress(`${icon} ${msg}`);
            });
            previousProgressCount = taskData.progress.length;
          }
          
          // Check if task is complete
          if (taskData.status === 'completed') {
            clearInterval(pollInterval);
            setIsUpdatingPage(false);
            setCurrentPhase('idle'); // Change back to idle so user can send new messages
            setIsProcessing(false); // Allow new messages
            setTaskStatus(null); // Clear task status
            setCurrentTaskId(null); // Clear task ID
            
            if (taskData.result) {
              // Don't show the update result popup anymore
              // setUpdateResult({ success: true, data: taskData.result });
              addProgress(`✅ Update completed successfully!`);
              
              // Always use the WordPress site URL for preview
              setPreviewUrl(WORDPRESS_SITE_URL);
              setShowPreview(true);
              setPreviewLoading(true);
              // Give iframe time to load
              setTimeout(() => setPreviewLoading(false), 3000);
            } else {
              // Task completed but no result - stop loading
              setPreviewLoading(false);
            }
          } else if (taskData.status === 'failed') {
            clearInterval(pollInterval);
            setIsUpdatingPage(false);
            setCurrentPhase('idle'); // Change back to idle so user can try again
            setIsProcessing(false); // Allow new messages
            setPreviewLoading(false); // Stop loading in preview
            setTaskStatus(null); // Clear task status
            setCurrentTaskId(null); // Clear task ID
            // Don't show popup, just log the error
            addProgress(`❌ Error: ${taskData.error || 'Update failed'}`);
          }
        }
      } catch (error) {
        console.error('Error polling task status:', error);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setIsUpdatingPage(false);
        setCurrentPhase('idle'); // Back to idle for retry
        setIsProcessing(false); // Allow new messages
        setTaskStatus(null); // Clear task status
        setCurrentTaskId(null); // Clear task ID
        setPreviewLoading(false); // Stop loading
        addProgress('⏱️ Update timed out after 5 minutes');
        // Still show the WordPress site since update might have succeeded
        setPreviewUrl(WORDPRESS_SITE_URL);
        setShowPreview(true);
      }
    }, 5000);
  }, []);

  // Trigger WordPress page update
  const triggerPageUpdate = useCallback(async () => {
    console.log("Starting page update process...");
    const currentPreviewId = previewIdRef.current || previewId;
    console.log("Current Preview ID from ref:", currentPreviewId);
    console.log("Current Preview ID from state:", previewId);
    
    // Validate preview ID exists
    if (!currentPreviewId) {
      console.error("ERROR: Preview ID is missing!");
      addProgress(`❌ Error: Preview ID is missing. Cannot update WordPress.`);
      setIsUpdatingPage(false);
      setCurrentPhase('idle');
      setIsProcessing(false);
      setPreviewLoading(false);
      return;
    }
    
    setIsUpdatingPage(true);
    setCurrentPhase('updating');
    setPreviewLoading(true); // Show loading in preview
    addProgress(`🚀 Initiating WordPress update with Preview ID: ${currentPreviewId}...`);

    const payload = {
      preview_id: currentPreviewId
    };

    try {
      console.log('Sending POST request to:', PAGE_UPDATE_API_URL);
      console.log('Request payload:', JSON.stringify(payload));
      
      const response = await fetch(PAGE_UPDATE_API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      const resultData = await response.json();
      console.log('Response data:', resultData);

      // Check for different response formats
      if ((response.status === 202 || response.status === 200) && resultData.taskId) {
        // Task queued successfully
        setCurrentTaskId(resultData.taskId);
        setTaskStatus(resultData.status || 'queued');
        addProgress(`✅ Update task queued: ${resultData.taskId}`);
        addProgress(`📍 Status: ${resultData.status || 'queued'}`);
        
        if (resultData.message) {
          addProgress(`💬 ${resultData.message}`);
        }
        
        // Start polling for task status after a short delay
        setTimeout(() => {
          pollTaskStatus(resultData.taskId);
        }, 1000);
      } else {
        setUpdateResult({ success: true, data: resultData });
        setCurrentPhase('idle'); // Back to idle for new messages
        setIsProcessing(false); // Allow new messages
        addProgress(`✅ WordPress updated successfully!`);
        // Set the WordPress preview URL
        setPreviewUrl(WORDPRESS_SITE_URL);
        setShowPreview(true);
        setPreviewLoading(true);
        setTimeout(() => setPreviewLoading(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update page:', error);
      setUpdateResult({ success: false, message: error.message });
      addProgress(`❌ Error: ${error.message}`);
      setCurrentPhase('idle'); // Back to idle for retry
      setIsProcessing(false); // Allow new messages
    } finally {
      setIsUpdatingPage(false);
    }
  }, [previewId, pollTaskStatus]);

  // Add progress message helper
  const addProgress = (message) => {
    setProgressUpdates(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message
    }]);
  };

  // Initialize preview session
  const initiatePreview = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      addProgress('🔄 Initiating new preview session...');
      setCurrentPhase('initiating');

      const initiatePayload = {
        action: "initiatePreview",
        userId: TEST_PROJECT_ID
      };

      // Set up one-time listener for preview initiation response
      const handleInitResponse = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'previewInitiated') {
            if (data.status === 'success' && data.previewId) {
              console.log("Setting preview ID from initiation response:", data.previewId);
              setPreviewId(data.previewId);
              previewIdRef.current = data.previewId; // Also update ref immediately
              addProgress(`✅ Preview session created: ${data.previewId}`);
              resolve(data.previewId);
            } else {
              reject(new Error(data.message || 'Failed to initiate preview'));
            }
            websocket.current.removeEventListener('message', handleInitResponse);
          }
        } catch (e) {
          console.error('Error parsing initiation response:', e);
        }
      };

      websocket.current.addEventListener('message', handleInitResponse);
      websocket.current.send(JSON.stringify(initiatePayload));

      // Timeout after 15 seconds
      setTimeout(() => {
        websocket.current.removeEventListener('message', handleInitResponse);
        reject(new Error('Timeout waiting for preview initiation'));
      }, 15000);
    });
  }, []);

  // Connect to WebSocket
  const handleConnect = useCallback(async () => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      console.log('Already connected.');
      return;
    }

    console.log(`Connecting to WebSocket...`);
    setConnectionStatus('Connecting...');
    setCurrentPhase('idle');
    
    // Reset state
    setChatMessages([]);
    setProgressUpdates([]);
    setUpdateResult(null);
    setCurrentBotMessage('');
    setShowPreview(false);
    setPreviewUrl('');

    websocket.current = new WebSocket(WEBSOCKET_API_URL);

    websocket.current.onopen = async () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
      setConnectionStatus('Connected');
      addProgress('✅ WebSocket connected');

      // Check if we need to initiate a new preview or use existing
      if (previewIdInput.trim()) {
        // Use existing preview ID
        const existingId = previewIdInput.trim();
        console.log("Using existing preview ID:", existingId);
        setPreviewId(existingId);
        previewIdRef.current = existingId; // Update ref immediately
        addProgress(`📋 Using existing Preview ID: ${existingId}`);
        setCurrentPhase('idle');
      } else {
        // Initiate new preview session
        try {
          const newPreviewId = await initiatePreview();
          setPreviewIdInput(newPreviewId);
          setCurrentPhase('idle');
        } catch (error) {
          console.error('Failed to initiate preview:', error);
          addProgress(`❌ Failed to initiate preview: ${error.message}`);
          setCurrentPhase('idle');
        }
      }
    };

    websocket.current.onclose = () => {
      console.log('WebSocket connection closed.');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setIsBotTyping(false);
      setCurrentPhase('idle');
    };

    websocket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setConnectionStatus('Connection Error');
      setIsBotTyping(false);
      setCurrentPhase('idle');
    };

    websocket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'streamChunk':
            setIsBotTyping(true);
            let chunkContent = '';
            try {
              if (data.message) {
                const messageData = JSON.parse(data.message);
                if (messageData.type === 'delta' && messageData.content) {
                  chunkContent = messageData.content;
                }
              }
            } catch (parseError) {
              chunkContent = data.message || data.data?.content || '';
            }
            
            setCurrentBotMessage(prev => prev + chunkContent);
            break;

          case 'progressUpdate':
            if (data.message && !data.message.includes('Stream started')) {
              addProgress(`⚙️ ${data.message}`);
            }
            if (data.isFinal) {
              setIsBotTyping(false);
              // Move current bot message to chat history
              if (currentBotMessage) {
                setChatMessages(prev => [...prev, { sender: 'bot', text: currentBotMessage }]);
                setCurrentBotMessage('');
              }
              // Check the status to determine if we should trigger page update
              // Only trigger if status is 'completed' (actions were performed)
              // Don't trigger for 'no_actions', 'error', or other statuses
              if (data.status === 'completed') {
                // Actions were completed, trigger WordPress update
                setTimeout(() => {
                  console.log("Actions completed, triggering page update with preview ID:", previewId);
                  triggerPageUpdate();
                }, 100);
              } else if (data.status === 'no_actions') {
                // No actions needed, just conversational response
                console.log("No actions performed, conversation only");
                setIsProcessing(false);
                setPreviewLoading(false);
                setCurrentPhase('idle');
              } else if (data.status === 'awaiting_confirmation') {
                // Waiting for user confirmation
                console.log("Awaiting user confirmation");
                setIsProcessing(false);
                setPreviewLoading(false);
              } else {
                // Other status (error, etc.)
                console.log(`Final status: ${data.status}, not triggering update`);
                setIsProcessing(false);
                setPreviewLoading(false);
                setCurrentPhase('idle');
              }
            }
            break;
            
          case 'state_updated':
            addProgress(`📢 State updated on backend`);
            break;

          case 'action_confirmation':
            // Handle confirmation request from backend
            console.log('Received confirmation request:', data);
            setConfirmationData({
              confirmation_id: data.confirmation_id,
              action: data.action,
              widgets: data.widgets || [],
              total_count: data.total_count || 0,
              preview_message: data.preview_message,
              user_message: data.user_message
            });
            setShowConfirmation(true);
            setIsBotTyping(false);
            addProgress(`⏸️ Waiting for your confirmation...`);
            break;

          case 'confirmation_result':
            // Handle confirmation result
            if (data.status === 'confirmed') {
              addProgress(`✅ Action confirmed - executing changes...`);
            } else if (data.status === 'cancelled') {
              addProgress(`❌ Action cancelled`);
            } else if (data.status === 'modified') {
              addProgress(`✏️ Action modified - executing selected changes...`);
            }
            setShowConfirmation(false);
            setConfirmationData(null);
            break;

          default:
            console.log('Received message:', data.type);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }, [previewIdInput, initiatePreview, triggerPageUpdate, currentBotMessage]);

  // Disconnect handler
  const handleDisconnect = () => {
    if (websocket.current) {
      websocket.current.close();
    }
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    setCurrentPhase('idle');
  };

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!userInput.trim() || !isConnected || isBotTyping || isProcessing) return;

    // Clear progress and task state for new request
    setProgressUpdates([]);
    setCurrentTaskId(null);
    setTaskStatus(null);
    
    const currentPreviewId = previewIdRef.current || previewId;
    
    const messagePayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: currentPreviewId,
      content: userInput,
    };

    console.log('Sending message with preview ID:', currentPreviewId);
    console.log('Full message payload:', messagePayload);
    websocket.current.send(JSON.stringify(messagePayload));
    
    setChatMessages(prev => [...prev, { sender: 'user', text: userInput }]);
    setUserInput('');
    setIsBotTyping(true);
    setIsProcessing(true);
    setCurrentPhase('chatting');
    setCurrentBotMessage('');
    setUpdateResult(null); // Clear any previous update results
    setPreviewLoading(true); // Start loading state immediately
    addProgress(`💬 Processing: "${userInput.substring(0, 50)}..."`);
  };

  // Confirmation dialog handlers
  const handleConfirmAction = useCallback((confirmationId) => {
    if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const confirmPayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: previewIdRef.current || previewId,
      content: JSON.stringify({
        confirmation_type: 'action_confirmation',
        confirmation_id: confirmationId,
        confirmation_action: 'confirm'
      })
    };

    console.log('Sending confirmation:', confirmPayload);
    websocket.current.send(JSON.stringify(confirmPayload));
    setShowConfirmation(false);
    setIsProcessing(true);
    addProgress(`✅ Confirmed - executing all changes...`);
  }, [previewId]);

  const handleCancelAction = useCallback((confirmationId) => {
    if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const cancelPayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: previewIdRef.current || previewId,
      content: JSON.stringify({
        confirmation_type: 'action_confirmation',
        confirmation_id: confirmationId,
        confirmation_action: 'cancel'
      })
    };

    console.log('Sending cancellation:', cancelPayload);
    websocket.current.send(JSON.stringify(cancelPayload));
    setShowConfirmation(false);
    addProgress(`❌ Action cancelled by user`);
  }, [previewId]);

  const handleModifyAction = useCallback((confirmationId, selectedWidgets) => {
    if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const modifyPayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: previewIdRef.current || previewId,
      content: JSON.stringify({
        confirmation_type: 'action_confirmation',
        confirmation_id: confirmationId,
        confirmation_action: 'modify',
        modified_widgets: selectedWidgets
      })
    };

    console.log(`Sending modified action with ${selectedWidgets.length} widgets`);
    websocket.current.send(JSON.stringify(modifyPayload));
    setShowConfirmation(false);
    setIsProcessing(true);
    addProgress(`✏️ Executing modified action with ${selectedWidgets.length} widgets...`);
  }, [previewId]);

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>SCAI Preview & Chat System</h1>
        <div className="connection-controls">
          <div className="input-group">
            <input
              type="text"
              value={previewIdInput}
              onChange={(e) => setPreviewIdInput(e.target.value)}
              placeholder="Enter Preview ID (or leave empty for new)"
              disabled={isConnected}
              className="preview-id-input"
            />
            {!isConnected ? (
              <button onClick={handleConnect} className="connect-btn">
                {previewIdInput ? 'Connect with ID' : 'Start New Preview'}
              </button>
            ) : (
              <button onClick={handleDisconnect} className="disconnect-btn">
                Disconnect
              </button>
            )}
          </div>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {connectionStatus}
            {previewId && isConnected && (
              <span className="preview-id-display"> | ID: {previewId}</span>
            )}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-section">
          <div className="chat-header">
            <h2>Chat Assistant</h2>
            <span className={`phase-indicator phase-${currentPhase}`}>
              {currentPhase === 'idle' && '⚪ Ready'}
              {currentPhase === 'initiating' && '🔄 Initiating...'}
              {currentPhase === 'chatting' && '💬 Processing...'}
              {currentPhase === 'updating' && '📝 Updating WordPress...'}
              {currentPhase === 'complete' && '✅ Complete'}
            </span>
          </div>
          
          <div className="chat-messages">
            <div className="chat-messages-inner">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  <span className="message-label">{msg.sender === 'user' ? 'You' : 'AI'}</span>
                  <div className="message-content">{msg.text}</div>
                </div>
              ))}
              {currentBotMessage && (
                <div className="message bot">
                  <span className="message-label">AI</span>
                  <div className="message-content">{currentBotMessage}</div>
                </div>
              )}
              {isBotTyping && !currentBotMessage && (
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
              disabled={!isConnected || isBotTyping || isProcessing}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={!isConnected || isBotTyping || isProcessing}
              className="send-btn"
            >
              {isProcessing ? '⏳' : '➤'}
            </button>
          </form>

          <div className="progress-panel">
            <h3>Process Log</h3>
            <div className="progress-list">
              {progressUpdates.map((update, index) => (
                <div key={index} className="progress-item">
                  <span className="progress-time">{update.time}</span>
                  <span className="progress-message">{update.message}</span>
                </div>
              ))}
              <div ref={progressEndRef} />
            </div>
          </div>
        </div>

        <div className="preview-section">
          <div className="preview-header">
            <h2>Website Preview</h2>
            {previewUrl && (
              <div className="preview-actions">
                <button 
                  onClick={() => {
                    setPreviewLoading(true);
                    // Force iframe refresh by changing key
                    setShowPreview(false);
                    setTimeout(() => {
                      setShowPreview(true);
                      setTimeout(() => setPreviewLoading(false), 2000);
                    }, 100);
                  }}
                  className="refresh-btn"
                  title="Refresh preview"
                >
                  🔄
                </button>
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="open-external"
                >
                  Open in New Tab ↗
                </a>
              </div>
            )}
          </div>
          
          <div className="preview-container">
            {!showPreview && !previewUrl && !isProcessing && (
              <div className="preview-placeholder">
                <div className="placeholder-content">
                  <span className="placeholder-icon">🌐</span>
                  <p>Website preview will appear here</p>
                  <small>Complete the generation process to see your website</small>
                </div>
              </div>
            )}
            
            {((previewLoading && !currentTaskId) || (isProcessing && taskStatus !== 'completed' && taskStatus !== 'failed')) && (
              <div className="preview-loading">
                <div className="loading-spinner"></div>
                <p>{isUpdatingPage ? 'Updating WordPress...' : isProcessing ? 'Processing your request...' : 'Loading preview...'}</p>
                {isProcessing && !isUpdatingPage && (
                  <small>Generating content with AI...</small>
                )}
                {currentTaskId && taskStatus && (
                  <div className="task-status">
                    <small>Task ID: {currentTaskId}</small>
                    <div className={`status-badge status-${taskStatus}`}>
                      {taskStatus === 'queued' && '⏳ Queued'}
                      {taskStatus === 'processing' && '⚙️ Processing'}
                      {taskStatus === 'completed' && '✅ Completed'}
                      {taskStatus === 'failed' && '❌ Failed'}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {previewUrl && showPreview && (!previewLoading || taskStatus === 'completed') && (
              <iframe
                key={Date.now()} // Force refresh when showPreview changes
                src={previewUrl}
                title="Website Preview"
                className="preview-iframe"
                onLoad={() => setPreviewLoading(false)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>

          {/* Update result popup removed - now shows in progress log only */}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        confirmationData={confirmationData}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        onModify={handleModifyAction}
        isVisible={showConfirmation}
      />
    </div>
  );
}

export default AppNew;