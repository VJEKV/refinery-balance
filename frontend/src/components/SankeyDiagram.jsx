import { useRef, useEffect } from 'react'
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey'

const typeColors = {
  unit: '#3b82f6',
  external_input: '#4ade80',
  external_output: '#f59e0b',
  losses: '#f87171',
}

export default function SankeyDiagram({ sankeyData }) {
  const svgRef = useRef()

  useEffect(() => {
    if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) return
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 900
    const height = Math.max(500, sankeyData.nodes.length * 40)

    const nodeMap = {}
    sankeyData.nodes.forEach((n, i) => { nodeMap[n.id] = i })

    const validLinks = sankeyData.links.filter(
      l => l.source !== l.target && l.value > 0
    )

    if (validLinks.length === 0) {
      svg.innerHTML = '<text x="50%" y="50%" fill="#94a3b8" text-anchor="middle" font-size="14">Нет связей для отображения</text>'
      return
    }

    const layout = d3Sankey()
      .nodeId(d => d.index)
      .nodeWidth(20)
      .nodePadding(14)
      .extent([[10, 10], [width - 10, height - 10]])

    const graph = layout({
      nodes: sankeyData.nodes.map((n, i) => ({ ...n, index: i })),
      links: validLinks.map(l => ({ ...l })),
    })

    let svgContent = ''

    graph.links.forEach(link => {
      const path = sankeyLinkHorizontal()(link)
      const opacity = link.loss > 0 ? 0.5 : 0.3
      const color = link.loss > 0 ? '#f87171' : '#3b82f6'
      svgContent += `<path d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${Math.max(1, link.width)}">`
      svgContent += `<title>${link.source_name || ''} → ${link.target_name || ''}\n${link.product}: ${link.value.toFixed(1)} т</title></path>`
    })

    graph.nodes.forEach(node => {
      const color = typeColors[node.type] || '#3b82f6'
      const h = Math.max(1, node.y1 - node.y0)
      svgContent += `<rect x="${node.x0}" y="${node.y0}" width="${node.x1 - node.x0}" height="${h}" fill="${color}" rx="3">`
      svgContent += `<title>${node.name}</title></rect>`

      const labelX = node.x0 < width / 2 ? node.x1 + 6 : node.x0 - 6
      const anchor = node.x0 < width / 2 ? 'start' : 'end'
      const labelY = (node.y0 + node.y1) / 2
      const shortName = node.name.length > 30 ? node.name.slice(0, 28) + '...' : node.name
      svgContent += `<text x="${labelX}" y="${labelY}" dy="0.35em" text-anchor="${anchor}" fill="#e2e8f0" font-size="11" font-family="Inter, sans-serif">${shortName}</text>`
    })

    svg.innerHTML = svgContent
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }, [sankeyData])

  if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
    return <div className="text-dark-muted text-sm p-4">Нет данных для Sankey</div>
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 overflow-x-auto">
      <svg ref={svgRef} width="100%" height={Math.max(500, sankeyData.nodes.length * 40)} />
      <div className="flex gap-4 mt-3 text-xs text-dark-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-blue" /> Установки</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-green" /> Внешнее сырьё</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-yellow" /> Внешняя продукция</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-red" /> Потери</span>
      </div>
    </div>
  )
}
