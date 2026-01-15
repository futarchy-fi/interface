"use client";

import React from "react";
import { Responsive, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface DraggableGridProps {
    children: React.ReactNode[];
}

export const DraggableGrid: React.FC<DraggableGridProps> = ({ children }) => {
    // Default Layout for demo purposes
    const layout = [
        { i: "company-table", x: 0, y: 0, w: 12, h: 10 },
        { i: "market-chart", x: 0, y: 10, w: 6, h: 8 },
        { i: "portfolio", x: 6, y: 10, w: 6, h: 8 },
    ];

    const layouts = { lg: layout, md: layout, sm: layout };

    return (
        <div className="w-full min-h-screen p-6">
            <Responsive
                className="layout"
                layouts={layouts as any}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={30}
                width={1200}
                {...({ isDraggable: true, isResizable: true, useCSSTransforms: true } as any)}
            >
                <div key="company-table">
                    {children[0]}
                </div>
            </Responsive>
        </div>
    );
};

// Simplified Grid for Phase 1 (CSS Grid) if RGL is too complex to setup without width provider
export const SimpleGrid: React.FC<{ children: React.ReactNode; sidebar?: React.ReactNode }> = ({ children, sidebar }) => {
    return (
        <div className="grid grid-cols-12 gap-6 p-6">
            <div className="col-span-12 lg:col-span-8">
                {children}
            </div>
            <div className="col-span-12 lg:col-span-4">
                {sidebar}
            </div>
        </div>
    )
}
