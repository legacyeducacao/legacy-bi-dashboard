import React, { useState, useRef, useEffect } from 'react';
import {
  Square,
  Circle,
  Diamond,
  StickyNote,
  Type,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
  Scaling,
  Filter,
  User,
  Target,
  Share2,
  Move // Added icon for panning visual
} from 'lucide-react';
import { BoardNode, BoardConnection, NodeType } from '../types';

interface WhiteboardProps {
  isDarkMode: boolean;
}

const GRID_SIZE = 20;
const MIN_SIZE = 40;

const Whiteboard: React.FC<WhiteboardProps> = ({ isDarkMode }) => {
  // --- State ---
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [connections, setConnections] = useState<BoardConnection[]>([]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Interaction State
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Dragging States
  const [isDraggingNode, setIsDraggingNode] = useState<boolean>(false);
  const [isResizingNode, setIsResizingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // New state for Space bar

  // Selection Box State
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Connection Draft State
  const [draftConnection, setDraftConnection] = useState<{
    fromId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<NodeType | null>(null);
  const resizeStartDims = useRef<{ w: number, h: number } | null>(null);

  // --- Helpers ---
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const getClientCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const screenToCanvas = (sx: number, sy: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (sx - rect.left - pan.x) / scale,
      y: (sy - rect.top - pan.y) / scale
    };
  };

  const getDefaultDimensions = (type: NodeType) => {
    switch (type) {
      case 'circle': return { w: 100, h: 100 };
      case 'diamond': return { w: 100, h: 100 };
      case 'text': return { w: 150, h: 50 };
      case 'funnel': return { w: 160, h: 100 };
      case 'persona': return { w: 140, h: 180 };
      case 'campaign': return { w: 180, h: 100 };
      case 'channel': return { w: 80, h: 80 };
      default: return { w: 150, h: 80 };
    }
  };

  const getNodeCenter = (node: BoardNode) => {
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2
    };
  };

  // --- Effects ---

  // Space Bar Listener for Panning Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if editing text
      if (editingNodeId) return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (!isPanning) {
          // Ensure we stop panning logic visually if we released space without clicking
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingNodeId, isPanning]);


  // --- Curve Calculation Logic ---

  const getNodePorts = (node: BoardNode) => {
    return {
      top: { x: node.x + node.width / 2, y: node.y },
      right: { x: node.x + node.width, y: node.y + node.height / 2 },
      bottom: { x: node.x + node.width / 2, y: node.y + node.height },
      left: { x: node.x, y: node.y + node.height / 2 }
    };
  };

  const getSmartPath = (
    startNode: BoardNode,
    endTarget: BoardNode | { x: number, y: number, width: number, height: number }
  ) => {
    const startPorts = getNodePorts(startNode);

    const isNode = 'id' in endTarget;
    const endCenter = {
      x: endTarget.x + endTarget.width / 2,
      y: endTarget.y + endTarget.height / 2
    };

    const startCenter = getNodeCenter(startNode);
    const dx = endCenter.x - startCenter.x;
    const dy = endCenter.y - startCenter.y;

    let startPoint = startPorts.right;
    let endPoint = { x: endCenter.x, y: endCenter.y };
    let startControl = { x: 0, y: 0 };
    let endControl = { x: 0, y: 0 };

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        startPoint = startPorts.right;
        if (isNode) endPoint = getNodePorts(endTarget as BoardNode).left;
        else endPoint = { x: endTarget.x, y: endCenter.y };
      } else {
        startPoint = startPorts.left;
        if (isNode) endPoint = getNodePorts(endTarget as BoardNode).right;
        else endPoint = { x: endTarget.x + endTarget.width, y: endCenter.y };
      }
      const curvature = Math.max(Math.abs(dx) * 0.5, 50);
      startControl = { x: startPoint.x + (dx > 0 ? curvature : -curvature), y: startPoint.y };
      endControl = { x: endPoint.x + (dx > 0 ? -curvature : curvature), y: endPoint.y };

    } else {
      if (dy > 0) {
        startPoint = startPorts.bottom;
        if (isNode) endPoint = getNodePorts(endTarget as BoardNode).top;
        else endPoint = { x: endCenter.x, y: endTarget.y };
      } else {
        startPoint = startPorts.top;
        if (isNode) endPoint = getNodePorts(endTarget as BoardNode).bottom;
        else endPoint = { x: endCenter.x, y: endTarget.y + endTarget.height };
      }
      const curvature = Math.max(Math.abs(dy) * 0.5, 50);
      startControl = { x: startPoint.x, y: startPoint.y + (dy > 0 ? curvature : -curvature) };
      endControl = { x: endPoint.x, y: endPoint.y + (dy > 0 ? -curvature : curvature) };
    }

    return `M ${startPoint.x} ${startPoint.y} C ${startControl.x} ${startControl.y}, ${endControl.x} ${endControl.y}, ${endPoint.x} ${endPoint.y}`;
  };


  // --- Handlers: Sidebar Drag ---
  const handleSidebarDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('nodeType', type);
    dragItemRef.current = type;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as NodeType;
    if (!type) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const defaults = getDefaultDimensions(type);

    let defaultContent = 'Texto';
    if (type === 'sticky') defaultContent = 'Nota';
    if (type === 'funnel') defaultContent = 'Etapa Funil';
    if (type === 'persona') defaultContent = 'Nome Persona';
    if (type === 'campaign') defaultContent = 'Nome Campanha';
    if (type === 'channel') defaultContent = 'Canal';

    const newNode: BoardNode = {
      id: generateId(),
      type,
      x: x - (defaults.w / 2),
      y: y - (defaults.h / 2),
      width: defaults.w,
      height: defaults.h,
      content: defaultContent,
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIds([newNode.id]);
    setEditingNodeId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // --- Handlers: Canvas Interaction ---
  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getClientCoordinates(e);

    // 1. Pan Logic 
    // Trigger if Middle Click (button 1) OR (Left Click + Space Bar)
    if (e.button === 1 || (isSpacePressed && e.button === 0)) {
      e.preventDefault(); // Prevent text selection or browser scrolling
      setIsPanning(true);
      setDragStart({ x, y });
      return;
    }

    // 2. Selection Box Logic (Left Click on background)
    if (e.button === 0 && !draftConnection) {
      const canvasPos = screenToCanvas(x, y);
      setSelectionBox({
        startX: canvasPos.x,
        startY: canvasPos.y,
        currentX: canvasPos.x,
        currentY: canvasPos.y
      });
      setSelectedNodeIds([]);
      setEditingNodeId(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    // If Space is pressed, we want to PAN, not select the node
    if (isSpacePressed) return;

    e.stopPropagation();

    if (editingNodeId === id) return;

    let newSelection = [...selectedNodeIds];

    if (!selectedNodeIds.includes(id)) {
      newSelection = [id];
      setSelectedNodeIds([id]);
    }

    setEditingNodeId(null);
    setIsDraggingNode(true);
    const { x, y } = getClientCoordinates(e);
    setDragStart({ x, y });
  };

  // Start Resize
  const handleResizeStart = (e: React.MouseEvent, nodeId: string) => {
    // If Space is pressed, ignore resize handle
    if (isSpacePressed) return;

    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsResizingNode(nodeId);
    resizeStartDims.current = { w: node.width, h: node.height };
    const { x, y } = getClientCoordinates(e);
    setDragStart({ x, y });
  };

  // Start Connection Drag
  const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
    if (isSpacePressed) return;

    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const center = getNodeCenter(node);
    const { x: mouseX, y: mouseY } = getClientCoordinates(e);
    const canvasPos = screenToCanvas(mouseX, mouseY);

    setDraftConnection({
      fromId: nodeId,
      fromX: center.x,
      fromY: center.y,
      toX: canvasPos.x,
      toY: canvasPos.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getClientCoordinates(e);
    const canvasPos = screenToCanvas(x, y);

    if (isPanning) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x, y });
    }
    else if (isDraggingNode) {
      const dx = (x - dragStart.x) / scale;
      const dy = (y - dragStart.y) / scale;

      setNodes(prev => prev.map(n => {
        if (selectedNodeIds.includes(n.id)) {
          return { ...n, x: n.x + dx, y: n.y + dy };
        }
        return n;
      }));
      setDragStart({ x, y });
    }
    else if (isResizingNode && resizeStartDims.current) {
      const dx = (x - dragStart.x) / scale;
      const dy = (y - dragStart.y) / scale;

      const startW = resizeStartDims.current.w;
      const startH = resizeStartDims.current.h;

      setNodes(prev => prev.map(n => {
        if (n.id === isResizingNode) {
          return {
            ...n,
            width: Math.max(MIN_SIZE, startW + dx),
            height: Math.max(MIN_SIZE, startH + dy)
          };
        }
        return n;
      }));
    }
    else if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, currentX: canvasPos.x, currentY: canvasPos.y } : null);

      const x1 = Math.min(selectionBox.startX, canvasPos.x);
      const y1 = Math.min(selectionBox.startY, canvasPos.y);
      const x2 = Math.max(selectionBox.startX, canvasPos.x);
      const y2 = Math.max(selectionBox.startY, canvasPos.y);

      const newSelectedIds = nodes.filter(node => {
        return (
          node.x < x2 &&
          node.x + node.width > x1 &&
          node.y < y2 &&
          node.y + node.height > y1
        );
      }).map(n => n.id);

      setSelectedNodeIds(newSelectedIds);
    }
    else if (draftConnection) {
      setDraftConnection(prev => prev ? {
        ...prev,
        toX: canvasPos.x,
        toY: canvasPos.y
      } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    setIsDraggingNode(false);
    setIsResizingNode(null);
    setSelectionBox(null);
    resizeStartDims.current = null;

    if (draftConnection) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);

      const targetNode = nodes.find(n => {
        if (n.id === draftConnection.fromId) return false;
        return (
          canvasPos.x >= n.x &&
          canvasPos.x <= n.x + n.width &&
          canvasPos.y >= n.y &&
          canvasPos.y <= n.y + n.height
        );
      });

      if (targetNode) {
        const exists = connections.some(
          c => (c.fromId === draftConnection.fromId && c.toId === targetNode.id) ||
            (c.fromId === targetNode.id && c.toId === draftConnection.fromId)
        );

        if (!exists) {
          setConnections(prev => [...prev, {
            id: generateId(),
            fromId: draftConnection.fromId,
            toId: targetNode.id
          }]);
        }
      }

      setDraftConnection(null);
    }
  };

  const deleteSelectedNodes = () => {
    if (selectedNodeIds.length === 0) return;

    setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
    setConnections(prev => prev.filter(c => !selectedNodeIds.includes(c.fromId) && !selectedNodeIds.includes(c.toId)));
    setSelectedNodeIds([]);
    setEditingNodeId(null);
  };

  const updateNodeContent = (id: string, newContent: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content: newContent } : n));
  };

  // --- Renderers ---
  // (Previously defined renderEditableContent and renderNodeShape functions here...)
  const renderEditableContent = (node: BoardNode, isEditing: boolean) => {
    if (isEditing) {
      return (
        <textarea
          autoFocus
          className="w-full h-full bg-transparent resize-none outline-none text-center text-sm pointer-events-auto"
          style={{ lineHeight: '1.2' }}
          defaultValue={node.content}
          onBlur={(e) => {
            updateNodeContent(node.id, e.target.value);
            setEditingNodeId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      );
    }
    return node.content;
  };

  const renderNodeShape = (node: BoardNode, isEditing: boolean) => {
    const commonClasses = "w-full h-full flex items-center justify-center text-center p-2 text-sm break-words leading-tight transition-colors";

    switch (node.type) {
      case 'rectangle':
        return (
          <div className={`${commonClasses} bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-sm group-hover:border-brand-primary`}>
            {renderEditableContent(node, isEditing)}
          </div>
        );
      case 'circle':
        return (
          <div className={`${commonClasses} bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full shadow-sm group-hover:border-brand-primary`}>
            {renderEditableContent(node, isEditing)}
          </div>
        );
      case 'diamond':
        return (
          <div className="w-full h-full flex items-center justify-center relative">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <polygon points="50,0 100,50 50,100 0,50"
                className="fill-white dark:fill-slate-800 stroke-2 stroke-slate-300 dark:stroke-slate-600 group-hover:stroke-brand-primary transition-colors vector-effect-non-scaling-stroke"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={`${commonClasses} relative z-10 w-[70%] h-[70%]`}>
              {renderEditableContent(node, isEditing)}
            </div>
          </div>
        );
      case 'sticky':
        return (
          <div className={`${commonClasses} bg-amber-200 dark:bg-amber-400/90 text-slate-900 shadow-md`}>
            {renderEditableContent(node, isEditing)}
          </div>
        );
      case 'text':
        return (
          <div className={`${commonClasses} text-lg font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700`}>
            {renderEditableContent(node, isEditing)}
          </div>
        );
      case 'funnel':
        return (
          <div className="w-full h-full flex items-center justify-center relative">
            <div
              className="absolute inset-0 w-full h-full bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-600 group-hover:border-brand-primary transition-colors shadow-sm"
              style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 15% 100%)' }}
            />
            <div className={`${commonClasses} relative z-10 w-[60%] h-[80%] text-indigo-900 dark:text-indigo-100 font-medium`}>
              {renderEditableContent(node, isEditing)}
            </div>
          </div>
        );
      case 'persona':
        return (
          <div className="w-full h-full flex flex-col bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden shadow-sm group-hover:border-brand-primary transition-colors">
            <div className="h-1/3 bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-b border-slate-200 dark:border-slate-600">
              <User className="w-8 h-8 text-slate-400 dark:text-slate-300" />
            </div>
            <div className="h-2/3 p-2 flex items-center justify-center text-center text-sm leading-tight text-slate-700 dark:text-slate-200">
              {renderEditableContent(node, isEditing)}
            </div>
          </div>
        );
      case 'campaign':
        return (
          <div className="w-full h-full flex flex-col bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden shadow-sm group-hover:border-brand-primary transition-colors">
            <div className="h-2 w-full bg-brand-primary"></div>
            <div className="flex-1 p-2 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Campanha</span>
              <div className="flex-1 flex items-center justify-center text-center font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {renderEditableContent(node, isEditing)}
              </div>
            </div>
          </div>
        );
      case 'channel':
        return (
          <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 shadow-sm group-hover:border-brand-primary transition-colors flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-100 dark:to-slate-700/50 pointer-events-none"></div>
            <div className={`${commonClasses} font-semibold text-slate-700 dark:text-slate-200`}>
              {renderEditableContent(node, isEditing)}
            </div>
          </div>
        );
      default: return null;
    }
  };

  // Determine Cursor Style
  const getCursorStyle = () => {
    if (isPanning) return 'cursor-grabbing';
    if (isSpacePressed) return 'cursor-grab';
    if (draftConnection) return 'cursor-crosshair';
    if (selectionBox) return 'cursor-crosshair';
    return 'cursor-default';
  };

  return (
    <div className="flex h-full w-full bg-slate-100 dark:bg-[#0b1121] overflow-hidden relative group">

      {/* --- Toolbar --- */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/50 backdrop-blur-md max-h-[80vh] overflow-y-auto">
        {/* Basic Shapes */}
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 text-center px-1 mt-1">Básico</div>
        {[
          { type: 'rectangle', icon: Square, label: 'Processo' },
          { type: 'circle', icon: Circle, label: 'Inicio/Fim' },
          { type: 'diamond', icon: Diamond, label: 'Decisão' },
          { type: 'sticky', icon: StickyNote, label: 'Nota' },
          { type: 'text', icon: Type, label: 'Texto' },
        ].map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleSidebarDragStart(e, item.type as NodeType)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-grab active:cursor-grabbing text-slate-600 dark:text-slate-300 transition-colors"
            title={item.label}
          >
            <item.icon className="w-6 h-6" />
          </div>
        ))}

        {/* Marketing Widgets */}
        <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 text-center px-1">Marketing</div>

        {[
          { type: 'funnel', icon: Filter, label: 'Etapa Funil' },
          { type: 'persona', icon: User, label: 'Persona' },
          { type: 'campaign', icon: Target, label: 'Campanha' },
          { type: 'channel', icon: Share2, label: 'Canal' },
        ].map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleSidebarDragStart(e, item.type as NodeType)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-grab active:cursor-grabbing text-indigo-500 dark:text-indigo-400 transition-colors"
            title={item.label}
          >
            <item.icon className="w-6 h-6" />
          </div>
        ))}

      </div>

      {/* --- Controls --- */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/50">
        <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-xs w-12 text-center text-slate-500 dark:text-slate-400">{(scale * 100).toFixed(0)}%</span>
        <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button
          onClick={() => { setNodes([]); setConnections([]); }}
          className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 rounded-lg"
          title="Limpar Board"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* --- Help Tip --- */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/80 dark:bg-slate-800/80 px-4 py-2 rounded-full text-xs text-slate-500 dark:text-slate-400 pointer-events-none backdrop-blur border border-slate-200 dark:border-slate-700 flex items-center gap-2">
        {isSpacePressed ? <Move className="w-3 h-3 text-brand-primary" /> : null}
        <span>
          <span className="font-bold">Dica:</span> Segure <span className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Espaço</span> para navegar (Pan).
        </span>
      </div>

      {/* --- Canvas --- */}
      <div
        ref={containerRef}
        className={`flex-1 w-full h-full overflow-hidden relative ${getCursorStyle()}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.05] dark:opacity-[0.08]"
          style={{
            backgroundImage: `radial-gradient(${isDarkMode ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
        />

        {/* --- Content Layer --- */}
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          {/* Connections (SVG Layer) */}
          <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: 1, height: 1 }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={isDarkMode ? '#1895D8' : '#17ADFD'} />
              </marker>
            </defs>

            {/* Existing Connections */}
            {connections.map(conn => {
              const start = nodes.find(n => n.id === conn.fromId);
              const end = nodes.find(n => n.id === conn.toId);
              if (!start || !end) return null;

              const pathData = getSmartPath(start, end);

              return (
                <path
                  key={conn.id}
                  d={pathData}
                  fill="none"
                  stroke={isDarkMode ? '#1895D8' : '#17ADFD'}
                  strokeWidth="2"
                  strokeDasharray="10, 5"
                  className="connection-line"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Draft Line (Dragging) */}
            {draftConnection && (() => {
              const startNode = nodes.find(n => n.id === draftConnection.fromId);
              if (!startNode) return null;

              const draftTarget = {
                x: draftConnection.toX,
                y: draftConnection.toY,
                width: 0,
                height: 0
              };

              const pathData = getSmartPath(startNode, draftTarget);

              return (
                <path
                  d={pathData}
                  fill="none"
                  stroke={isDarkMode ? '#1895D8' : '#17ADFD'}
                  strokeWidth="2"
                  strokeDasharray="5, 5"
                  strokeOpacity="0.6"
                  markerEnd="url(#arrowhead)"
                />
              );
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const isSelected = selectedNodeIds.includes(node.id);
            const isEditing = editingNodeId === node.id;

            return (
              <div
                key={node.id}
                className={`absolute group select-none`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  zIndex: isSelected || isEditing ? 30 : 10
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => {
                  if (isSpacePressed) return;
                  e.stopPropagation();
                  setEditingNodeId(node.id);
                  setIsDraggingNode(false);
                }}
              >
                {/* Visual Node */}
                <div className={`w-full h-full relative transition-all duration-200
                   ${!isPanning && !isSpacePressed ? 'cursor-default' : ''}
                   ${isSelected && !isEditing ? 'ring-2 ring-brand-primary shadow-[0_0_15px_rgba(24,149,216,0.4)]' : ''}
                `}>
                  {renderNodeShape(node, isEditing)}

                  {/* Connector Handle - Right Side (Only show if not editing and NOT panning) */}
                  {!isEditing && !isPanning && !isSpacePressed && (
                    <div
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-2 border-brand-primary rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 z-40 flex items-center justify-center shadow-sm"
                      onMouseDown={(e) => handleConnectionStart(e, node.id)}
                    >
                      <div className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
                    </div>
                  )}

                  {/* Resize Handle - Bottom Right (Only show if selected and NOT editing and NOT panning) */}
                  {isSelected && !isEditing && selectedNodeIds.length === 1 && !isPanning && !isSpacePressed && (
                    <div
                      className="absolute -right-1 -bottom-1 w-4 h-4 cursor-nwse-resize z-40 flex items-center justify-center group/resize"
                      onMouseDown={(e) => handleResizeStart(e, node.id)}
                    >
                      <Scaling className="w-3 h-3 text-brand-primary opacity-50 group-hover/resize:opacity-100" />
                    </div>
                  )}

                </div>

                {/* Selection Controls (Only show if selected and NOT editing) */}
                {isSelected && !isEditing && selectedNodeIds.length === 1 && !isPanning && !isSpacePressed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSelectedNodes(); }}
                    className="absolute -top-3 -right-3 bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600 transition-transform hover:scale-110 z-50"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Selection Box Visual */}
          {selectionBox && (
            <div
              className="absolute border-2 border-brand-primary bg-brand-primary/20 pointer-events-none z-50"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY)
              }}
            />
          )}

        </div>
      </div>
    </div>
  );
};

export default Whiteboard;