import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import styles from '../../styles/Parallels.module.css';

const ParallelsPage = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const [branches, setBranches] = useState([]);
  const [branchNodes, setBranchNodes] = useState([]);
  const [colorScheme] = useState({
    main: '#4CD964',     // Green for main branch
    feature: '#007AFF',  // Blue for feature branches
    hotfix: '#FF3B30',   // Red for hotfix branches
    background: '#121212'
  });
  
  useEffect(() => {
    // Initialize canvas dimensions based on container
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Generate the branch visualization
        generateBranchVisualization(canvas.width, canvas.height);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (branchNodes.length && branches.length) {
      startAnimation();
    }
  }, [branchNodes, branches]);

  const generateBranchVisualization = (width, height) => {
    const centerY = height / 2;
    const startX = width * 0.1;
    const endX = width * 0.9;
    const nodeSize = 14;
    
    // Create nodes
    const newBranchNodes = [];
    
    // Main branch nodes
    const mainNodes = [
      {
        id: 'main-1',
        x: startX + (endX - startX) * 0.15,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Initial commit'
      },
      {
        id: 'main-2',
        x: startX + (endX - startX) * 0.3,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Setup project'
      },
      {
        id: 'main-branch',
        x: startX + (endX - startX) * 0.45,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Branch point',
        isBranchPoint: true
      },
      {
        id: 'main-3',
        x: startX + (endX - startX) * 0.6,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Main update'
      },
      {
        id: 'main-4',
        x: startX + (endX - startX) * 0.75,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Merge branches',
        isMergePoint: true
      },
      {
        id: 'main-5',
        x: startX + (endX - startX) * 0.9,
        y: centerY,
        radius: nodeSize,
        color: colorScheme.main,
        label: 'Release v1.0'
      }
    ];
    
    // Feature branch nodes (split from main-branch)
    const featureOffset = height * 0.15;
    const featureNodes = [
      {
        id: 'feature-1',
        x: startX + (endX - startX) * 0.5,
        y: centerY - featureOffset,
        radius: nodeSize - 2,
        color: colorScheme.feature,
        label: 'Feature init'
      },
      {
        id: 'feature-2',
        x: startX + (endX - startX) * 0.65,
        y: centerY - featureOffset,
        radius: nodeSize - 2,
        color: colorScheme.feature,
        label: 'Feature complete'
      }
    ];
    
    // Hotfix branch nodes (split from main-branch)
    const hotfixOffset = height * 0.15;
    const hotfixNodes = [
      {
        id: 'hotfix-1',
        x: startX + (endX - startX) * 0.5,
        y: centerY + hotfixOffset,
        radius: nodeSize - 2,
        color: colorScheme.hotfix,
        label: 'Hotfix init'
      },
      {
        id: 'hotfix-2',
        x: startX + (endX - startX) * 0.65,
        y: centerY + hotfixOffset,
        radius: nodeSize - 2,
        color: colorScheme.hotfix,
        label: 'Hotfix complete'
      }
    ];
    
    newBranchNodes.push(...mainNodes, ...featureNodes, ...hotfixNodes);
    
    // Create branch lines
    const newBranches = [];
    
    // Main branch line
    newBranches.push({
      id: 'main-line',
      type: 'main',
      color: colorScheme.main,
      width: 4,
      animated: true,
      animationSpeed: 0.003,
      animationProgress: 0,
      points: mainNodes.map(node => ({ x: node.x, y: node.y }))
    });
    
    // Feature branch line (with connection to main)
    newBranches.push({
      id: 'feature-line',
      type: 'feature',
      color: colorScheme.feature,
      width: 3,
      animated: true,
      animationSpeed: 0.004,
      animationProgress: 0,
      points: [
        { x: mainNodes[2].x, y: mainNodes[2].y }, // Start from branch point
        { x: mainNodes[2].x + (featureNodes[0].x - mainNodes[2].x) * 0.5, 
          y: mainNodes[2].y + (featureNodes[0].y - mainNodes[2].y) * 0.5 }, // Control point
        ...featureNodes.map(node => ({ x: node.x, y: node.y })),
        { x: featureNodes[1].x + (mainNodes[4].x - featureNodes[1].x) * 0.5, 
          y: featureNodes[1].y + (mainNodes[4].y - featureNodes[1].y) * 0.5 }, // Control point
        { x: mainNodes[4].x, y: mainNodes[4].y } // End at merge point
      ]
    });
    
    // Hotfix branch line (with connection to main)
    newBranches.push({
      id: 'hotfix-line',
      type: 'hotfix',
      color: colorScheme.hotfix,
      width: 3,
      animated: true,
      animationSpeed: 0.005,
      animationProgress: 0,
      points: [
        { x: mainNodes[2].x, y: mainNodes[2].y }, // Start from branch point
        { x: mainNodes[2].x + (hotfixNodes[0].x - mainNodes[2].x) * 0.5, 
          y: mainNodes[2].y + (hotfixNodes[0].y - mainNodes[2].y) * 0.5 }, // Control point
        ...hotfixNodes.map(node => ({ x: node.x, y: node.y })),
        { x: hotfixNodes[1].x + (mainNodes[4].x - hotfixNodes[1].x) * 0.5, 
          y: hotfixNodes[1].y + (mainNodes[4].y - hotfixNodes[1].y) * 0.5 }, // Control point
        { x: mainNodes[4].x, y: mainNodes[4].y } // End at merge point
      ]
    });
    
    // Branch labels
    const branchLabels = [
      {
        id: 'main-label',
        text: 'main',
        x: startX,
        y: centerY,
        color: colorScheme.main,
        align: 'left'
      },
      {
        id: 'feature-label',
        text: 'feature/new-ui',
        x: startX,
        y: centerY - featureOffset,
        color: colorScheme.feature,
        align: 'left'
      },
      {
        id: 'hotfix-label',
        text: 'hotfix/bug-123',
        x: startX,
        y: centerY + hotfixOffset,
        color: colorScheme.hotfix,
        align: 'left'
      }
    ];
    
    setBranchNodes([...newBranchNodes, ...branchLabels]);
    setBranches(newBranches);
  };

  const startAnimation = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw branch connections first (background)
      branches.forEach(branch => {
        ctx.beginPath();
        ctx.strokeStyle = branch.color;
        ctx.lineWidth = branch.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const points = branch.points;
        ctx.moveTo(points[0].x, points[0].y);
        
        // If it's a feature or hotfix branch, use curved paths
        if (branch.type === 'feature' || branch.type === 'hotfix') {
          // First curve (from main to branch)
          ctx.quadraticCurveTo(
            points[1].x, points[1].y, // control point
            points[2].x, points[2].y  // destination
          );
          
          // Draw middle line
          ctx.lineTo(points[3].x, points[3].y);
          
          // Final curve (from branch to main)
          ctx.quadraticCurveTo(
            points[4].x, points[4].y, // control point
            points[5].x, points[5].y  // destination
          );
        } else {
          // For main branch, just draw lines
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
        }
        
        ctx.stroke();
        
        // Animated particles
        if (branch.animated) {
          branch.animationProgress += branch.animationSpeed;
          if (branch.animationProgress > 1) branch.animationProgress = 0;
          
          // Calculate position along the path
          let position;
          
          if (branch.type === 'main') {
            // Simple linear interpolation for main branch
            const totalLength = branch.points.length - 1;
            const segmentProgress = branch.animationProgress * totalLength;
            const segmentIndex = Math.floor(segmentProgress);
            const pointProgress = segmentProgress - segmentIndex;
            
            if (segmentIndex < totalLength) {
              const start = branch.points[segmentIndex];
              const end = branch.points[segmentIndex + 1];
              
              position = {
                x: start.x + (end.x - start.x) * pointProgress,
                y: start.y + (end.y - start.y) * pointProgress
              };
            } else {
              position = branch.points[totalLength];
            }
          } else {
            // For curves, use the appropriate position calculation
            const t = branch.animationProgress;
            const points = branch.points;
            
            if (t < 0.3) {
              // First segment: main to branch start (curved)
              const segmentT = t / 0.3;
              const p0 = points[0]; // Main branch point
              const p1 = points[1]; // Control point
              const p2 = points[2]; // Branch start point
              
              position = {
                x: Math.pow(1 - segmentT, 2) * p0.x + 2 * (1 - segmentT) * segmentT * p1.x + Math.pow(segmentT, 2) * p2.x,
                y: Math.pow(1 - segmentT, 2) * p0.y + 2 * (1 - segmentT) * segmentT * p1.y + Math.pow(segmentT, 2) * p2.y
              };
            } else if (t < 0.7) {
              // Middle segment: branch line (straight)
              const segmentT = (t - 0.3) / 0.4;
              const p2 = points[2]; // Branch start
              const p3 = points[3]; // Branch end
              
              position = {
                x: p2.x + (p3.x - p2.x) * segmentT,
                y: p2.y + (p3.y - p2.y) * segmentT
              };
            } else {
              // Last segment: branch end to main (curved)
              const segmentT = (t - 0.7) / 0.3;
              const p3 = points[3]; // Branch end point
              const p4 = points[4]; // Control point
              const p5 = points[5]; // Main merge point
              
              position = {
                x: Math.pow(1 - segmentT, 2) * p3.x + 2 * (1 - segmentT) * segmentT * p4.x + Math.pow(segmentT, 2) * p5.x,
                y: Math.pow(1 - segmentT, 2) * p3.y + 2 * (1 - segmentT) * segmentT * p4.y + Math.pow(segmentT, 2) * p5.y
              };
            }
          }
          
          // Draw the particle
          ctx.beginPath();
          ctx.fillStyle = branch.color;
          ctx.arc(position.x, position.y, branch.width + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Draw branch nodes
      branchNodes.forEach(node => {
        // Check if it's a branch label
        if (!node.radius) {
          // Draw branch label
          ctx.fillStyle = node.color;
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = node.align || 'center';
          ctx.fillText(node.text, node.x, node.y + 5);
          
          // Draw label line
          ctx.beginPath();
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.moveTo(node.x + (node.align === 'left' ? 5 + ctx.measureText(node.text).width : 0), node.y);
          ctx.lineTo(node.x + 40, node.y);
          ctx.stroke();
          
          return;
        }
        
        // Draw special glow for branch/merge points
        if (node.isBranchPoint || node.isMergePoint) {
          ctx.beginPath();
          const outerGlow = ctx.createRadialGradient(
            node.x, node.y, node.radius * 0.5,
            node.x, node.y, node.radius * 3
          );
          outerGlow.addColorStop(0, `${node.color}70`);
          outerGlow.addColorStop(1, `${node.color}00`);
          ctx.fillStyle = outerGlow;
          ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw node circle
        ctx.beginPath();
        ctx.fillStyle = node.color;
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add subtle glow effect
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
          node.x, node.y, node.radius * 0.5,
          node.x, node.y, node.radius * 2
        );
        gradient.addColorStop(0, `${node.color}50`);
        gradient.addColorStop(1, `${node.color}00`);
        ctx.fillStyle = gradient;
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw label above the node
        if (node.label) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - node.radius - 8);
        }
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  return (
    <>
      <Head>
        <title>Parallels - Git Branch Visualization</title>
        <meta name="description" content="Interactive Git branch visualization" />
      </Head>
      
      <div className={styles.container} ref={containerRef}>
        <div className={styles.header}>
          <h1>Parallels</h1>
          <p>Git Branching Workflow</p>
        </div>
        
        <canvas 
          ref={canvasRef} 
          className={styles.canvas}
        />
        
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: colorScheme.main }}></span>
            <span>Main Branch</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: colorScheme.feature }}></span>
            <span>Feature Branch</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: colorScheme.hotfix }}></span>
            <span>Hotfix Branch</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default ParallelsPage; 