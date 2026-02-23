import { useRef, useEffect, useState } from 'react'
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey'

const typeColors = {
  unit: '#3b82f6',
  external_input: '#4ade80',
  external_output: '#f59e0b',
  losses: '#f87171',
}

export default function SankeyDiagram({ sankeyData }) {
  const svgRef = useRef()
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) return
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 900
    const height = Math.max(500, sankeyData.nodes.length * 50)

    const validLinks = sankeyData.links.filter(
      l => l.source !== l.target && l.value > 0
    )

    if (validLinks.length === 0) {
      svg.innerHTML = '<text x="50%" y="50%" fill="#94a3b8" text-anchor="middle" font-size="14">Нет связей для отображения</text>'
      return
    }

    const layout = d3Sankey()
      .nodeId(d => d.index)
      .nodeWidth(22)
      .nodePadding(16)
      .extent([[10, 10], [width - 10, height - 10]])

    const graph = layout({
      nodes: sankeyData.nodes.map((n, i) => ({ ...n, index: i })),
      links: validLinks.map(l => ({ ...l })),
    })

    let svgContent = ''

    // Links
    graph.links.forEach((link, idx) => {
      const path = sankeyLinkHorizontal()(link)
      const isLoss = link.loss > 0
      const color = isLoss ? '#f87171' : '#3b82f6'
      const opacity = isLoss ? 0.45 : 0.25
      const w = Math.max(1, link.width)
      svgContent += `<path class="sankey-link" data-idx="${idx}" d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${w}" style="cursor:pointer" />`

      // Label on the link: product name + tons
      const midX = (link.source.x1 + link.target.x0) / 2
      const midY = (link.y0 + link.y1) / 2
      const labelText = `${link.product}: ${link.value.toFixed(1)} т`
      if (w > 4) {
        svgContent += `<text x="${midX}" y="${midY}" dy="0.35em" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Inter, sans-serif" pointer-events="none">${labelText.length > 35 ? labelText.slice(0, 33) + '...' : labelText}</text>`
      }
    })

    // Nodes
    graph.nodes.forEach(node => {
      const color = typeColors[node.type] || '#3b82f6'
      const h = Math.max(1, node.y1 - node.y0)
      svgContent += `<rect x="${node.x0}" y="${node.y0}" width="${node.x1 - node.x0}" height="${h}" fill="${color}" rx="3" />`

      // Node label
      const labelX = node.x0 < width / 2 ? node.x1 + 8 : node.x0 - 8
      const anchor = node.x0 < width / 2 ? 'start' : 'end'
      const labelY = (node.y0 + node.y1) / 2
      const shortName = node.name.length > 28 ? node.name.slice(0, 26) + '...' : node.name
      svgContent += `<text x="${labelX}" y="${labelY}" dy="-0.2em" text-anchor="${anchor}" fill="#e2e8f0" font-size="11" font-weight="600" font-family="Inter, sans-serif">${shortName}</text>`

      // Sum of inputs / outputs for unit nodes
      if (node.type === 'unit') {
        const totalIn = (node.targetLinks || []).reduce((s, l) => s + l.value, 0)
        const totalOut = (node.sourceLinks || []).reduce((s, l) => s + l.value, 0)
        if (totalIn > 0 || totalOut > 0) {
          svgContent += `<text x="${labelX}" y="${labelY}" dy="1.0em" text-anchor="${anchor}" fill="#64748b" font-size="9" font-family="Inter, sans-serif">вх ${totalIn.toFixed(0)} / вых ${totalOut.toFixed(0)} т</text>`
        }
      }
    })

    svg.innerHTML = svgContent
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

    // Hover events
    svg.querySelectorAll('.sankey-link').forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const idx = parseInt(el.dataset.idx)
        const link = graph.links[idx]
        if (!link) return
        el.setAttribute('stroke-opacity', '0.7')
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          product: link.product,
          sourceName: link.source_name || link.source?.name || '',
          targetName: link.target_name || link.target?.name || '',
          value: link.value,
          inputValue: link.input_value || 0,
          loss: link.loss || 0,
        })
      })
      el.addEventListener('mouseleave', () => {
        const isLoss = el.getAttribute('stroke') === '#f87171'
        el.setAttribute('stroke-opacity', isLoss ? '0.45' : '0.25')
        setTooltip(null)
      })
    })
  }, [sankeyData])

  if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для Sankey</div>
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 overflow-x-auto relative">
      <svg ref={svgRef} width="100%" height={Math.max(500, sankeyData.nodes.length * 50)} />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[#0c1529] border border-dark-border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-semibold text-dark-text mb-1">{tooltip.product}</div>
          <div className="text-dark-muted">{tooltip.sourceName} → {tooltip.targetName}</div>
          <div className="text-dark-text mt-1">Выход: {tooltip.value.toFixed(1)} т</div>
          {tooltip.inputValue > 0 && (
            <div className="text-dark-text">Вход: {tooltip.inputValue.toFixed(1)} т</div>
          )}
          {tooltip.loss !== 0 && (
            <div className={tooltip.loss > 0 ? 'text-accent-red' : 'text-accent-green'}>
              Потери: {tooltip.loss > 0 ? '+' : ''}{tooltip.loss.toFixed(1)} т
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-3 text-xs text-dark-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-blue" /> Установки</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-green" /> Внешнее сырьё</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-yellow" /> Внешняя продукция</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-red" /> Потери</span>
      </div>
    </div>
  )
}
