import { useMemo, useState } from 'react'
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey'

const TYPE_COLORS = {
  unit: '#3b82f6',
  external_input: '#4ade80',
  external_output: '#f59e0b',
  losses: '#f87171',
}

export default function SankeyDiagram({ sankeyData }) {
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredLink, setHoveredLink] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  const layout = useMemo(() => {
    if (!sankeyData?.nodes?.length || !sankeyData?.links?.length) return null

    const validLinks = sankeyData.links.filter(l => l.source !== l.target && l.value > 0)
    if (!validLinks.length) return null

    const nodeCount = sankeyData.nodes.length
    const width = 960
    const height = Math.max(500, nodeCount * 40)

    try {
      const nodesClone = sankeyData.nodes.map((n, i) => ({ ...n, _idx: i }))
      const linksClone = validLinks.map(l => ({ ...l, source: l.source, target: l.target }))

      const generator = d3Sankey()
        .nodeId(d => d._idx)
        .nodeWidth(20)
        .nodePadding(Math.max(6, Math.min(16, 400 / nodeCount)))
        .nodeAlign(sankeyJustify)
        .extent([[10, 10], [width - 10, height - 10]])
        .iterations(6)

      const graph = generator({ nodes: nodesClone, links: linksClone })

      return { nodes: graph.nodes, links: graph.links, width, height }
    } catch (e) {
      console.error('Sankey layout error:', e)
      return null
    }
  }, [sankeyData])

  if (!layout) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для построения диаграммы</div>
  }

  const { nodes, links, width, height } = layout

  const isConnected = (nodeIdx) => {
    if (hoveredNode === null) return true
    return nodeIdx === hoveredNode ||
      links.some(l =>
        (l.source.index === hoveredNode && l.target.index === nodeIdx) ||
        (l.target.index === hoveredNode && l.source.index === nodeIdx)
      )
  }

  const isLinkHighlighted = (link) => {
    if (hoveredNode !== null) {
      return link.source.index === hoveredNode || link.target.index === hoveredNode
    }
    if (hoveredLink !== null) return hoveredLink === link.index
    return true
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="select-none">
        {/* Links */}
        {links.map((link, i) => {
          const path = sankeyLinkHorizontal()(link)
          const isLoss = (link.loss || 0) > 0
          const color = isLoss ? '#f87171' : '#3b82f6'
          const highlighted = isLinkHighlighted(link)
          return (
            <path
              key={`link-${i}`}
              d={path}
              fill="none"
              stroke={color}
              strokeOpacity={highlighted ? 0.4 : 0.06}
              strokeWidth={Math.max(1, link.width)}
              style={{ cursor: 'pointer', transition: 'stroke-opacity 0.2s' }}
              onMouseEnter={(e) => {
                setHoveredLink(link.index)
                setTooltip({
                  x: e.clientX, y: e.clientY,
                  content: (
                    <>
                      <div className="font-semibold">{link.product || 'Поток'}</div>
                      {link.product_count > 1 && <div className="text-[10px] opacity-70">{link.product_count} продуктов</div>}
                      <div className="opacity-70">{link.source_name || link.source?.name} → {link.target_name || link.target?.name}</div>
                      <div className="mt-1">Объём: {link.value?.toFixed(1)} т</div>
                      {link.output_value > 0 && <div>Выход: {link.output_value?.toFixed(1)} т</div>}
                      {link.input_value > 0 && <div>Вход: {link.input_value?.toFixed(1)} т</div>}
                      {link.loss !== 0 && (
                        <div className={link.loss > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>
                          Потери: {link.loss > 0 ? '+' : ''}{link.loss?.toFixed(1)} т
                        </div>
                      )}
                    </>
                  )
                })
              }}
              onMouseLeave={() => { setHoveredLink(null); setTooltip(null) }}
            />
          )
        })}

        {/* Link labels */}
        {links.map((link, i) => {
          if (link.width < 3) return null
          const midX = (link.source.x1 + link.target.x0) / 2
          const midY = (link.y0 + link.y1) / 2
          const label = `${(link.product || '').slice(0, 30)}: ${link.value?.toFixed(0)}т`
          return (
            <text key={`label-${i}`} x={midX} y={midY} dy="0.35em"
              textAnchor="middle" fill="#94a3b8" fontSize={link.width > 6 ? 10 : 9}
              pointerEvents="none" opacity={isLinkHighlighted(link) ? 0.9 : 0.2}
            >{label}</text>
          )
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const color = TYPE_COLORS[node.type] || '#3b82f6'
          const h = Math.max(2, node.y1 - node.y0)
          const connected = isConnected(i)
          const labelX = node.x0 < width / 2 ? node.x1 + 8 : node.x0 - 8
          const anchor = node.x0 < width / 2 ? 'start' : 'end'
          const labelY = (node.y0 + node.y1) / 2
          const shortName = node.name?.length > 25 ? node.name.slice(0, 23) + '…' : node.name

          const totalIn = (node.targetLinks || []).reduce((s, l) => s + l.value, 0)
          const totalOut = (node.sourceLinks || []).reduce((s, l) => s + l.value, 0)

          return (
            <g key={`node-${i}`}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              opacity={connected ? 1 : 0.15}
              onMouseEnter={() => setHoveredNode(i)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <rect x={node.x0} y={node.y0} width={node.x1 - node.x0} height={h}
                fill={color} rx={3}
                stroke={hoveredNode === i ? '#fff' : 'none'} strokeWidth={hoveredNode === i ? 2 : 0}
              />
              <text x={labelX} y={labelY} dy="-0.3em" textAnchor={anchor}
                fill="#e2e8f0" fontSize={11} fontWeight={600}
              >{shortName}</text>
              {node.type === 'unit' && (totalIn > 0 || totalOut > 0) && (
                <text x={labelX} y={labelY} dy="0.9em" textAnchor={anchor}
                  fill="#94a3b8" fontSize={9}
                >вх {totalIn.toFixed(0)} / вых {totalOut.toFixed(0)} т</text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none bg-slate-100 border-slate-300 text-slate-900"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-dark-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: TYPE_COLORS.unit }} /> Установки</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: TYPE_COLORS.external_input }} /> Внешнее сырьё</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: TYPE_COLORS.external_output }} /> Внешняя продукция</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: TYPE_COLORS.losses }} /> Потери</span>
      </div>
    </div>
  )
}
