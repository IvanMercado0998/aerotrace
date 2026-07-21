'use client'

import React from 'react'
import { Rnd } from 'react-rnd'
import { X } from 'lucide-react'

interface DraggablePanelProps {
  id: string
  title: string
  children: React.ReactNode
  onClose: () => void
  defaultX?: number
  defaultY?: number
  defaultWidth?: number | string
  defaultHeight?: number | string
  icon?: React.ReactNode
}

export function DraggablePanel({
  id,
  title,
  children,
  onClose,
  defaultX = 20,
  defaultY = 100,
  defaultWidth = 400,
  defaultHeight = 500,
  icon,
}: DraggablePanelProps) {
  return (
    <Rnd
      default={{
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight,
      }}
      minWidth={300}
      minHeight={300}
      bounds="window"
      dragHandleClassName="drag-handle"
    >
      <div className="glass-card rounded-2xl h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div
          className="drag-handle flex items-center justify-between px-6 py-4 border-b border-white/10 cursor-move hover:bg-white/5 transition-colors"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </Rnd>
  )
}
