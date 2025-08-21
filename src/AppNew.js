import React, { useState, useRef, useCallback, useEffect } from 'react';
import './AppNew.css';
import DataKeyManager from './DataKeyManager';
// ConfirmationDialog removed - autonomous system handles confirmations in chat

// --- CONFIGURATION ---
const WEBSOCKET_API_URL = process.env.REACT_APP_WEBSOCKET_URL || 'wss://x78a3l7kod.execute-api.us-east-1.amazonaws.com/prod';
const PAGE_UPDATE_API_URL = process.env.REACT_APP_PAGE_UPDATE_URL || 'https://yapgos1vs8.execute-api.us-east-1.amazonaws.com/prod/update-page';
// const HTTP_API_BASE_URL = process.env.REACT_APP_HTTP_API_URL || 'https://ev4qk026s0.execute-api.us-east-1.amazonaws.com';
const WORDPRESS_SITE_URL = 'https://wordpress-1279759-5798798.cloudwaysapps.com';
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
  // const [updateResult, setUpdateResult] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null); // 'queued', 'processing', 'completed', 'failed'
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Confirmation dialog state (simplified for autonomous system)
  const [showWordPressUpdateConfirm, setShowWordPressUpdateConfirm] = useState(false);
  const [pendingPreviewId, setPendingPreviewId] = useState(null);
  const [sessionConfirmationKey, setSessionConfirmationKey] = useState(null); // For CONF_xxxxx codes
  
  // Data Key Manager state
  const [showDataKeyManager, setShowDataKeyManager] = useState(false);
  const [dataKeyApiEndpoint] = useState('https://yapgos1vs8.execute-api.us-east-1.amazonaws.com/prod');
  
  const websocket = useRef(null);
  const messageEndRef = useRef(null);
  const progressEndRef = useRef(null);
  const previewIdRef = useRef(null); // Keep current preview ID in ref

  // Initialize preview with WordPress site on mount
  useEffect(() => {
    setPreviewUrl(WORDPRESS_SITE_URL);
    setShowPreview(true);
  }, []);

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
              let icon = '';
              const msg = progressItem.message || progressItem;
              
              if (msg.includes('Starting') || msg.includes('Initiating')) {
                icon = '';
              } else if (msg.includes('Processing') || msg.includes('Updating')) {
                icon = '';
              } else if (msg.includes('Completed') || msg.includes('Success')) {
                icon = '';
              } else if (msg.includes('Error') || msg.includes('Failed')) {
                icon = '';
              } else if (msg.includes('Publishing') || msg.includes('Saving')) {
                icon = '';
              } else if (msg.includes('Validating') || msg.includes('Checking')) {
                icon = '';
              }
              
              // Only add message if icon is empty, otherwise add with icon
              addProgress(icon ? `${icon} ${msg}` : msg);
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
              addProgress(`Update completed successfully!`);
              
              // Always use the WordPress site URL for preview
              setPreviewUrl(WORDPRESS_SITE_URL);
              // Force refresh the iframe without loading overlay
              setShowPreview(false);
              setTimeout(() => setShowPreview(true), 100);
            } else {
              // Task completed but no result
            }
          } else if (taskData.status === 'failed') {
            clearInterval(pollInterval);
            setIsUpdatingPage(false);
            setCurrentPhase('idle'); // Change back to idle so user can try again
            setIsProcessing(false); // Allow new messages
            setTaskStatus(null); // Clear task status
            setCurrentTaskId(null); // Clear task ID
            // Don't show popup, just log the error
            addProgress(`Error: ${taskData.error || 'Update failed'}`);
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
        addProgress('Update timed out after 5 minutes');
        // Still show the WordPress site since update might have succeeded
        setPreviewUrl(WORDPRESS_SITE_URL);
        setShowPreview(true);
      }
    }, 5000);
  }, []);

  // Trigger WordPress page update with confirmation
  const triggerPageUpdate = useCallback(async (skipConfirmation = false) => {
    console.log("Starting page update process...");
    const currentPreviewId = previewIdRef.current || previewId;
    console.log("Current Preview ID from ref:", currentPreviewId);
    console.log("Current Preview ID from state:", previewId);
    
    // Validate preview ID exists
    if (!currentPreviewId) {
      console.error("ERROR: Preview ID is missing!");
      addProgress(`Error: Preview ID is missing. Cannot update WordPress.`);
      setIsUpdatingPage(false);
      setCurrentPhase('idle');
      setIsProcessing(false);
      return;
    }
    
    // Show confirmation dialog unless skipped
    if (!skipConfirmation) {
      setPendingPreviewId(currentPreviewId);
      setShowWordPressUpdateConfirm(true);
      return;
    }
    
    setIsUpdatingPage(true);
    setCurrentPhase('updating');
    addProgress(`Initiating WordPress update with Preview ID: ${currentPreviewId}...`);

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
        addProgress(`Update task queued: ${resultData.taskId}`);
        addProgress(`Status: ${resultData.status || 'queued'}`);
        
        if (resultData.message) {
          addProgress(`${resultData.message}`);
        }
        
        // Start polling for task status after a short delay
        setTimeout(() => {
          pollTaskStatus(resultData.taskId);
        }, 1000);
      } else {
        // setUpdateResult({ success: true, data: resultData });
        setCurrentPhase('idle'); // Back to idle for new messages
        setIsProcessing(false); // Allow new messages
        addProgress(`WordPress updated successfully!`);
        // Set the WordPress preview URL
        setPreviewUrl(WORDPRESS_SITE_URL);
        // Force refresh without loading overlay
        setShowPreview(false);
        setTimeout(() => {
          setShowPreview(true);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to update page:', error);
      // setUpdateResult({ success: false, message: error.message });
      addProgress(`Error: ${error.message}`);
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

      addProgress('Initiating new preview session...');
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
              addProgress(`Preview session created: ${data.previewId}`);
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
    // Clean up existing connection if any
    if (websocket.current) {
      if (websocket.current.readyState === WebSocket.OPEN) {
        console.log('Already connected.');
        return;
      }
      // Close any existing connection
      websocket.current.close();
      websocket.current = null;
    }

    console.log(`Connecting to WebSocket...`);
    setConnectionStatus('Connecting...');
    setCurrentPhase('idle');
    
    // Reset state
    setChatMessages([]);
    setProgressUpdates([]);
    // setUpdateResult(null);
    setCurrentBotMessage('');
    setShowPreview(false);
    setPreviewUrl('');
    setSessionConfirmationKey(null); // Reset session confirmation key

    websocket.current = new WebSocket(WEBSOCKET_API_URL);

    websocket.current.onopen = async () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
      setConnectionStatus('Connected');
      addProgress('WebSocket connected');

      // Check if we need to initiate a new preview or use existing
      if (previewIdInput.trim()) {
        // Use existing preview ID
        const existingId = previewIdInput.trim();
        console.log("Using existing preview ID:", existingId);
        setPreviewId(existingId);
        previewIdRef.current = existingId; // Update ref immediately
        addProgress(`Using existing Preview ID: ${existingId}`);
        setCurrentPhase('idle');
      } else {
        // Initiate new preview session
        try {
          const newPreviewId = await initiatePreview();
          setPreviewIdInput(newPreviewId);
          setCurrentPhase('idle');
        } catch (error) {
          console.error('Failed to initiate preview:', error);
          addProgress(`Failed to initiate preview: ${error.message}`);
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

    // Remove any existing message handler first
    if (websocket.current.onmessage) {
      websocket.current.onmessage = null;
    }
    
    websocket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data.type, 
          data.type === 'streamChunk' ? '(chunk content)' : data);

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
          
          case 'streamEnd':
            // Handle end of stream - move message to history and check status
            setIsBotTyping(false);
            // Use a functional update to ensure we capture the current message
            setCurrentBotMessage(currentMsg => {
              if (currentMsg && currentMsg.trim()) {
                // Check for session confirmation key in the message
                const confKeyMatch = currentMsg.match(/CONF_[a-f0-9]{8}/i);
                if (confKeyMatch) {
                  setSessionConfirmationKey(confKeyMatch[0]);
                  console.log('Detected session confirmation key:', confKeyMatch[0]);
                }
                
                // Check if this message already exists to prevent duplicates
                setChatMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.sender === 'bot' && lastMessage.text === currentMsg) {
                    console.log('Duplicate message detected, skipping');
                    return prev;
                  }
                  return [...prev, { sender: 'bot', text: currentMsg }];
                });
              }
              return ''; // Clear the current message
            });
            
            // Always re-enable input after bot responds
            setIsProcessing(false);
            
            // Check if this is a session ready for confirmation
            if (data.status === 'session_confirming') {
              console.log("Session ready for confirmation");
              setCurrentPhase('idle');
            } else if (data.status === 'session_confirmed') {
              console.log("Session confirmed, executing actions");
              // Don't show loading until actual WordPress update
              setCurrentPhase('updating');
            } else {
              console.log("Response complete");
              setCurrentPhase('idle');
            }
            break;

          case 'actionProgress':
            // Handle structured action progress messages
            if (data.message) {
              // These messages already have icons and formatting
              addProgress(data.message);
              
              // Handle different statuses
              if (data.status === 'started') {
                // Action just started
                if (!isProcessing) {
                  setIsProcessing(true);
                  // Don't show loading for conversation
                  setCurrentPhase('updating');
                }
              } else if (data.status === 'action_completed') {
                // Individual action completed, just show progress
                console.log("Action completed:", data.message);
                // Don't stop processing - keep going
              } else if (data.status === 'all_completed' && data.isFinal) {
                // All actions completed by UpdateState
                console.log("All actions completed - execution finished");
                setIsProcessing(false);
                setCurrentPhase('idle');
                // The backend will trigger the update
                setTimeout(() => {
                  triggerPageUpdate(false); // Show confirmation
                }, 500);
              }
            }
            break;
            
          case 'progressUpdate':
            if (data.message && !data.message.includes('Stream started')) {
              // Simply add the message without any icons
              addProgress(data.message);
            }
            // Check if we're starting to process actions
            if (data.status === 'processing' && data.message && data.message.includes('Processing')) {
              // Don't show loading during processing
              setCurrentPhase('updating');
            }
            if (data.isFinal) {
              setIsBotTyping(false);
              // Don't move message to chat history here - let streamEnd handle it
              // This prevents duplicate messages and clearing issues
              
              // IMPORTANT: Set isProcessing to false for ALL cases except when actions are completed
              // This ensures the chat input is re-enabled immediately after bot responds
              
              // Check the status to determine if we should trigger page update
              // Only trigger if status is 'completed' (actions were performed)
              // Don't trigger for 'no_actions', 'error', or other statuses
              if (data.status === 'completed') {
                // Actions were completed, trigger WordPress update
                // Loading will be shown when handleUpdateConfirmation starts
                // Keep isProcessing true here since we're actually updating
                setTimeout(() => {
                  console.log("Actions completed, triggering page update with preview ID:", previewId);
                  triggerPageUpdate(false); // Show confirmation first
                }, 100);
              } else if (data.status === 'no_actions') {
                // No actions needed, just conversational response
                console.log("No actions performed, conversation only");
                setIsProcessing(false);  // Re-enable input immediately
                setCurrentPhase('idle');
              } else if (data.status === 'awaiting_confirmation' || data.status === 'awaiting_selection') {
                // Waiting for user confirmation or selection
                console.log("Awaiting user confirmation/selection");
                setIsProcessing(false);  // Re-enable input immediately
                setCurrentPhase('idle');  // Reset to idle so user can respond
              } else {
                // Other status (error, etc.)
                console.log(`Final status: ${data.status}, not triggering update`);
                setIsProcessing(false);  // Re-enable input immediately
                setCurrentPhase('idle');
              }
            }
            break;
            
          case 'state_updated':
            addProgress(`State updated on backend`);
            break;

          case 'session_summary':
            // Handle session summary with confirmation key
            console.log('Received session summary with confirmation key:', data.confirmation_key);
            if (data.confirmation_key) {
              setSessionConfirmationKey(data.confirmation_key);
            }
            setIsProcessing(false);
            setCurrentPhase('idle');
            addProgress(`Session ready for confirmation`);
            break;
            
          case 'session_confirmed':
            // Handle session confirmation result
            console.log('Session confirmed, executing actions');
            addProgress(`Session confirmed - executing website setup...`);
            // Don't show loading until WordPress update
            setCurrentPhase('updating');
            setSessionConfirmationKey(null); // Clear the key after use
            break;
            
          case 'session_cancelled':
            // Handle session cancellation
            console.log('Session cancelled or revised');
            addProgress(`Continuing conversation...`);
            setSessionConfirmationKey(null);
            setIsProcessing(false);
            setCurrentPhase('idle');
            break;

          default:
            console.log('Received message:', data.type);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }, [previewIdInput, initiatePreview, triggerPageUpdate, previewId, isProcessing]);

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

    const userInputLower = userInput.toLowerCase().trim();
    let messageContent = userInput;
    
    console.log('Current session confirmation key:', sessionConfirmationKey);
    console.log('User input:', userInputLower);
    
    // Check if this is a session confirmation response
    if (sessionConfirmationKey) {
      // Check if user is confirming with 'confirm', the confirmation key, or similar
      const isConfirmation = userInputLower === 'confirm' || 
                           userInputLower === 'yes' || 
                           userInputLower === 'proceed' ||
                           userInputLower.includes(sessionConfirmationKey.toLowerCase());
      
      const isRejection = userInputLower === 'no' || 
                         userInputLower === 'cancel' || 
                         userInputLower === 'change' ||
                         userInputLower === 'edit' ||
                         userInputLower === 'revise';
      
      if (isConfirmation || isRejection) {
        // The autonomous system will handle the confirmation naturally
        // Just clear the key if it was used
        if (userInputLower.includes(sessionConfirmationKey.toLowerCase())) {
          console.log('User confirmed with session key');
          setSessionConfirmationKey(null);
        }
      }
    }

    // Clear progress and task state for new request
    setProgressUpdates([]);
    setCurrentTaskId(null);
    setTaskStatus(null);
    
    const currentPreviewId = previewIdRef.current || previewId;
    
    const messagePayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: currentPreviewId,
      content: messageContent,
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
    // setUpdateResult(null); // Clear any previous update results
    // Don't set preview loading here - only when actual updates happen
    addProgress(`Processing user query...`);
  };

  // Simplified handlers for autonomous system - no widget/TODO confirmations needed

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
            <button 
              onClick={() => setShowDataKeyManager(!showDataKeyManager)} 
              className="data-key-btn"
              title="Data Key Manager"
            >
              Data Key Manager
            </button>
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
        <div className="left-panel">
          <div className="chat-section">
            <div className="chat-header">
              <h2>Chat Assistant</h2>
              <span className={`phase-indicator phase-${currentPhase}`}>
                {currentPhase === 'idle' && 'Ready'}
                {currentPhase === 'initiating' && 'Initiating...'}
                {currentPhase === 'chatting' && 'Processing...'}
                {currentPhase === 'updating' && 'Updating WordPress...'}
                {currentPhase === 'complete' && 'Complete'}
              </span>
            </div>
          
          <div className="chat-messages">
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

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={sessionConfirmationKey 
                  ? `Type 'confirm' or '${sessionConfirmationKey}' to proceed, or describe changes...`
                  : "Type your message..."}
                disabled={!isConnected || isBotTyping || isProcessing}
                className="chat-input"
                rows="1"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!isConnected || isBotTyping || isProcessing || !userInput.trim()}
                className="send-btn"
              >
                {isProcessing ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
          
            {sessionConfirmationKey && (
              <div className="session-confirmation-hint">
                <span>Session ready! Type <strong>'confirm'</strong> or <strong>{sessionConfirmationKey}</strong> to proceed, or continue chatting to make changes.</span>
              </div>
            )}
          </div>

          <div className="progress-section">
            <div className="progress-header">
              <h2>Process Log</h2>
            </div>
            <div className="progress-content">
              {progressUpdates.map((update, index) => {
                // Determine message type based on content
                let messageClass = "progress-item";
                if (update.message.includes("successfully") || update.message.includes("completed")) messageClass += " success";
                else if (update.message.includes("error") || update.message.includes("failed")) messageClass += " error";
                else if (update.message.includes("warning")) messageClass += " warning";
                else if (update.message.includes("updating") || update.message.includes("processing") || 
                         update.message.includes("initiating") || update.message.includes("creating") || 
                         update.message.includes("connecting") || update.message.includes("queued")) messageClass += " info";
                
                return (
                  <div key={index} className={messageClass}>
                    <span className="timestamp">{update.time}</span>
                    <span className="message">{update.message}</span>
                  </div>
                );
              })}
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
                    // Force iframe refresh without loading overlay
                    setShowPreview(false);
                    setTimeout(() => {
                      setShowPreview(true);
                    }, 100);
                  }}
                  className="refresh-btn"
                  title="Refresh preview"
                >
                  Refresh
                </button>
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="open-external"
                >
                  Open in New Tab
                </a>
              </div>
            )}
          </div>
          
          <div className="preview-container">
            
            {isUpdatingPage && (
              <div className="preview-loading">
                <div className="loading-spinner"></div>
                <p>Updating WordPress...</p>
                <small>Pushing changes to your website</small>
                {currentTaskId && taskStatus && (
                  <div className="task-status">
                    <small>Task ID: {currentTaskId}</small>
                    <div className={`status-badge status-${taskStatus}`}>
                      {taskStatus === 'queued' && 'Queued'}
                      {taskStatus === 'processing' && 'Processing'}
                      {taskStatus === 'completed' && 'Completed'}
                      {taskStatus === 'failed' && 'Failed'}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <iframe
              key={showPreview ? Date.now() : 'static'} // Force refresh when showPreview changes
              src={previewUrl || WORDPRESS_SITE_URL}
              title="Website Preview"
              className="preview-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>

          {/* Update result popup removed - now shows in progress log only */}
        </div>
      </div>

      {/* Confirmation Dialog removed - autonomous system handles confirmations in chat */}
      
      {/* WordPress Update Confirmation Dialog */}
      {showWordPressUpdateConfirm && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Push to WordPress?</h3>
            <p>Do you want to push these changes to your WordPress site?</p>
            <p className="preview-id-display">Preview ID: {pendingPreviewId}</p>
            <div className="confirmation-buttons">
              <button 
                className="confirm-btn"
                onClick={() => {
                  setShowWordPressUpdateConfirm(false);
                  triggerPageUpdate(true); // Skip confirmation this time
                }}
              >
                Yes, Update WordPress
              </button>
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowWordPressUpdateConfirm(false);
                  setPendingPreviewId(null);
                  setIsUpdatingPage(false);
                  setCurrentPhase('idle');
                  setIsProcessing(false);
                  addProgress('WordPress update cancelled by user');
                }}
              >
                No, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Key Manager Modal */}
      {showDataKeyManager && (
        <div className="data-key-manager-overlay">
          <div className="data-key-manager-modal">
            <div className="data-key-manager-header">
              <h2>Data Key Manager</h2>
              <button 
                onClick={() => setShowDataKeyManager(false)}
                className="close-data-key-manager"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="data-key-manager-content">
              <DataKeyManager 
                apiEndpoint={dataKeyApiEndpoint}
                previewId={previewId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppNew;