'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Zap, Radio, Activity, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Node {
  id: string
  name: string
  latitude: string
  longitude: string
  isActive: boolean
  mode: string
  pingStatus?: string
  lastPingTime?: string
}

interface NodeManagementPanelProps {
  nodes: Node[]
  onAddNode: () => void
  onSimulate: (nodeId: string) => void
  onTestPing: (nodeId: string) => void
  onClose: () => void
}

export function NodeManagementPanel({
  nodes,
  onAddNode,
  onSimulate,
  onTestPing,
  onClose,
}: NodeManagementPanelProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-card rounded-2xl p-6 h-full overflow-y-auto max-h-[80vh]"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Nodes Management
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Add Node Button */}
      <button
        onClick={onAddNode}
        className="w-full glass-button mb-4 flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40"
      >
        <Plus className="w-4 h-4" />
        Add New Node
      </button>

      {/* Nodes List */}
      <div className="space-y-3">
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-white">{node.name}</h4>
                <p className="text-xs text-white/50">
                  {node.latitude}, {node.longitude}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    node.pingStatus === 'active'
                      ? 'bg-green-400'
                      : 'bg-red-400'
                  }`}
                />
                <span className="text-xs text-white/60">
                  {node.pingStatus === 'active' ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-3">
              <span className={`text-xs px-2 py-1 rounded-full ${
                node.mode === 'realtime'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-purple-500/20 text-purple-300'
              }`}>
                {node.mode === 'realtime' ? 'Real-time' : 'Manual'}
              </span>
            </div>

            {expandedNode === node.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 border-t border-white/10 space-y-2"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSimulate(node.id)
                  }}
                  className="w-full text-sm glass-button flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Simulate Reading
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTestPing(node.id)
                  }}
                  className="w-full text-sm glass-button flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 border border-green-400/40"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Ping Test
                </button>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {nodes.length === 0 && (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/50">No nodes added yet</p>
        </div>
      )}
    </motion.div>
  )
}
