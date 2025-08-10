import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

// --- CONFIGURATION ---
// WebSocket API for the chat/progress
const WEBSOCKET_API_URL = process.env.REACT_APP_WEBSOCKET_URL || 'wss://x78a3l7kod.execute-api.us-east-1.amazonaws.com/prod';
// NEW: HTTP API for the final page update action
const PAGE_UPDATE_API_URL = process.env.REACT_APP_PAGE_UPDATE_URL || 'https://yapgos1vs8.execute-api.us-east-1.amazonaws.com/prod/update-page';
// The hardcoded Project ID from your script
const TEST_PROJECT_ID = "Taofeek";
// --- END CONFIGURATION ---

function App() {
  const [previewId, setPreviewId] = useState('');
  // NEW: State for the page/post slug input
  const [pageSlug, setPageSlug] = useState('');
  // NEW: State for content type selection
  const [contentType, setContentType] = useState('page');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  
  // NEW: State for handling the final page update process
  const [isUpdatingPage, setIsUpdatingPage] = useState(false);
  const [updateResult, setUpdateResult] = useState(null); // Will hold { message, updated_page_url } or an error
  const [isProcessing, setIsProcessing] = useState(false); // Track overall process state

  const websocket = useRef(null);

  // This effect handles the cleanup of the websocket connection
  useEffect(() => {
    return () => {
      if (websocket.current) {
        console.log("Component unmounting. Closing WebSocket.");
        websocket.current.close();
      }
    };
  }, []);
  
  // NEW: Function to handle the final POST request to update the page
  // Defined before handleConnect to avoid dependency issues
  const pollTaskStatus = useCallback(async (taskId) => {
      console.log(`Polling status for task: ${taskId}`);
      // Construct the status URL properly
      const baseUrl = PAGE_UPDATE_API_URL.endsWith('/update-page') 
          ? PAGE_UPDATE_API_URL.slice(0, -12) // Remove '/update-page'
          : PAGE_UPDATE_API_URL;
      const statusUrl = `${baseUrl}/task/${taskId}`;
      console.log('Status URL:', statusUrl);
      
      const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
      let attempts = 0;
      let previousProgressCount = 0;
      
      const pollInterval = setInterval(async () => {
          attempts++;
          
          try {
              const response = await fetch(statusUrl, {
                  method: 'GET',
                  headers: { 
                      'Accept': 'application/json'
                  }
              });
              
              if (response.ok) {
                  const taskData = await response.json();
                  console.log('Task status:', taskData);
                  
                  // Update progress messages - only add new ones
                  if (taskData.progress && taskData.progress.length > previousProgressCount) {
                      const newMessages = taskData.progress.slice(previousProgressCount);
                      newMessages.forEach(progressItem => {
                          setProgressUpdates(prev => [...prev, `${progressItem.message}`]);
                      });
                      previousProgressCount = taskData.progress.length;
                  }
                  
                  // Check if task is complete
                  if (taskData.status === 'completed') {
                      clearInterval(pollInterval);
                      setIsUpdatingPage(false);
                      setIsProcessing(false);
                      
                      if (taskData.result) {
                          setUpdateResult({ success: true, data: taskData.result });
                          setProgressUpdates(prev => [...prev, `✅ ${taskData.result.message || 'Update completed successfully'}`]);
                          
                          // Log the final URL for debugging
                          if (taskData.result.updated_page_url) {
                              console.log('Final URL:', taskData.result.updated_page_url);
                          }
                      }
                  } else if (taskData.status === 'failed') {
                      clearInterval(pollInterval);
                      setIsUpdatingPage(false);
                      setIsProcessing(false);
                      
                      setUpdateResult({ 
                          success: false, 
                          message: taskData.error || 'Update failed'
                      });
                      setProgressUpdates(prev => [...prev, `❌ Error: ${taskData.error || 'Update failed'}`]);
                  }
              } else {
                  console.error('Failed to get task status:', response.status, response.statusText);
                  if (response.status === 404) {
                      setProgressUpdates(prev => [...prev, '⚠️ Task not found. It may have expired.']);
                      clearInterval(pollInterval);
                      setIsUpdatingPage(false);
                      setIsProcessing(false);
                  }
              }
          } catch (error) {
              console.error('Error polling task status:', error);
              // Continue polling on network errors
          }
          
          // Stop polling after max attempts
          if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setIsUpdatingPage(false);
              setIsProcessing(false);
              setUpdateResult({ 
                  success: false, 
                  message: 'Update timed out. Please check WordPress directly.'
              });
              setProgressUpdates(prev => [...prev, '⏱️ Update timed out after 5 minutes']);
          }
      }, 5000); // Poll every 5 seconds
  }, []);

  const triggerPageUpdate = useCallback(async () => {
      console.log("Starting page update process...");
      setIsUpdatingPage(true);
      setUpdateResult(null);
      setProgressUpdates(prev => [...prev, `Initiating WordPress ${contentType} update...`]);

      const payload = {
          preview_id: previewId,
          page_slug: pageSlug,  // Keep for backwards compatibility
          content_slug: pageSlug,  // New parameter name
          content_type: contentType  // 'page' or 'post'
      };

      try {
          console.log('API URL:', PAGE_UPDATE_API_URL);
          console.log('Sending update request with payload:', payload);
          
          // Try OPTIONS first to check CORS
          try {
              const optionsResponse = await fetch(PAGE_UPDATE_API_URL, {
                  method: 'OPTIONS',
                  headers: {
                      'Origin': window.location.origin,
                      'Access-Control-Request-Method': 'POST',
                      'Access-Control-Request-Headers': 'Content-Type'
                  }
              });
              console.log('OPTIONS response:', optionsResponse.status, optionsResponse.statusText);
          } catch (optionsError) {
              console.warn('OPTIONS request failed (this is normal if CORS is handled by browser):', optionsError);
          }
          
          const response = await fetch(PAGE_UPDATE_API_URL, {
              method: 'POST',
              mode: 'cors', // Explicitly set CORS mode
              credentials: 'omit', // Don't send cookies
              headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
              },
              body: JSON.stringify(payload)
          });

          console.log('Response status:', response.status);
          console.log('Response headers:', response.headers);
          
          let resultData;
          try {
              resultData = await response.json();
              console.log('Response data:', resultData);
          } catch (jsonError) {
              console.error('Failed to parse response as JSON:', jsonError);
              throw new Error('Invalid response format from server');
          }

          if (!response.ok) {
              // Handle HTTP errors like 500, 400 etc.
              throw new Error(resultData.error || `Server responded with ${response.status}`);
          }
          
          // Check if this is an async task response
          if (response.status === 202 && resultData.taskId) {
              // Task queued successfully, start polling
              setProgressUpdates(prev => [...prev, 
                  `✅ Update task created: ${resultData.taskId}`,
                  'Processing update in background...'
              ]);
              
              // Start polling for task status
              pollTaskStatus(resultData.taskId);
          } else {
              // Legacy synchronous response (shouldn't happen with new architecture)
              setUpdateResult({ success: true, data: resultData });
              setIsProcessing(false);
              setProgressUpdates(prev => [...prev, `✅ WordPress ${contentType} updated successfully!`]);
          }

      } catch (error) {
          console.error('Failed to update page:', error);
          
          // Check if it's a CORS error
          if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
              console.warn('CORS error detected. The update might have succeeded on the server.');
              // Try to show a partial success message
              setUpdateResult({ 
                  success: false, 
                  message: 'Unable to confirm update due to CORS. The update may have completed successfully. Please check your WordPress site.' 
              });
              setProgressUpdates(prev => [...prev, 
                  `⚠️ CORS error - unable to confirm update status.`,
                  `The WordPress update may have completed successfully.`,
                  `Please check your WordPress site directly.`
              ]);
          } else {
              // Other errors
              setUpdateResult({ success: false, message: error.message });
              setProgressUpdates(prev => [...prev, `❌ Error: ${error.message}`]);
          }
          
          setIsProcessing(false); // Process complete even on error
      } finally {
          setIsUpdatingPage(false);
      }
  }, [previewId, pageSlug, contentType, pollTaskStatus]);

  const handleConnect = useCallback(() => {
    // NEW: Validate both Preview ID and Content Slug
    if (!previewId || !pageSlug) {
      alert(`Please enter both a Preview ID and a ${contentType === 'post' ? 'Post' : 'Page'} Slug.`);
      return;
    }
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      console.log('Already connected.');
      return;
    }

    console.log(`Connecting to  the ${WEBSOCKET_API_URL}...`);
    setConnectionStatus(`Connecting...`);
    
    websocket.current = new WebSocket(WEBSOCKET_API_URL);

    websocket.current.onopen = () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
      setConnectionStatus(`Connected with Preview ID: ${previewId}`);
      // NEW: Reset all state for a clean run
      setChatMessages([]);
      setProgressUpdates([]);
      setUpdateResult(null);
      setIsUpdatingPage(false);
    };

    websocket.current.onclose = () => {
      console.log('WebSocket connection closed.');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setIsBotTyping(false);
      setIsUpdatingPage(false); // NEW: Ensure loading state is off on disconnect
      setIsProcessing(false); // Reset processing state
    };

    websocket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setConnectionStatus('Connection Error');
      setIsBotTyping(false);
      setIsUpdatingPage(false); // NEW: Ensure loading state is off on error
      setIsProcessing(false); // Reset processing state
    };

    websocket.current.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'streamChunk':
            setIsBotTyping(true);
            // Parse the nested JSON in the message field
            let chunkContent = '';
            try {
              if (data.message) {
                const messageData = JSON.parse(data.message);
                if (messageData.type === 'delta' && messageData.content) {
                  chunkContent = messageData.content;
                }
              } else if (data.data?.content) {
                // Fallback to old format if it exists
                chunkContent = data.data.content;
              }
            } catch (parseError) {
              console.error('Failed to parse streamChunk message:', parseError);
              // If parsing fails, try to use the raw message
              chunkContent = data.message || data.data?.content || '';
            }
            
            setChatMessages(prevMessages => {
              const newMessages = [...prevMessages];
              if (newMessages.length > 0 && chunkContent) {
                newMessages[newMessages.length - 1].text += chunkContent;
              }
              return newMessages;
            });
            break;

          case 'progressUpdate':
            const progressMessage = `Progress: ${data.status} - ${data.message}`;
            setProgressUpdates(prev => [...prev, progressMessage]);
            if (data.isFinal) {
              console.log('Received final progress update. Bot is done typing.');
              setIsBotTyping(false);
              // NEW: Trigger the final page update POST request
              triggerPageUpdate();
            }
            break;
            
          case 'state_updated':
            setProgressUpdates(prev => [...prev, `BROADCAST: State was updated on the backend.`]);
            break;
          
          case 'previewInitiated':
             console.log("Received 'previewInitiated' message, ignoring in this UI.", data);
             break;

          default:
            console.warn('Received unknown message type:', data.type);
        }
      } catch (e) {
        console.error('Failed to parse incoming message as JSON:', event.data);
      }
    };
  // NEW: Add pageSlug, contentType, and triggerPageUpdate to dependency array
  }, [previewId, pageSlug, contentType, triggerPageUpdate]);


  const handleDisconnect = () => {
    if (websocket.current) {
      console.log("Disconnecting...");
      websocket.current.close();
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!userInput.trim() || !isConnected || isBotTyping || isProcessing) return;

    const messagePayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: previewId,
      content: userInput,
    };

    console.log('Sending message:', messagePayload);
    websocket.current.send(JSON.stringify(messagePayload));

    // Clear ALL previous state for new request
    setProgressUpdates([]);
    setUpdateResult(null);
    setIsUpdatingPage(false);
    setIsProcessing(true); // Start processing
    
    setChatMessages(prev => [
      ...prev,
      { sender: 'user', text: userInput },
      { sender: 'bot', text: '' }
    ]);
    
    setUserInput('');
    setIsBotTyping(true);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>SCAI QA Chat & Page/Post Update Interface</h1>
        <div className="connection-area">
          <input
            type="text"
            value={previewId}
            onChange={(e) => setPreviewId(e.target.value)}
            placeholder="Enter Preview ID"
            disabled={isConnected}
          />
          {/* NEW: Content Type Selector */}
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            disabled={isConnected}
            style={{padding: '10px', fontSize: '14px'}}
          >
            <option value="page">Page</option>
            <option value="post">Post</option>
          </select>
          {/* NEW: Content Slug Input */}
          <input
            type="text"
            value={pageSlug}
            onChange={(e) => setPageSlug(e.target.value)}
            placeholder={`Enter ${contentType === 'post' ? 'Post' : 'Page'} Slug`}
            disabled={isConnected}
          />
          {!isConnected ? (
            <button onClick={handleConnect}>Connect & Generate</button>
          ) : (
            <button onClick={handleDisconnect} className="disconnect-btn">Disconnect</button>
          )}
        </div>
        <p className={`status ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
          {connectionStatus}
        </p>
      </header>

      {isConnected && (
        <main className="chat-container">
          <div className="chat-window">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <p>{msg.text}</p>
              </div>
            ))}
            {isBotTyping && <div className="typing-indicator"><span></span><span></span><span></span></div>}
          </div>
          
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isBotTyping || isProcessing}
            />
            <button type="submit" disabled={isBotTyping || isProcessing}>
              {isProcessing ? 'Processing...' : 'Send'}
            </button>
          </form>

          <div className="progress-area">
            <h3>
              Backend Process Log 
              {isProcessing && <span style={{fontSize: '14px', marginLeft: '10px'}}>🔄 Active</span>}
            </h3>
            <ul>
              {progressUpdates.map((update, index) => (
                <li key={index}>{update}</li>
              ))}
            </ul>
          </div>
          
          {/* NEW: Final Result Display Area */}
          <div className="update-result-area">
              {isProcessing && !updateResult && (
                <div className="loading">
                  <p>⏳ Processing your request...</p>
                  {isUpdatingPage && <p>Updating WordPress {contentType}...</p>}
                  <div className="progress-spinner">
                    <div className="spinner"></div>
                    <span>Checking task status every 5 seconds...</span>
                  </div>
                </div>
              )}
              {updateResult && updateResult.success && updateResult.data && (
                <div className="success">
                  <h3>🎉 Update Completed Successfully!</h3>
                  <p>{updateResult.data.message || `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} updated successfully`}</p>
                  {updateResult.data.updated_page_url && (
                    <div className="final-url">
                      <p><strong>Your updated {contentType} is live at:</strong></p>
                      <a 
                        href={updateResult.data.updated_page_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="url-link"
                      >
                        {updateResult.data.updated_page_url}
                      </a>
                      <button 
                        onClick={() => window.open(updateResult.data.updated_page_url, '_blank')}
                        className="view-button"
                      >
                        View {contentType.charAt(0).toUpperCase() + contentType.slice(1)} →
                      </button>
                    </div>
                  )}
                </div>
              )}
              {updateResult && !updateResult.success && (
                  <div className="error">
                      <h3>❌ Update Failed</h3>
                      <p>{updateResult.message}</p>
                      <p className="error-help">Please check your WordPress admin panel or try again.</p>
                  </div>
              )}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;