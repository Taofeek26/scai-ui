import React, { useState, useEffect } from 'react';
import './DataKeyManager.css';

const DataKeyManager = ({ apiEndpoint, previewId }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scanResults, setScanResults] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResult, setOperationResult] = useState(null);
  const [progressMessage, setProgressMessage] = useState(null);
  const [lastScan, setLastScan] = useState('Never');
  const [operations, setOperations] = useState([]);
  const [debugMode] = useState(true); // Enable debug mode
  const [, setCurrentTaskId] = useState(null);
  const [settings, setSettings] = useState({
    apiEndpoint: apiEndpoint || 'https://yapgos1vs8.execute-api.us-east-1.amazonaws.com/prod',
    autoScan: false,
    backupEnabled: true
  });

  // Fetch operations history
  useEffect(() => {
    fetchOperations();
  }, []);
  
  // Create a global function for scanning current page
  useEffect(() => {
    // Function to scan current page for data-keys
    const scanCurrentPage = () => {
      const results = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        dataKeys: [],
        summary: {
          total: 0,
          byType: {},
          unique: new Set()
        }
      };
      
      // Find all elements with data-key attributes
      const elements = document.querySelectorAll('[data-key]');
      
      elements.forEach((element, index) => {
        const dataKey = element.getAttribute('data-key');
        const tagName = element.tagName.toLowerCase();
        const classList = Array.from(element.classList).join(' ');
        const id = element.id || '';
        const text = element.textContent?.substring(0, 50) || '';
        const parent = element.parentElement?.tagName.toLowerCase() || 'none';
        
        // Get element's position and visibility
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         window.getComputedStyle(element).display !== 'none';
        
        const keyInfo = {
          index: index + 1,
          dataKey: dataKey,
          element: tagName,
          id: id,
          class: classList,
          parent: parent,
          text: text.trim(),
          visible: isVisible,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          xpath: getXPath(element)
        };
        
        results.dataKeys.push(keyInfo);
        results.summary.unique.add(dataKey);
        
        // Count by element type
        if (!results.summary.byType[tagName]) {
          results.summary.byType[tagName] = 0;
        }
        results.summary.byType[tagName]++;
      });
      
      results.summary.total = results.dataKeys.length;
      results.summary.uniqueCount = results.summary.unique.size;
      results.summary.unique = Array.from(results.summary.unique);
      
      // Helper function to get XPath
      function getXPath(element) {
        if (element.id !== '') {
          return `//*[@id="${element.id}"]`;
        }
        if (element === document.body) {
          return '/html/body';
        }
        let ix = 0;
        const siblings = element.parentNode.childNodes;
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
          }
          if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
          }
        }
      }
      
      // Display results in console with styling
      console.log('%c🔍 Data-Key Scanner Results', 'font-size: 16px; font-weight: bold; color: #2271b1;');
      console.log('%c' + '='.repeat(50), 'color: #2271b1;');
      console.log('%c📄 Page:', 'font-weight: bold;', results.url);
      console.log('%c📊 Summary:', 'font-weight: bold; color: #28a745;');
      console.log(`  • Total data-keys found: ${results.summary.total}`);
      console.log(`  • Unique data-keys: ${results.summary.uniqueCount}`);
      console.log(`  • Visible elements: ${results.dataKeys.filter(k => k.visible).length}`);
      console.log(`  • Hidden elements: ${results.dataKeys.filter(k => !k.visible).length}`);
      
      console.log('%c📈 By Element Type:', 'font-weight: bold; color: #28a745;');
      Object.entries(results.summary.byType).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count}`);
      });
      
      console.log('%c📋 Detailed Results:', 'font-weight: bold; color: #28a745;');
      console.table(results.dataKeys.map(k => ({
        'Data-Key': k.dataKey,
        'Element': k.element,
        'ID': k.id || '-',
        'Class': k.class || '-',
        'Visible': k.visible ? '✅' : '❌',
        'Text': k.text || '-'
      })));
      
      console.log('%c💡 Tips:', 'font-weight: bold; color: #ffc107;');
      console.log('  • Copy results: copy(scanPageDataKeys.getResults())');
      console.log('  • Export as JSON: scanPageDataKeys.export()');
      console.log('  • Filter visible only: scanPageDataKeys.scan(true)');
      console.log('  • Highlight elements: scanPageDataKeys.highlight()');
      
      return results;
    };
    
    // Create the global scanner object
    const scanner = {
      scan: (visibleOnly = false) => {
        const results = scanCurrentPage();
        if (visibleOnly) {
          results.dataKeys = results.dataKeys.filter(k => k.visible);
          results.summary.total = results.dataKeys.length;
          console.log('%c🔍 Filtered to visible elements only', 'color: #17a2b8;');
        }
        return results;
      },
      
      getResults: () => {
        return scanCurrentPage();
      },
      
      export: () => {
        const results = scanCurrentPage();
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datakeys-scan-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('%c✅ Results exported as JSON', 'color: #28a745;');
      },
      
      highlight: () => {
        // Remove any existing highlights
        document.querySelectorAll('.dkm-highlight').forEach(el => {
          el.classList.remove('dkm-highlight');
        });
        
        // Add highlight class
        const elements = document.querySelectorAll('[data-key]');
        elements.forEach(el => {
          el.classList.add('dkm-highlight');
        });
        
        // Add styles if not already present
        if (!document.getElementById('dkm-highlight-styles')) {
          const style = document.createElement('style');
          style.id = 'dkm-highlight-styles';
          style.textContent = `
            .dkm-highlight {
              outline: 2px solid #ff6b6b !important;
              outline-offset: 2px !important;
              background-color: rgba(255, 107, 107, 0.1) !important;
              position: relative !important;
            }
            .dkm-highlight::after {
              content: attr(data-key) !important;
              position: absolute !important;
              top: -20px !important;
              left: 0 !important;
              background: #ff6b6b !important;
              color: white !important;
              padding: 2px 6px !important;
              border-radius: 3px !important;
              font-size: 11px !important;
              font-weight: bold !important;
              z-index: 10000 !important;
              white-space: nowrap !important;
            }
          `;
          document.head.appendChild(style);
        }
        
        console.log(`%c✨ Highlighted ${elements.length} elements with data-keys`, 'color: #28a745;');
        console.log('%c💡 To remove highlights, refresh the page or run: document.querySelectorAll(".dkm-highlight").forEach(el => el.classList.remove("dkm-highlight"))', 'color: #ffc107;');
      },
      
      help: () => {
        console.log('%c📖 Data-Key Scanner Help', 'font-size: 16px; font-weight: bold; color: #2271b1;');
        console.log('%cAvailable Commands:', 'font-weight: bold; margin-top: 10px;');
        console.log('  scanPageDataKeys.scan()         - Scan current page for all data-keys');
        console.log('  scanPageDataKeys.scan(true)     - Scan only visible elements');
        console.log('  scanPageDataKeys.getResults()   - Get last scan results as object');
        console.log('  scanPageDataKeys.export()       - Download results as JSON file');
        console.log('  scanPageDataKeys.highlight()    - Highlight all elements with data-keys');
        console.log('  scanPageDataKeys.help()         - Show this help message');
      }
    };
    
    // Make it globally available
    window.scanPageDataKeys = scanner;
    
    // Log availability
    console.log('%c✅ Data-Key Scanner Ready!', 'font-size: 14px; font-weight: bold; color: #28a745;');
    console.log('Type %cscanPageDataKeys.scan()%c to scan this page for data-keys', 'font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 3px;', '');
    console.log('Type %cscanPageDataKeys.help()%c for more options', 'font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 3px;', '');
    
    // Cleanup on unmount
    return () => {
      delete window.scanPageDataKeys;
    };
  }, []);

  const fetchOperations = async () => {
    try {
      // This would connect to your backend to fetch operations history
      // For now, using mock data
      setOperations([
        { id: 1, operation: 'scan', status: 'completed', timestamp: new Date().toISOString(), result: '15 data-keys found' },
        { id: 2, operation: 'strip', status: 'completed', timestamp: new Date().toISOString(), result: 'Removed from 10 elements' }
      ]);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };


  // Check task status for async operations
  const checkTaskStatus = async (taskId) => {
    try {
      const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
      const statusEndpoint = `${baseEndpoint}data-keys/task/${taskId}`;
      
      if (debugMode) {
        console.log('Debug - Status check endpoint:', statusEndpoint);
      }
      
      const response = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error checking task status:', error);
      return null;
    }
  };

  // Scan for data-keys
  const handleScan = async () => {
    setIsScanning(true);
    setOperationResult(null);
    
    // Check if API endpoint is configured
    if (!settings.apiEndpoint || settings.apiEndpoint === '') {
      setOperationResult({
        type: 'warning',
        message: 'Please configure the API endpoint in Settings first.'
      });
      setIsScanning(false);
      setActiveTab('settings');
      return;
    }

    try {
      // Check if using demo mode (no real endpoint)
      const isDemoMode = !settings.apiEndpoint || settings.apiEndpoint === '';
      
      if (isDemoMode) {
        // Mock scan for demonstration
        const mockData = {
          totalKeys: 15,
          pagesScanned: 3,
          uniqueKeys: 8,
          elements: [
            { selector: '#header-title', dataKey: 'header-main-title', page: 'homepage', status: 'active' },
            { selector: '.hero-subtitle', dataKey: 'hero-description', page: 'homepage', status: 'active' },
            { selector: '#about-content', dataKey: 'about-text', page: 'about', status: 'active' },
            { selector: '.contact-form', dataKey: 'contact-form-wrapper', page: 'contact', status: 'active' },
            { selector: '#footer-copyright', dataKey: 'footer-text', page: 'global', status: 'active' }
          ]
        };
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setScanResults(mockData);
        setLastScan(new Date().toLocaleString());
        setOperationResult({
          type: 'success',
          message: `Scan completed (Demo Mode). Found ${mockData.totalKeys} data-key attributes.`
        });
        
        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'scan',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: `${mockData.totalKeys} data-keys found (Demo)`
        };
        setOperations([newOp, ...operations]);
      } else {
        // Actual API call - matching WordPress plugin structure
        // Ensure endpoint has trailing slash like WordPress plugin
        const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
        const scanEndpoint = `${baseEndpoint}data-keys/scan`;
        
        if (debugMode) {
          console.log('Debug - Base endpoint:', baseEndpoint);
          console.log('Debug - Scan endpoint:', scanEndpoint);
          console.log('Debug - Request body:', {
            operation: 'scan',
            site_url: window.location.origin,
            async: true
          });
        }
        
        const response = await fetch(scanEndpoint, {
          method: 'POST',
          mode: 'cors', // Enable CORS
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            operation: 'scan',
            site_url: window.location.origin,
            async: true  // Request async processing
          })
        });
        
        if (debugMode) {
          console.log('Debug - Response status:', response.status);
          console.log('Debug - Response headers:', response.headers);
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        // Check if response contains a task ID (async operation)
        if (data.taskId) {
          setCurrentTaskId(data.taskId);
          setProgressMessage({
            type: 'info',
            status: 'queued',
            message: 'Operation Started',
            taskId: data.taskId,
            progress: 5
          });
          
          // Poll for task completion
          let taskComplete = false;
          let attempts = 0;
          const maxAttempts = 60; // 15 minutes timeout (60 * 15 seconds)
          const pollInterval = 15000; // 15 second intervals
          
          while (!taskComplete && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            try {
              const taskStatus = await checkTaskStatus(data.taskId);
              console.log(`Task status check ${attempts + 1}:`, taskStatus);
              
              if (taskStatus) {
                // Calculate progress percentage
                const progress = Math.min(95, Math.floor((attempts / maxAttempts) * 100));
                
                // Update progress message based on status
                const statusText = taskStatus.status || 'processing';
                setProgressMessage({
                  type: 'info',
                  status: statusText,
                  message: statusText === 'processing' ? 'Scanning in progress...' : `Status: ${statusText}`,
                  taskId: data.taskId,
                  progress: progress,
                  details: taskStatus.message || null
                });
                
                if (taskStatus.status === 'completed') {
                  taskComplete = true;
                  
                  // The result data is nested under 'result' property when status is completed
                  const resultData = taskStatus.result || taskStatus;
                  console.log('Scan completed - result data:', resultData);
                  
                  const scanData = {
                    totalKeys: resultData.total_keys_found || 0,
                    uniqueKeys: resultData.unique_keys_count || 0,
                    pagesScanned: resultData.pages_scanned || 0,
                    postsScanned: resultData.posts_scanned || 0,
                    headersScanned: resultData.headers_scanned || 0,
                    footersScanned: resultData.footers_scanned || 0,
                    templatesScanned: resultData.templates_scanned || 0,
                    scanResultsLocation: resultData.scan_results_location || null,
                    elements: resultData.data_keys || resultData.elements || []
                  };
                  
                  setScanResults(scanData);
                  setLastScan(new Date().toLocaleString());
                  setProgressMessage(null); // Clear progress
                  setCurrentTaskId(null);
                  setOperationResult({
                    type: 'success',
                    message: `Scan completed successfully! Found ${scanData.totalKeys} data-key attributes across ${scanData.pagesScanned} pages.`
                  });
                  
                  // Add to operations history
                  const newOp = {
                    id: operations.length + 1,
                    operation: 'scan',
                    status: 'completed',
                    timestamp: new Date().toISOString(),
                    result: `${scanData.totalKeys} data-keys found`
                  };
                  setOperations([newOp, ...operations]);
                } else if (taskStatus.status === 'failed' || taskStatus.error) {
                  taskComplete = true;
                  setProgressMessage(null);
                  setCurrentTaskId(null);
                  throw new Error(taskStatus.error || taskStatus.message || 'Scan task failed');
                }
              }
            } catch (statusError) {
              console.error('Error checking task status:', statusError);
              // Continue polling even if one check fails
            }
            
            attempts++;
          }
          
          if (!taskComplete) {
            setProgressMessage(null);
            setCurrentTaskId(null);
            throw new Error('Scan task timed out. Please try again.');
          }
        } else if (data.success === false) {
          // Error response
          throw new Error(data.message || 'Scan operation failed');
        } else {
          // Synchronous response or direct result
          const scanData = {
            totalKeys: data.total_keys_found || data.totalKeys || 0,
            uniqueKeys: data.unique_keys_count || data.uniqueKeys || 0,
            pagesScanned: data.pages_scanned || data.pagesScanned || 0,
            postsScanned: data.posts_scanned || data.postsScanned || 0,
            elements: data.data_keys || data.elements || []
          };
          
          setScanResults(scanData);
          setLastScan(new Date().toLocaleString());
          setOperationResult({
            type: 'success',
            message: `Scan completed. Found ${scanData.totalKeys} data-key attributes.`
          });
          
          // Add to operations history
          const newOp = {
            id: operations.length + 1,
            operation: 'scan',
            status: 'completed',
            timestamp: new Date().toISOString(),
            result: `${scanData.totalKeys} data-keys found`
          };
          setOperations([newOp, ...operations]);
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      
      // Provide helpful error messages
      let errorMessage = 'Scan failed: ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to API. Please check your API endpoint configuration and ensure the server is running.';
      } else if (error.message.includes('404')) {
        errorMessage += 'API endpoint not found. Please verify the URL in Settings.';
      } else if (error.message.includes('CORS')) {
        errorMessage += 'CORS error. The API server needs to allow requests from this origin.';
      } else {
        errorMessage += error.message;
      }
      
      setOperationResult({
        type: 'error',
        message: errorMessage
      });
      
      // Add failed operation to history
      const newOp = {
        id: operations.length + 1,
        operation: 'scan',
        status: 'failed',
        timestamp: new Date().toISOString(),
        result: 'Connection failed'
      };
      setOperations([newOp, ...operations]);
    } finally {
      setIsScanning(false);
    }
  };

  // Strip data-keys
  const handleStrip = async () => {
    if (!window.confirm('This will remove all data-key attributes. Are you sure?')) {
      return;
    }

    setIsProcessing(true);
    setOperationResult(null);

    try {
      const isDemoMode = !settings.apiEndpoint || settings.apiEndpoint === '';
      
      if (isDemoMode) {
        // Mock strip for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const processedCount = scanResults.elements ? scanResults.elements.length : 0;
        setOperationResult({
          type: 'success',
          message: `Successfully stripped data-keys from ${processedCount} elements (Demo Mode).`
        });

        // Clear scan results after stripping
        setScanResults(null);

        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'strip',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: `Removed from ${processedCount} elements (Demo)`
        };
        setOperations([newOp, ...operations]);
      } else {
        const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
        const stripEndpoint = `${baseEndpoint}data-keys/strip`;
        
        if (debugMode) {
          console.log('Debug - Strip endpoint:', stripEndpoint);
        }
        
        const response = await fetch(stripEndpoint, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            operation: 'strip',
            site_url: window.location.origin,
            async: true
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Strip Response:', data);
        
        // Handle async operation with task ID
        if (data.taskId) {
          setCurrentTaskId(data.taskId);
          setProgressMessage({
            type: 'info',
            status: 'processing',
            message: 'Stripping Data-Keys',
            taskId: data.taskId,
            progress: 5
          });
          
          // Poll for task completion
          let taskComplete = false;
          let attempts = 0;
          const maxAttempts = 20; // 5 minutes timeout for strip (20 * 15 seconds)
          const pollInterval = 15000; // 15 second intervals
          
          while (!taskComplete && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            const taskStatus = await checkTaskStatus(data.taskId);
            if (taskStatus) {
              const progress = Math.min(95, Math.floor((attempts / maxAttempts) * 100));
              setProgressMessage({
                type: 'info',
                status: taskStatus.status || 'processing',
                message: 'Stripping Data-Keys',
                taskId: data.taskId,
                progress: progress
              });
              
              if (taskStatus.status === 'completed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                const resultData = taskStatus.result || taskStatus;
                const strippedCount = resultData.total_stripped || resultData.elements_processed || 0;
                setOperationResult({
                  type: 'success',
                  message: `Successfully stripped ${strippedCount > 0 ? strippedCount : 'all'} data-keys.`
                });
                setScanResults(null);
              } else if (taskStatus.status === 'failed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                throw new Error(taskStatus.error || 'Strip operation failed');
              }
            }
            attempts++;
          }
          
          if (!taskComplete) {
            setProgressMessage(null);
            setCurrentTaskId(null);
            throw new Error('Strip operation timed out');
          }
        } else {
          setOperationResult({
            type: 'success',
            message: data.message || 'Successfully stripped data-keys.'
          });
          setScanResults(null);
        }
        
        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'strip',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: 'Data-keys removed'
        };
        setOperations([newOp, ...operations]);
      }
    } catch (error) {
      setOperationResult({
        type: 'error',
        message: `Strip operation failed: ${error.message}`
      });
      
      const newOp = {
        id: operations.length + 1,
        operation: 'strip',
        status: 'failed',
        timestamp: new Date().toISOString(),
        result: 'Operation failed'
      };
      setOperations([newOp, ...operations]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate new data-keys
  const handleGenerate = async () => {
    if (!window.confirm('This will generate new semantic data-keys for all widgets. This replaces any existing keys. Continue?')) {
      return;
    }
    
    setIsProcessing(true);
    setOperationResult(null);

    try {
      const isDemoMode = !settings.apiEndpoint || settings.apiEndpoint === '';
      
      if (isDemoMode) {
        // Mock generate for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const generatedCount = Math.floor(Math.random() * 10) + 5; // Random 5-15 elements
        setOperationResult({
          type: 'success',
          message: `Generated data-keys for ${generatedCount} elements (Demo Mode).`
        });

        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'generate',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: `Generated for ${generatedCount} elements (Demo)`
        };
        setOperations([newOp, ...operations]);
        
        // Trigger a new scan to see the generated keys
        setTimeout(() => handleScan(), 500);
      } else {
        const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
        const generateEndpoint = `${baseEndpoint}data-keys/generate`;
        
        if (debugMode) {
          console.log('Debug - Generate endpoint:', generateEndpoint);
        }
        
        const response = await fetch(generateEndpoint, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            operation: 'generate',
            site_url: window.location.origin,
            async: true
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Generate Response:', data);
        
        // Handle async operation with task ID
        if (data.taskId) {
          setCurrentTaskId(data.taskId);
          setProgressMessage({
            type: 'info',
            status: 'processing',
            message: 'Generating Data-Keys',
            taskId: data.taskId,
            progress: 5,
            details: 'Analyzing widget structure and generating semantic keys...'
          });
          
          // Poll for task completion
          let taskComplete = false;
          let attempts = 0;
          const maxAttempts = 60; // 15 minutes timeout for generate (60 * 15 seconds)
          const pollInterval = 15000; // 15 second intervals
          
          while (!taskComplete && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            const taskStatus = await checkTaskStatus(data.taskId);
            if (taskStatus) {
              const progress = Math.min(95, Math.floor((attempts / maxAttempts) * 100));
              setProgressMessage({
                type: 'info',
                status: taskStatus.status || 'processing',
                message: 'Generating Data-Keys',
                taskId: data.taskId,
                progress: progress,
                details: 'Creating semantic identifiers for widgets...'
              });
              
              if (taskStatus.status === 'completed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                // Get the result data from nested property
                const resultData = taskStatus.result || taskStatus;
                const generatedCount = resultData.total_generated || resultData.elements_processed || 0;
                setOperationResult({
                  type: 'success',
                  message: `Generated data-keys for ${generatedCount} elements.`
                });
                // Trigger scan to see new keys
                setTimeout(() => handleScan(), 500);
              } else if (taskStatus.status === 'failed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                throw new Error(taskStatus.error || 'Generate operation failed');
              }
            }
            attempts++;
          }
          
          if (!taskComplete) {
            setProgressMessage(null);
            setCurrentTaskId(null);
            throw new Error('Generate operation timed out');
          }
        } else {
          setOperationResult({
            type: 'success',
            message: `Generated data-keys for ${data.generated || 0} elements.`
        });
        }

        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'generate',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: `Generated for ${data.generated || 0} elements`
        };
        setOperations([newOp, ...operations]);
      }
    } catch (error) {
      setOperationResult({
        type: 'error',
        message: `Generate operation failed: ${error.message}`
      });
      
      const newOp = {
        id: operations.length + 1,
        operation: 'generate',
        status: 'failed',
        timestamp: new Date().toISOString(),
        result: 'Operation failed'
      };
      setOperations([newOp, ...operations]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore data-keys
  const handleRestore = async () => {
    if (!window.confirm('This will restore data-key attributes using the schema. Continue?')) {
      return;
    }
    
    setIsProcessing(true);
    setOperationResult(null);

    try {
      const isDemoMode = !settings.apiEndpoint || settings.apiEndpoint === '';
      
      if (isDemoMode) {
        // Mock restore for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const restoredCount = 10; // Mock restored count
        setOperationResult({
          type: 'success',
          message: `Restored data-keys for ${restoredCount} elements (Demo Mode).`
        });

        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'restore',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: `Restored ${restoredCount} elements (Demo)`
        };
        setOperations([newOp, ...operations]);
        
        // Trigger a new scan to see the restored keys
        setTimeout(() => handleScan(), 500);
      } else {
        const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
        const restoreEndpoint = `${baseEndpoint}data-keys/restore`;
        
        if (debugMode) {
          console.log('Debug - Restore endpoint:', restoreEndpoint);
        }
        
        const response = await fetch(restoreEndpoint, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            operation: 'restore',
            site_url: window.location.origin,
            async: true
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Restore Response:', data);
        
        // Handle async operation with task ID
        if (data.taskId) {
          setCurrentTaskId(data.taskId);
          setProgressMessage({
            type: 'info',
            status: 'processing',
            message: 'Restoring Data-Keys',
            taskId: data.taskId,
            progress: 5,
            details: 'Restoring from backup schema...'
          });
          
          // Poll for task completion
          let taskComplete = false;
          let attempts = 0;
          const maxAttempts = 20; // 5 minutes timeout for restore (20 * 15 seconds)
          const pollInterval = 15000; // 15 second intervals
          
          while (!taskComplete && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            const taskStatus = await checkTaskStatus(data.taskId);
            if (taskStatus) {
              const progress = Math.min(95, Math.floor((attempts / maxAttempts) * 100));
              setProgressMessage({
                type: 'info',
                status: taskStatus.status || 'processing',
                message: 'Restoring Data-Keys',
                taskId: data.taskId,
                progress: progress,
                details: 'Applying schema to elements...'
              });
              
              if (taskStatus.status === 'completed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                // Get the result data from nested property
                const resultData = taskStatus.result || taskStatus;
                const restoredCount = resultData.total_restored || resultData.elements_processed || 0;
                setOperationResult({
                  type: 'success',
                  message: `Restored data-keys for ${restoredCount} elements.`
                });
                // Trigger scan to see restored keys
                setTimeout(() => handleScan(), 500);
              } else if (taskStatus.status === 'failed') {
                taskComplete = true;
                setProgressMessage(null);
                setCurrentTaskId(null);
                throw new Error(taskStatus.error || 'Restore operation failed');
              }
            }
            attempts++;
          }
          
          if (!taskComplete) {
            setProgressMessage(null);
            setCurrentTaskId(null);
            throw new Error('Restore operation timed out');
          }
        } else {
          setOperationResult({
            type: 'success',
            message: data.message || 'Successfully restored data-keys.'
          });
        }
        
        // Add to operations history
        const newOp = {
          id: operations.length + 1,
          operation: 'restore',
          status: 'completed',
          timestamp: new Date().toISOString(),
          result: 'Data-keys restored'
        };
        setOperations([newOp, ...operations]);
      }
    } catch (error) {
      setOperationResult({
        type: 'error',
        message: `Restore operation failed: ${error.message}`
      });
      
      const newOp = {
        id: operations.length + 1,
        operation: 'restore',
        status: 'failed',
        timestamp: new Date().toISOString(),
        result: 'Operation failed'
      };
      setOperations([newOp, ...operations]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save settings
  const handleSaveSettings = () => {
    localStorage.setItem('dkm_settings', JSON.stringify(settings));
    setOperationResult({
      type: 'success',
      message: 'Settings saved successfully.'
    });
  };

  // Load settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('dkm_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  return (
    <div className="data-key-manager">
      <div className="dkm-header">
        <h2>Data Key Manager</h2>
        <div className="dkm-tabs">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            Scan Results
          </button>
          <button 
            className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            Operations History
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          {debugMode && (
            <button 
              className={`tab-btn ${activeTab === 'debug' ? 'active' : ''}`}
              onClick={() => setActiveTab('debug')}
            >
              Debug
            </button>
          )}
        </div>
      </div>

      {progressMessage && (
        <div className="dkm-progress-container">
          <div className="dkm-progress-card">
            <div className="progress-header">
              <span className="progress-icon">🚀</span>
              <strong>{progressMessage.message}</strong>
            </div>
            {progressMessage.taskId && (
              <p className="task-id">Task ID: <code>{progressMessage.taskId}</code></p>
            )}
            <p className="status-text">Status: <strong>{progressMessage.status}</strong></p>
            {progressMessage.details && (
              <p className="progress-details">{progressMessage.details}</p>
            )}
            <div className="progress-bar-container">
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{width: `${progressMessage.progress}%`}}
                ></div>
              </div>
              <span className="progress-percentage">{progressMessage.progress}%</span>
            </div>
            {progressMessage.status === 'processing' && (
              <div className="spinner-container">
                <div className="spinner"></div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {operationResult && !progressMessage && (
        <div className={`dkm-alert alert-${operationResult.type}`}>
          {operationResult.message}
          <button className="close-alert" onClick={() => setOperationResult(null)}>×</button>
        </div>
      )}

      <div className="dkm-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <div className="status-cards">
              <div className="status-card">
                <h3>System Status</h3>
                <div className="status-item">
                  <span>API Endpoint:</span>
                  <span className={settings.apiEndpoint ? 'status-ok' : 'status-warning'}>
                    {settings.apiEndpoint ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <div className="status-item">
                  <span>Last Scan:</span>
                  <span>{lastScan}</span>
                </div>
                <div className="status-item">
                  <span>Auto Scan:</span>
                  <span className={settings.autoScan ? 'status-ok' : 'status-disabled'}>
                    {settings.autoScan ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="status-item">
                  <span>Preview ID:</span>
                  <span>{previewId || 'Not set'}</span>
                </div>
              </div>

              <div className="action-card">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button 
                    className="action-btn scan-btn"
                    onClick={handleScan}
                    disabled={isScanning || !settings.apiEndpoint}
                  >
                    {isScanning ? 'Scanning...' : 'Scan for Data-Keys'}
                  </button>
                  <button 
                    className="action-btn strip-btn"
                    onClick={handleStrip}
                    disabled={isProcessing || !settings.apiEndpoint}
                  >
                    Strip Data-Keys
                  </button>
                  <button 
                    className="action-btn generate-btn"
                    onClick={handleGenerate}
                    disabled={isProcessing || !settings.apiEndpoint}
                  >
                    Generate Data-Keys
                  </button>
                  <button 
                    className="action-btn restore-btn"
                    onClick={handleRestore}
                    disabled={isProcessing || !settings.apiEndpoint}
                  >
                    Restore Data-Keys
                  </button>
                </div>
              </div>
            </div>

            {scanResults && (
              <div className="scan-summary">
                <h3>Last Scan Summary</h3>
                <p>Total elements with data-keys: {scanResults.totalKeys || 0}</p>
                <p>Pages scanned: {scanResults.pagesScanned || 0}</p>
                <p>Posts scanned: {scanResults.postsScanned || 0}</p>
                <p>Unique data-keys: {scanResults.uniqueKeys || 0}</p>
                {scanResults.headersScanned !== undefined && (
                  <p>Headers scanned: {scanResults.headersScanned}</p>
                )}
                {scanResults.footersScanned !== undefined && (
                  <p>Footers scanned: {scanResults.footersScanned}</p>
                )}
                {scanResults.templatesScanned !== undefined && (
                  <p>Templates scanned: {scanResults.templatesScanned}</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="scan-tab">
            <h3>Scan Results</h3>
            {scanResults ? (
              <div className="scan-results">
                <div className="results-summary">
                  <p>Found {scanResults.totalKeys || 0} data-key attributes across {scanResults.pagesScanned || 0} pages and {scanResults.postsScanned || 0} posts</p>
                  {scanResults.scanResultsLocation && (
                    <p className="scan-location">Results stored at: <code>{scanResults.scanResultsLocation}</code></p>
                  )}
                </div>
                <div className="results-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Element</th>
                        <th>Data-Key</th>
                        <th>Page</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResults.elements?.map((element, index) => (
                        <tr key={index}>
                          <td>{element.selector}</td>
                          <td>{element.dataKey}</td>
                          <td>{element.page}</td>
                          <td><span className="status-badge">Active</span></td>
                        </tr>
                      )) || (
                        <tr>
                          <td colSpan="4">No results to display</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="no-results">
                <p>No scan results available. Run a scan to see data-key information.</p>
                <button className="action-btn" onClick={handleScan} disabled={isScanning}>
                  {isScanning ? 'Scanning...' : 'Run Scan Now'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="operations-tab">
            <h3>Operations History</h3>
            <div className="operations-table">
              <table>
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((op) => (
                    <tr key={op.id}>
                      <td className="op-name">{op.operation.toUpperCase()}</td>
                      <td>
                        <span className={`status-badge status-${op.status}`}>
                          {op.status}
                        </span>
                      </td>
                      <td>{op.result}</td>
                      <td>{new Date(op.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {operations.length === 0 && (
                    <tr>
                      <td colSpan="4">No operations yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h3>Data Key Manager Settings</h3>
            <div className="settings-form">
              <div className="form-group">
                <label htmlFor="api-endpoint">API Endpoint</label>
                <input
                  id="api-endpoint"
                  type="text"
                  value={settings.apiEndpoint}
                  onChange={(e) => setSettings({...settings, apiEndpoint: e.target.value})}
                  placeholder="https://your-api-gateway.execute-api.region.amazonaws.com/prod"
                />
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.autoScan}
                    onChange={(e) => setSettings({...settings, autoScan: e.target.checked})}
                  />
                  Enable Auto Scan
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.backupEnabled}
                    onChange={(e) => setSettings({...settings, backupEnabled: e.target.checked})}
                  />
                  Enable Backup Before Operations
                </label>
              </div>
              
              <button className="save-btn" onClick={handleSaveSettings}>
                Save Settings
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'debug' && debugMode && (
          <div className="debug-tab">
            <h3>Debug Information</h3>
            <div className="debug-info">
              <div className="debug-section">
                <h4>Configuration</h4>
                <pre>{JSON.stringify({
                  apiEndpoint: settings.apiEndpoint,
                  baseEndpoint: settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/',
                  scanUrl: `${settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/'}data-keys/scan`,
                  currentOrigin: window.location.origin,
                  previewId: previewId || 'default'
                }, null, 2)}</pre>
              </div>
              
              <div className="debug-section">
                <h4>Test Connection</h4>
                <button 
                  className="test-btn"
                  onClick={async () => {
                    try {
                      const baseEndpoint = settings.apiEndpoint.endsWith('/') ? settings.apiEndpoint : settings.apiEndpoint + '/';
                      const testUrl = `${baseEndpoint}data-keys/health`;
                      console.log('Testing connection to:', testUrl);
                      
                      const response = await fetch(testUrl, {
                        method: 'GET',
                        mode: 'cors',
                        headers: {
                          'Accept': 'application/json',
                        }
                      });
                      
                      console.log('Test response:', response);
                      setOperationResult({
                        type: response.ok ? 'success' : 'error',
                        message: `Connection test: ${response.ok ? 'Success' : 'Failed'} (Status: ${response.status})`
                      });
                    } catch (error) {
                      console.error('Connection test error:', error);
                      setOperationResult({
                        type: 'error',
                        message: `Connection test failed: ${error.message}`
                      });
                    }
                  }}
                >
                  Test API Connection
                </button>
              </div>
              
              <div className="debug-section">
                <h4>Last Operation Result</h4>
                <pre>{operationResult ? JSON.stringify(operationResult, null, 2) : 'No operation result'}</pre>
              </div>
              
              <div className="debug-section">
                <h4>Console Instructions</h4>
                <p>Open browser console (F12) to see detailed debug logs for all API calls.</p>
                <p>Look for messages starting with "Debug -" for detailed information.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataKeyManager;