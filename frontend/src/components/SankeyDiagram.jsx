import { useRef, useEffect, useState } from 'react'
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey'

export default function SankeyDiagram({ sankeyData, resolved }) {
  const svgRef = useRef()
  const [tooltip, setTooltip] = useState(null)

  const colors = resolved?.colors
  const fontFamily = resolved?.fontFamily || "'Inter', sans-serif"
  const fontSize = resolved?.fontSize

  useEffect(() => {
    if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) return
    const svg = svgRef.current
    if (!svg) return

    const cPrimary = colors?.primary || '#3b82f6'
    const cSuccess = colors?.success || '#4ade80'
    const cWarning = colors?.warning || '#f59e0b'
    const cDanger = colors?.danger || '#f87171'
    const cMuted = colors?.muted || '#94a3b8'
    const labelSize = fontSize?.label || 12
    const axisSize = fontSize?.axis || 11

    const typeColors = {
      unit: cPrimary,
      external_input: cSuccess,
      external_output: cWarning,
      losses: cDanger,
    }

    const width = svg.clientWidth || 900
    const height = Math.max(500, sankeyData.nodes.length * 50)

    const validLinks = sankeyData.links.filter(
      l => l.source !== l.target && l.value > 0
    )

    if (validLinks.length === 0) {
      svg.innerHTML = `<text x="50%" y="50%" fill="${cMuted}" text-anchor="middle" font-size="${labelSize}" font-family="${fontFamily}">Нет связей для отображения</text>`
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
      const color = isLoss ? cDanger : cPrimary
      const opacity = isLoss ? 0.45 : 0.25
      const w = Math.max(1, link.width)
      svgContent += `<path class="sankey-link" data-idx="${idx}" data-loss="${isLoss ? '1' : '0'}" d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${w}" style="cursor:pointer" />`

      const midX = (link.source.x1 + link.target.x0) / 2
      const midY = (link.y0 + link.y1) / 2
      const labelText = `${link.product}: ${link.value.toFixed(1)} т`
      const truncLabel = labelText.length > 40 ? labelText.slice(0, 38) + '...' : labelText
      if (w > 2) {
        svgContent += `<text x="${midX}" y="${midY}" dy="0.35em" text-anchor="middle" fill="${cMuted}" font-size="${w > 6 ? axisSize - 1 : axisSize - 2}" font-family="${fontFamily}" pointer-events="none" opacity="${w > 4 ? 1 : 0.7}">${truncLabel}</text>`
      }
    })

    // Nodes
    graph.nodes.forEach(node => {
      const color = typeColors[node.type] || cPrimary
      const h = Math.max(1, node.y1 - node.y0)
      svgContent += `<rect x="${node.x0}" y="${node.y0}" width="${node.x1 - node.x0}" height="${h}" fill="${color}" rx="3" />`

      const labelX = node.x0 < width / 2 ? node.x1 + 8 : node.x0 - 8
      const anchor = node.x0 < width / 2 ? 'start' : 'end'
      const labelY = (node.y0 + node.y1) / 2
      const shortName = node.name.length > 28 ? node.name.slice(0, 26) + '...' : node.name
      svgContent += `<text x="${labelX}" y="${labelY}" dy="-0.2em" text-anchor="${anchor}" fill="#e2e8f0" font-size="${axisSize}" font-weight="600" font-family="${fontFamily}">${shortName}</text>`

      if (node.type === 'unit') {
        const totalIn = (node.targetLinks || []).reduce((s, l) => s + l.value, 0)
        const totalOut = (node.sourceLinks || []).reduce((s, l) => s + l.value, 0)
        if (totalIn > 0 || totalOut > 0) {
          svgContent += `<text x="${labelX}" y="${labelY}" dy="1.0em" text-anchor="${anchor}" fill="${cMuted}" font-size="${axisSize - 2}" font-family="${fontFamily}">вх ${totalIn.toFixed(0)} / вых ${totalOut.toFixed(0)} т</text>`
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
          productCount: link.product_count || 1,
          sourceName: link.source_name || link.source?.name || '',
          targetName: link.target_name || link.target?.name || '',
          value: link.output_value || link.value,
          inputValue: link.input_value || 0,
          loss: link.loss || 0,
          totalValue: link.value,
        })
      })
      el.addEventListener('mouseleave', () => {
        const isLoss = el.dataset.loss === '1'
        el.setAttribute('stroke-opacity', isLoss ? '0.45' : '0.25')
        setTooltip(null)
      })
    })
  }, [sankeyData, colors, fontFamily, fontSize])

  if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для Sankey</div>
  }

  const cPrimary = colors?.primary || '#3b82f6'
  const cSuccess = colors?.success || '#4ade80'
  const cWarning = colors?.warning || '#f59e0b'
  const cDanger = colors?.danger || '#f87171'

  return (
    <>
      <svg ref={svgRef} width="100%" height={Math.max(500, sankeyData.nodes.length * 50)} />

      {tooltip && (
        <div
          className="fixed z-50 border rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            backgroundColor: colors?.tooltip?.bg || '#f8fafc',
            borderColor: colors?.tooltip?.border || '#cbd5e1',
            color: colors?.tooltip?.text || '#1e293b',
            fontFamily,
          }}
        >
          <div className="font-semibold mb-1" style={{ color: colors?.tooltip?.text || '#1e293b' }}>{tooltip.product}</div>
          {tooltip.productCount > 1 && (
            <div style={{ color: colors?.tooltip?.muted || '#64748b', fontSize: '10px' }}>({tooltip.productCount} продуктов)</div>
          )}
          <div style={{ color: colors?.tooltip?.muted || '#64748b' }}>{tooltip.sourceName} → {tooltip.targetName}</div>
          <div className="mt-1" style={{ color: colors?.tooltip?.text || '#1e293b' }}>Всего: {tooltip.totalValue.toFixed(1)} т</div>
          <div style={{ color: colors?.tooltip?.text || '#1e293b' }}>Выход: {tooltip.value.toFixed(1)} т</div>
          {tooltip.inputValue > 0 && (
            <div style={{ color: colors?.tooltip?.text || '#1e293b' }}>Вход: {tooltip.inputValue.toFixed(1)} т</div>
          )}
          {tooltip.loss !== 0 && (
            <div style={{ color: tooltip.loss > 0 ? cDanger : cSuccess, fontWeight: 600 }}>
              Потери: {tooltip.loss > 0 ? '+' : ''}{tooltip.loss.toFixed(1)} т
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-3 text-xs" style={{ fontFamily, color: colors?.muted || '#94a3b8' }}>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: cPrimary }} /> Установки</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: cSuccess }} /> Внешнее сырьё</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: cWarning }} /> Внешняя продукция</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: cDanger }} /> Потери</span>
      </div>
    </>
  )
}
