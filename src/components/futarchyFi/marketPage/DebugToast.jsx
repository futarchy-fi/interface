import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DebugToast = ({ debugData }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [logs, setLogs] = useState([]);
    const maxLogs = 100; // Keep last 100 logs

    useEffect(() => {
        if (debugData) {
            setLogs(prevLogs => {
                const newLogs = [...prevLogs, {
                    timestamp: new Date().toISOString(),
                    data: debugData
                }].slice(-maxLogs);
                return newLogs;
            });
        }
    }, [debugData]);

    const formatValue = (value) => {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const renderDebugItem = (key, value) => {
        const formattedValue = formatValue(value);
        const isObject = typeof value === 'object' && value !== null;
        
        return (
            <div key={key} className="mb-1 border-b border-futarchyGray6 last:border-0">
                <div className="text-xs font-mono">
                    <span className="text-futarchyBlue11">{key}:</span>
                    {isObject ? (
                        <pre className="text-futarchyGray11 whitespace-pre-wrap ml-2 text-[10px]">
                            {formattedValue}
                        </pre>
                    ) : (
                        <span className="text-futarchyGray11 ml-2">{formattedValue}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            className="fixed left-4 bottom-4 z-50 max-w-md"
        >
            <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-futarchyGray6 
                ${isExpanded ? 'w-96' : 'w-48'}`}
            >
                {/* Header */}
                <div 
                    className="flex items-center justify-between p-2 bg-futarchyGray4 rounded-t-lg cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <span className="text-xs font-medium text-futarchyGray12">
                        🐛 Debug Mode {isExpanded ? '(Click to Collapse)' : '(Click to Expand)'}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="animate-pulse w-2 h-2 rounded-full bg-futarchyGreen9"></span>
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="max-h-[70vh] overflow-y-auto p-3">
                                {logs.map((log, index) => (
                                    <div key={index} className="mb-4 last:mb-0">
                                        <div className="text-[10px] text-futarchyGray11 mb-1">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </div>
                                        {Object.entries(log.data).map(([key, value]) => 
                                            renderDebugItem(key, value)
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default DebugToast; 