import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../../styles/AIAssistant.module.css';

const AIAssistant = () => {
  // Updated state to support multiple branches with parent-child relationships
  const [branches, setBranches] = useState([
    { 
      id: '1', 
      name: 'Main Thread', 
      messages: [], 
      parentId: null,
      color: '#4CD964', // Green for main branch
      createdAt: new Date().toISOString() // Add creation timestamp
    }
  ]);
  const [activeBranchId, setActiveBranchId] = useState('1');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [selectedTool, setSelectedTool] = useState('none');
  const [error, setError] = useState(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [showBranchGraph, setShowBranchGraph] = useState(true);
  // Add zoom-related state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const messagesEndRef = useRef(null);
  const canvasRef = useRef(null);

  // Helper to get the active branch
  const getActiveBranch = () => {
    return branches.find(branch => branch.id === activeBranchId) || branches[0];
  };

  // Helper to get messages from the active branch
  const getActiveMessages = () => {
    const activeBranch = getActiveBranch();
    return activeBranch ? activeBranch.messages : [];
  };

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [getActiveMessages()]);

  // Draw the branch visualization
  useEffect(() => {
    if (!canvasRef.current || !showBranchGraph) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas dimensions
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw branches with zoom and pan applied
    drawBranches(ctx, canvas.width, canvas.height);
  }, [branches, showBranchGraph, zoomLevel, panOffset]);

  // Add mouse event handlers for zoom and pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showBranchGraph) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      
      // Determine zoom direction
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      
      // Update zoom level, with min and max constraints
      setZoomLevel(prevZoom => {
        const newZoom = prevZoom * zoomFactor;
        return Math.min(Math.max(newZoom, 0.5), 3); // Limit zoom between 0.5x and 3x
      });
    };
    
    const handleMouseDown = (e) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      setPanOffset(prev => ({ 
        x: prev.x + dx / zoomLevel, 
        y: prev.y + dy / zoomLevel 
      }));
      
      setDragStart({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [showBranchGraph, isDragging, dragStart, zoomLevel]);

  // Draw the branch visualization
  const drawBranches = (ctx, width, height) => {
    if (branches.length <= 1) return;
    
    // Save the current state and apply transformations
    ctx.save();
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply zoom and pan transformations
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-width / 2 + panOffset.x, -height / 2 + panOffset.y);
    
    // Start coordinates
    const startX = 50;
    const endX = width - 50;
    const centerY = height / 2;
    const nodeRadius = 6;
    const branchVerticalSpacing = 30; // Reduced spacing for better visualization
    
    // Create a map of branch IDs to their visual positions
    const branchPositions = {};
    
    // First, position the main branch (parentId = null)
    const mainBranch = branches.find(b => b.parentId === null);
    if (mainBranch) {
      branchPositions[mainBranch.id] = {
        x: startX,
        y: centerY,
        endX: endX
      };
    }
    
    // Create a mapping of branches by parent
    const branchesByParent = {};
    branches.forEach(branch => {
      if (branch.parentId) {
        if (!branchesByParent[branch.parentId]) {
          branchesByParent[branch.parentId] = [];
        }
        branchesByParent[branch.parentId].push(branch);
      }
    });
    
    // Function to recursively position child branches
    const positionBranches = (parentId, parentY, level = 0) => {
      const children = branchesByParent[parentId] || [];
      const totalChildren = children.length;
      
      if (totalChildren === 0) return;
      
      // Calculate y-positions for child branches
      let currentY = parentY;
      
      children.forEach((branch, index) => {
        // Calculate vertical offset for this branch
        let offsetDirection = 1;
        if (totalChildren > 1) {
          offsetDirection = index % 2 === 0 ? 1 : -1;
          if (totalChildren === 2 && index === 0) {
            offsetDirection = -1; // First branch goes up
          }
        }
        
        const offsetAmount = (level + 1) * branchVerticalSpacing * offsetDirection;
        const branchY = parentY + offsetAmount;
        
        // Calculate branch point (where it splits from parent)
        const branchPointX = startX + (endX - startX) * (0.2 + (level * 0.1));
        
        // Store position information
        branchPositions[branch.id] = {
          x: branchPointX,
          y: branchY,
          endX: endX,
          parentId: parentId,
          branchPoint: {
            x: branchPointX,
            y: parentY // Branch starts at parent's Y level
          }
        };
        
        // Position children of this branch
        positionBranches(branch.id, branchY, level + 1);
      });
    };
    
    // Start recursive positioning with the main branch
    if (mainBranch) {
      positionBranches(mainBranch.id, centerY);
    }
    
    // Draw all branches
    // First pass: draw the connecting lines
    branches.forEach(branch => {
      const pos = branchPositions[branch.id];
      if (!pos) return;
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = branch.color;
      
      if (branch.parentId === null) {
        // Main branch - draw straight line
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.endX, pos.y);
        ctx.stroke();
      } else {
        // Child branch - draw curved line from parent
        const parentPos = branchPositions[branch.parentId];
        if (!parentPos) return;
        
        // Start at the branch point on parent
        ctx.beginPath();
        ctx.moveTo(pos.branchPoint.x, pos.branchPoint.y);
        
        // Control point for curve
        const controlX = (pos.branchPoint.x + pos.x) / 2;
        const controlY = (pos.branchPoint.y + pos.y) / 2;
        
        // Curved connection to branch position
        ctx.quadraticCurveTo(
          controlX, controlY,
          pos.x, pos.y
        );
        
        // Continue straight to the end
        ctx.lineTo(pos.endX, pos.y);
        ctx.stroke();
      }
    });
    
    // Second pass: draw nodes
    branches.forEach(branch => {
      const pos = branchPositions[branch.id];
      if (!pos) return;
      
      // Draw node at branch start
      ctx.beginPath();
      ctx.fillStyle = branch.color;
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight active branch
      if (branch.id === activeBranchId) {
        ctx.beginPath();
        ctx.strokeStyle = branch.color;
        ctx.lineWidth = 2;
        ctx.arc(pos.x, pos.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw branch name
      ctx.fillStyle = branch.id === activeBranchId ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = `${branch.id === activeBranchId ? 'bold ' : ''}12px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(branch.name, pos.x + 15, pos.y + 5);
    });
    
    // Restore the canvas state
    ctx.restore();
    
    // Draw zoom level indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Zoom: ${Math.round(zoomLevel * 100)}%`, width - 10, height - 10);
  };

  // Add zoom control buttons
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 3));
  };
  
  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev * 0.8, 0.5));
  };
  
  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleSubmitApiKey = (e) => {
    e.preventDefault();
    if (apiKey.trim().startsWith('sk-')) {
      setIsKeySet(true);
      // We don't store the API key anywhere except in component state
      // In a production app, this would be handled server-side
    } else {
      setError('Please enter a valid OpenAI API key starting with "sk-"');
    }
  };

  // Generate a random color for a new branch
  const getRandomBranchColor = () => {
    const branchColors = [
      '#007AFF', // Blue
      '#FF3B30', // Red
      '#FFCC00', // Yellow
      '#34C759', // Green
      '#AF52DE', // Purple
      '#FF9500', // Orange
      '#00C7BE', // Teal
    ];
    
    const usedColors = branches.map(branch => branch.color);
    const availableColors = branchColors.filter(color => !usedColors.includes(color));
    
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    // If all colors are used, return a random one
    return branchColors[Math.floor(Math.random() * branchColors.length)];
  };

  const createNewBranch = () => {
    if (isCreatingBranch) {
      if (!newBranchName.trim()) {
        setIsCreatingBranch(false);
        return;
      }
      
      // Get the current active branch to inherit its messages
      const parentBranch = getActiveBranch();
      
      // Generate a unique ID for the new branch
      const newBranchId = Date.now().toString();
      
      // Current timestamp for branch creation
      const branchCreationTime = new Date().toISOString();
      
      // Create the new branch with the parent's messages
      // Add source branch metadata to inherited messages
      const inheritedMessages = parentBranch.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString(),
        sourceBranch: msg.sourceBranch || {
          id: parentBranch.id,
          name: parentBranch.name,
          color: parentBranch.color
        }
      }));
      
      const newBranch = {
        id: newBranchId,
        name: newBranchName.trim(),
        parentId: parentBranch.id,
        messages: inheritedMessages,
        color: getRandomBranchColor(),
        createdAt: branchCreationTime // Store branch creation time
      };
      
      // Add the new branch and set it as active
      setBranches(prev => [...prev, newBranch]);
      setActiveBranchId(newBranchId);
      setNewBranchName('');
      setIsCreatingBranch(false);
    } else {
      setIsCreatingBranch(true);
    }
  };

  const handleBranchNameChange = (e) => {
    setNewBranchName(e.target.value);
  };

  const switchBranch = (branchId) => {
    setActiveBranchId(branchId);
  };

  // Helper to get all descendant branch IDs (recursive)
  const getAllDescendantIds = (branchId) => {
    const directChildren = branches.filter(b => b.parentId === branchId).map(b => b.id);
    const allDescendants = [...directChildren];
    
    // Recursively get descendants of each child
    directChildren.forEach(childId => {
      const childDescendants = getAllDescendantIds(childId);
      allDescendants.push(...childDescendants);
    });
    
    return allDescendants;
  };

  // Add helper to check if a message is historical or propagated
  const isHistoricalMessage = (msg, branch) => {
    // If the message has no timestamp or the branch has no creation time, assume it's historical
    if (!msg.timestamp || !branch.createdAt) return true;
    
    // If message timestamp is before branch creation, it's historical
    return new Date(msg.timestamp) < new Date(branch.createdAt);
  };

  // Add a helper function to render message content with citations
  const renderMessageWithCitations = (content, annotations) => {
    if (!annotations || annotations.length === 0) {
      return content;
    }
    
    // Sort annotations by start_index in descending order to avoid index shifting
    const sortedAnnotations = [...annotations].sort((a, b) => 
      b.url_citation?.start_index - a.url_citation?.start_index
    );
    
    let contentWithCitations = content;
    
    // Insert citation links
    sortedAnnotations.forEach(annotation => {
      if (annotation.type === 'url_citation' && annotation.url_citation) {
        const { start_index, end_index, url, title } = annotation.url_citation;
        
        // Create the citation
        const citedText = contentWithCitations.substring(start_index, end_index);
        const citationLink = `<a href="${url}" target="_blank" class="${styles.citation}" title="${title}">${citedText}</a>`;
        
        // Replace the text with the linked version
        contentWithCitations = 
          contentWithCitations.substring(0, start_index) + 
          citationLink + 
          contentWithCitations.substring(end_index);
      }
    });
    
    return contentWithCitations;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Get the current active branch
    const activeBranch = getActiveBranch();
    
    // Create timestamp for the message
    const messageTimestamp = new Date().toISOString();
    
    // Add user message to the active branch with timestamp and source information
    const userMessage = { 
      role: 'user', 
      content: inputMessage, 
      timestamp: messageTimestamp,
      sourceBranch: {
        id: activeBranchId,
        name: activeBranch.name,
        color: activeBranch.color
      }
    };
    
    // Get all descendant branch IDs to propagate the message
    const descendantIds = getAllDescendantIds(activeBranchId);
    
    // Update the active branch and all its descendants with the new message
    setBranches(prev => prev.map(branch => {
      if (branch.id === activeBranchId || descendantIds.includes(branch.id)) {
        return { 
          ...branch, 
          messages: [...branch.messages, userMessage] 
        };
      }
      return branch;
    }));
    
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare the API request
      const tools = [];
      let webSearchOptions = undefined;
      
      // Add selected tool if any
      if (selectedModel.includes('search-preview')) {
        // For search-enabled models, use web_search_options
        webSearchOptions = {
          search_context_size: "medium"
        };
      } else if (selectedTool === 'web_search') {
        // For regular models, use function-calling for web search
        tools.push({
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current information.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query"
                }
              },
              required: ["query"]
            }
          }
        });
      } else if (selectedTool === 'file_search') {
        // In a real app, you would connect this to your file store
        tools.push({
          type: "function",
          function: {
            name: "file_search",
            description: "Search through files in the vector database",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query"
                }
              },
              required: ["query"]
            }
          }
        });
      }
      
      // Format conversation history for the API
      // Only include user and assistant messages, skip system messages
      const conversationHistory = [...activeBranch.messages, userMessage]
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Make the API request
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversationHistory,
          tools: tools.length > 0 ? tools : undefined,
          web_search_options: webSearchOptions
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get response from OpenAI');
      }
      
      const responseData = await response.json();
      console.log('OpenAI Response:', responseData);
      
      // Extract the text content from the response (Chat Completions API format)
      let assistantContent = 'No response content';
      let annotations = [];
      
      if (responseData.choices && responseData.choices.length > 0) {
        const message = responseData.choices[0].message;
        
        // Check if the response includes web search annotations
        if (message.annotations && message.annotations.length > 0) {
          // Save the annotations for reference
          annotations = message.annotations;
          
          // Format the content with clickable citations
          assistantContent = message.content || 'No response content';
        }
        // Check if the response includes tool calls
        else if (message.tool_calls && message.tool_calls.length > 0) {
          // For now, we'll just display the tool calls as part of the message
          // In a real app, you would actually execute these tool calls
          const toolCalls = message.tool_calls.map(tool => {
            if (tool.function) {
              return `Tool Call: ${tool.function.name}(${tool.function.arguments})`;
            }
            return 'Unknown tool call';
          });
          
          assistantContent = message.content || '';
          if (assistantContent && toolCalls.length > 0) {
            assistantContent += '\n\n' + toolCalls.join('\n');
          } else if (toolCalls.length > 0) {
            assistantContent = toolCalls.join('\n');
          }
        } else {
          assistantContent = message.content || 'No response content';
        }
      }
      
      // Create response timestamp
      const responseTimestamp = new Date().toISOString();
      
      // Add assistant message to the active branch with timestamp and source information
      const assistantMessage = { 
        role: 'assistant', 
        content: assistantContent,
        timestamp: responseTimestamp,
        sourceBranch: {
          id: activeBranchId,
          name: activeBranch.name,
          color: activeBranch.color
        },
        annotations: annotations // Store any search result annotations
      };
      
      // Update the active branch AND all its descendants with the assistant's response
      setBranches(prev => prev.map(branch => {
        if (branch.id === activeBranchId || descendantIds.includes(branch.id)) {
          return { 
            ...branch, 
            messages: [...branch.messages, assistantMessage] 
          };
        }
        return branch;
      }));
      
    } catch (err) {
      console.error('Error calling OpenAI:', err);
      setError(err.message || 'An error occurred while communicating with OpenAI');
      
      // Add error message to the active branch
      const errorMessage = { 
        role: 'system', 
        content: `Error: ${err.message || 'Failed to get a response'}`,
        timestamp: new Date().toISOString(),
        sourceBranch: {
          id: activeBranchId,
          name: activeBranch.name,
          color: activeBranch.color
        }
      };
      
      // Only add error message to the active branch (not to descendants)
      setBranches(prev => prev.map(branch => 
        branch.id === activeBranchId 
          ? { ...branch, messages: [...branch.messages, errorMessage] } 
          : branch
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setBranches(prev => prev.map(branch => 
      branch.id === activeBranchId 
        ? { ...branch, messages: [] } 
        : branch
    ));
  };
  
  const resetApiKey = () => {
    setApiKey('');
    setIsKeySet(false);
  };

  const deleteBranch = (branchId) => {
    // Don't delete if it's the only branch
    if (branches.length <= 1) return;
    
    // Get children of this branch
    const childBranches = branches.filter(branch => branch.parentId === branchId);
    
    // If this branch has children, reassign their parentId to this branch's parent
    const branchToDelete = branches.find(branch => branch.id === branchId);
    const parentId = branchToDelete ? branchToDelete.parentId : null;
    
    // Update branches: remove the deleted one and update children's parentId
    setBranches(prev => prev
      .filter(branch => branch.id !== branchId)
      .map(branch => 
        branch.parentId === branchId 
          ? { ...branch, parentId } 
          : branch
      )
    );
    
    // If the active branch is being deleted, switch to the parent or first available branch
    if (activeBranchId === branchId) {
      if (parentId) {
        setActiveBranchId(parentId);
      } else {
        const remainingBranches = branches.filter(branch => branch.id !== branchId);
        if (remainingBranches.length > 0) {
          setActiveBranchId(remainingBranches[0].id);
        }
      }
    }
  };

  const toggleBranchGraph = () => {
    setShowBranchGraph(prev => !prev);
  };
  
  // Format timestamp for display
  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Head>
        <title>OpenAI Agent Interface</title>
        <meta name="description" content="Interface for OpenAI's Agents" />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>OpenAI Agent Interface</h1>
          <p>Securely interact with OpenAI's new agent capabilities</p>
        </div>
        
        {!isKeySet ? (
          <div className={styles.apiKeyForm}>
            <h2>Enter your OpenAI API Key</h2>
            <p>Your API key is stored only in your browser's memory and is never saved or sent anywhere else.</p>
            
            <form onSubmit={handleSubmitApiKey}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className={styles.apiKeyInput}
                required
              />
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.button}>Set API Key</button>
            </form>
            
            <div className={styles.securityNote}>
              <h3>⚠️ Security Note</h3>
              <p>Never share your API key. For production applications, API keys should be handled server-side.</p>
              <p>This demo uses your API key directly from your browser for simplicity, but this is not recommended for production use.</p>
            </div>
          </div>
        ) : (
          <div className={styles.chatInterface}>
            <div className={styles.controlPanel}>
              <div className={styles.modelSelector}>
                <label>Model: </label>
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4o-search-preview">GPT-4o with Web Search</option>
                  <option value="gpt-4o-mini-search-preview">GPT-4o Mini with Web Search</option>
                </select>
              </div>
              
              <div className={styles.toolSelector}>
                <label>Tool: </label>
                <select 
                  value={selectedTool} 
                  onChange={(e) => setSelectedTool(e.target.value)}
                  disabled={selectedModel.includes('search-preview')}
                >
                  <option value="none">None</option>
                  <option value="web_search">Web Search (Function)</option>
                  <option value="file_search">File Search (Simulated)</option>
                </select>
                {selectedModel.includes('search-preview') ? (
                  <span className={styles.toolNote}>Web search is built into this model</span>
                ) : (
                  <span className={styles.toolNote}>Tools are simulated in this demo</span>
                )}
              </div>
              
              <div className={styles.actions}>
                <button onClick={resetChat} className={styles.resetButton}>
                  Clear Branch
                </button>
                <button onClick={toggleBranchGraph} className={styles.viewButton}>
                  {showBranchGraph ? 'Hide Graph' : 'Show Graph'}
                </button>
                <button onClick={resetApiKey} className={styles.keyButton}>
                  Change API Key
                </button>
              </div>
            </div>
            
            {/* Branch Visualization */}
            {showBranchGraph && branches.length > 1 && (
              <div className={styles.branchVisualization}>
                <canvas ref={canvasRef} className={styles.branchCanvas} />
                <div className={styles.zoomControls}>
                  <button onClick={zoomIn} title="Zoom In">+</button>
                  <button onClick={resetZoom} title="Reset Zoom">Reset</button>
                  <button onClick={zoomOut} title="Zoom Out">−</button>
                </div>
              </div>
            )}
            
            {/* Branch Navigation Bar */}
            <div className={styles.branchNavigation}>
              <div className={styles.branchTabs}>
                {branches.map(branch => (
                  <div 
                    key={branch.id} 
                    className={`${styles.branchTab} ${activeBranchId === branch.id ? styles.activeBranchTab : ''}`}
                    onClick={() => switchBranch(branch.id)}
                    style={{
                      borderColor: activeBranchId === branch.id ? branch.color : 'rgba(255, 255, 255, 0.1)',
                      backgroundColor: activeBranchId === branch.id ? `${branch.color}20` : 'rgba(15, 23, 42, 0.6)'
                    }}
                  >
                    <span 
                      className={styles.branchIndicator} 
                      style={{ backgroundColor: branch.color }}
                    ></span>
                    <span>{branch.name}</span>
                    {branches.length > 1 && (
                      <button 
                        className={styles.deleteBranchBtn}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          deleteBranch(branch.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                {isCreatingBranch ? (
                  <div className={styles.newBranchInput}>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={handleBranchNameChange}
                      placeholder="Branch name..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createNewBranch();
                        if (e.key === 'Escape') setIsCreatingBranch(false);
                      }}
                    />
                    <button onClick={createNewBranch}>✓</button>
                    <button onClick={() => setIsCreatingBranch(false)}>✕</button>
                  </div>
                ) : (
                  <button className={styles.newBranchButton} onClick={createNewBranch}>
                    + New Branch from {getActiveBranch().name}
                  </button>
                )}
              </div>
            </div>
            
            <div className={styles.messagesContainer}>
              {getActiveMessages().length === 0 ? (
                <div className={styles.emptyState}>
                  <h2>Start a conversation in {getActiveBranch().name}</h2>
                  <p>Try asking questions or requesting assistance with tasks</p>
                  
                  <div className={styles.apiInfo}>
                    <h3>About Branching Conversations</h3>
                    <p>This interface allows you to maintain multiple conversation threads with the AI.</p>
                    <p>Each branch maintains its own conversation context and inherits the history of its parent branch.</p>
                    
                    <div className={styles.memoryNote}>
                      <h4>✓ Git-Style Branching</h4>
                      <p>Create different branches to explore alternative directions from any point in a conversation.</p>
                    </div>
                    
                    <div className={styles.memoryNote}>
                      <h4>✓ Live Message Inheritance</h4>
                      <p>Messages sent in parent branches automatically flow to all their child branches.</p>
                      <p>This inheritance creates a hierarchical relationship where:</p>
                      <ul>
                        <li>Main Thread → messages propagate to all descendants</li>
                        <li>Child branches → messages propagate to their children</li>
                        <li>Messages are categorized as:</li>
                        <ul>
                          <li><strong>Historical</strong> - existed when branch was created (shown with dashed border)</li>
                          <li><strong>Propagated</strong> - added to parent branch after child was created (shown with solid border)</li>
                        </ul>
                      </ul>
                    </div>
                    
                    <div className={styles.apiInfoExample}>
                      <h4>Example Query Ideas:</h4>
                      <ul>
                        <li>What are the latest developments in AI research?</li>
                        <li>Can you help me write a Python script to analyze CSV data?</li>
                        <li>Tell me about machine learning, then ask me what specific aspect I'm interested in</li>
                        <li>Let's brainstorm ideas for a new web application</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Group and display messages by type */}
                  {(() => {
                    const activeBranch = getActiveBranch();
                    const messages = getActiveMessages();
                    
                    // Separate messages into categories
                    const historicalMessages = [];
                    const propagatedMessages = [];
                    const currentBranchMessages = [];
                    
                    messages.forEach(msg => {
                      const isInherited = msg.sourceBranch && msg.sourceBranch.id !== activeBranchId;
                      
                      if (isInherited) {
                        if (isHistoricalMessage(msg, activeBranch)) {
                          historicalMessages.push(msg);
                        } else {
                          propagatedMessages.push(msg);
                        }
                      } else {
                        currentBranchMessages.push(msg);
                      }
                    });
                    
                    return (
                      <>
                        {/* Historical messages section */}
                        {historicalMessages.length > 0 && (
                          <div className={styles.messageSection}>
                            <div className={styles.messageSectionHeader} 
                                 style={{ color: historicalMessages[0]?.sourceBranch?.color }}>
                              ↑ Historical data from {historicalMessages[0]?.sourceBranch?.name}
                            </div>
                            {historicalMessages.map((msg, index) => (
                              <div 
                                key={`historical-${index}`} 
                                className={`${styles.message} ${
                                  msg.role === 'user' 
                                    ? styles.userMessage 
                                    : msg.role === 'assistant' 
                                      ? styles.assistantMessage 
                                      : styles.systemMessage
                                } ${styles.historicalMessage}`}
                              >
                                <div className={styles.messageContent}>
                                  {msg.annotations && msg.annotations.length > 0 
                                    ? <div dangerouslySetInnerHTML={{ 
                                        __html: renderMessageWithCitations(msg.content, msg.annotations) 
                                      }} />
                                    : msg.content
                                  }
                                </div>
                                <div className={styles.messageMetadata}>
                                  {msg.timestamp && (
                                    <span className={styles.messageTime}>
                                      {formatTimestamp(msg.timestamp)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Propagated messages section */}
                        {propagatedMessages.length > 0 && (
                          <div className={styles.messageSection}>
                            <div className={styles.messageSectionHeader}
                                 style={{ color: propagatedMessages[0]?.sourceBranch?.color }}>
                              → Propagated data from {propagatedMessages[0]?.sourceBranch?.name}
                            </div>
                            {propagatedMessages.map((msg, index) => (
                              <div 
                                key={`propagated-${index}`} 
                                className={`${styles.message} ${
                                  msg.role === 'user' 
                                    ? styles.userMessage 
                                    : msg.role === 'assistant' 
                                      ? styles.assistantMessage 
                                      : styles.systemMessage
                                } ${styles.propagatedMessage}`}
                              >
                                <div className={styles.messageContent}>
                                  {msg.annotations && msg.annotations.length > 0 
                                    ? <div dangerouslySetInnerHTML={{ 
                                        __html: renderMessageWithCitations(msg.content, msg.annotations) 
                                      }} />
                                    : msg.content
                                  }
                                </div>
                                <div className={styles.messageMetadata}>
                                  {msg.timestamp && (
                                    <span className={styles.messageTime}>
                                      {formatTimestamp(msg.timestamp)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Current branch messages section */}
                        {currentBranchMessages.length > 0 && (
                          <div className={styles.messageSection}>
                            {(historicalMessages.length > 0 || propagatedMessages.length > 0) && (
                              <div className={styles.messageSectionHeader}
                                   style={{ color: activeBranch.color }}>
                                • Messages in {activeBranch.name}
                              </div>
                            )}
                            {currentBranchMessages.map((msg, index) => (
                              <div 
                                key={`current-${index}`} 
                                className={`${styles.message} ${
                                  msg.role === 'user' 
                                    ? styles.userMessage 
                                    : msg.role === 'assistant' 
                                      ? styles.assistantMessage 
                                      : styles.systemMessage
                                }`}
                              >
                                <div className={styles.messageContent}>
                                  {msg.annotations && msg.annotations.length > 0 
                                    ? <div dangerouslySetInnerHTML={{ 
                                        __html: renderMessageWithCitations(msg.content, msg.annotations) 
                                      }} />
                                    : msg.content
                                  }
                                </div>
                                <div className={styles.messageMetadata}>
                                  {msg.timestamp && (
                                    <span className={styles.messageTime}>
                                      {formatTimestamp(msg.timestamp)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              {isLoading && (
                <div className={styles.loadingIndicator}>
                  <div className={styles.typing}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className={styles.inputForm}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Type your message in ${getActiveBranch().name}...`}
                disabled={isLoading}
                className={styles.messageInput}
              />
              <button 
                type="submit" 
                disabled={isLoading || !inputMessage.trim()} 
                className={styles.sendButton}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default AIAssistant; 