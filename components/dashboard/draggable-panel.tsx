/**
 * components/dashboard/draggable-panel.tsx
 *
 * ----------------------------------------------------------------------
 *  PURPOSE
 * ----------------------------------------------------------------------
 * DraggablePanel is a generic, reusable window chrome for the dashboard.
 * It wraps arbitrary children in a floating, draggable, resizable card
 * (via `react-rnd`) with a glass‑morphism header that shows a title,
 * optional icon, and a close button. It's used to host any dashboard
 * widget — e.g. node readings, charts, or logs — as a movable panel on
 * the map canvas rather than a fixed-position element.
 *
 * ----------------------------------------------------------------------
 *  BEHAVIOR
 * ----------------------------------------------------------------------
 *  - Positioning: starts at (defaultX, defaultY), default size
 *    (defaultWidth x defaultHeight). Position/size are uncontrolled after
 *    mount — react-rnd manages drag/resize state internally.
 *  - Dragging is restricted to the header via `dragHandleClassName`, so
 *    interacting with panel content never triggers a drag.
 *  - Resizing is clamped to a 300x300 minimum and constrained to the
 *    browser window (`bounds="window"`).
 *  - Closing is handled by the parent: this component is purely
 *    presentational and calls `onClose` on click, without managing its
 *    own open/closed state.
 *
 * ----------------------------------------------------------------------
 *  FIX LOG (this pass)
 * ----------------------------------------------------------------------
 *  Removed `WebkitAppRegion: 'drag'` from the header's inline style.
 *  That's an Electron-only CSS property (used to make regions of a
 *  desktop window draggable) and isn't a member of React's
 *  `CSSProperties` type. Since this is a web app, not an Electron
 *  shell, the cast (`as React.CSSProperties`) was papering over what
 *  would otherwise be a TypeScript compile error. Left in place, this
 *  can break the build depending on tsconfig strictness — dragging
 *  itself is already fully handled by react-rnd's `dragHandleClassName`,
 *  so the property added no functional value here.
 *
 * ----------------------------------------------------------------------
 *  PUBLIC API
 * ----------------------------------------------------------------------
 *  - id: string – unique identifier for the panel instance (useful for
 *    parent components tracking multiple open panels).
 *  - title: string – header text.
 *  - children: ReactNode – panel body content.
 *  - onClose: () => void – called when the close (X) button is clicked.
 *  - defaultX / defaultY?: number – initial position in pixels.
 *  - defaultWidth / defaultHeight?: number | string – initial size.
 *  - icon?: ReactNode – optional icon rendered before the title.
 */
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
        <div className="drag-handle flex items-center justify-between px-6 py-4 border-b border-white/10 cursor-move hover:bg-white/5 transition-colors">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={`Close ${title} panel`}
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