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
  const triggerPageUpdate = useCallback(async () => {
      console.log("Starting page update process...");
      setIsUpdatingPage(true);
      setUpdateResult(null);
      setProgressUpdates(prev => [...prev, `Finalizing... sending update request to WordPress ${contentType}.`]);

      const payload = {
          preview_id: previewId,
          page_slug: pageSlug,  // Keep for backwards compatibility
          content_slug: pageSlug,  // New parameter name
          content_type: contentType  // 'page' or 'post'
      };

      try {
          const response = await fetch(PAGE_UPDATE_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const resultData = await response.json();

          if (!response.ok) {
              // Handle HTTP errors like 500, 400 etc.
              throw new Error(resultData.error || `Server responded with ${response.status}`);
          }
          
          // On success, store the successful result
          setUpdateResult({ success: true, data: resultData });

      } catch (error) {
          console.error('Failed to update page:', error);
          // On failure, store the error message
          setUpdateResult({ success: false, message: error.message });
      } finally {
          setIsUpdatingPage(false);
      }
  }, [previewId, pageSlug, contentType]);

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

    console.log(`Connecting to ${WEBSOCKET_API_URL}...`);
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
    };

    websocket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setConnectionStatus('Connection Error');
      setIsBotTyping(false);
      setIsUpdatingPage(false); // NEW: Ensure loading state is off on error
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
    if (!userInput.trim() || !isConnected || isBotTyping) return;

    const messagePayload = {
      action: 'sendMessage',
      projectId: TEST_PROJECT_ID,
      previewId: previewId,
      content: userInput,
    };

    console.log('Sending message:', messagePayload);
    websocket.current.send(JSON.stringify(messagePayload));

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
        <h1>SCAI Chat & Page/Post Update Interface</h1>
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
              disabled={isBotTyping}
            />
            <button type="submit" disabled={isBotTyping}>Send</button>
          </form>

          <div className="progress-area">
            <h3>Backend Process Log</h3>
            <ul>
              {progressUpdates.map((update, index) => (
                <li key={index}>{update}</li>
              ))}
            </ul>
          </div>
          
          {/* NEW: Final Result Display Area */}
          <div className="update-result-area">
              {isUpdatingPage && <p>Updating WordPress page, please wait...</p>}
              {updateResult && updateResult.success && (
                <div className="success">
                  <p>{updateResult.data.message}</p>
                  <p>
                    View your updated {contentType} here: {' '}
                    <a href={updateResult.data.updated_page_url} target="_blank" rel="noopener noreferrer">
                      {updateResult.data.updated_page_url}
                    </a>
                  </p>
                </div>
              )}
              {updateResult && !updateResult.success && (
                  <div className="error">
                      <p><strong>Page update failed:</strong> {updateResult.message}</p>
                  </div>
              )}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;