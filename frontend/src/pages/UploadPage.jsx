import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import api from '../api/client'
import { Upload, Trash2, FileSpreadsheet, CheckCircle } from 'lucide-react'

export default function UploadPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef()
  const [dragActive, setDragActive] = useState(false)

  const { data: files } = useQuery({
    queryKey: ['files'],
    queryFn: () => api.get('/files').then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/upload', fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (filename) => api.delete(`/files/${encodeURIComponent(filename)}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    Array.from(e.dataTransfer.files).forEach(file => uploadMutation.mutate(file))
  }

  const handleFileSelect = (e) => {
    Array.from(e.target.files).forEach(file => uploadMutation.mutate(file))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Загрузка файлов</h1>

      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-accent-blue bg-accent-blue/5'
            : 'border-dark-border hover:border-dark-muted'
        }`}
      >
        <Upload size={40} className="mx-auto text-dark-muted mb-3" />
        <p className="text-dark-text font-medium">
          {uploadMutation.isPending ? 'Загрузка...' : 'Перетащите файл .xlsm или нажмите для выбора'}
        </p>
        <p className="text-dark-muted text-sm mt-1">Поддерживаются файлы .xlsm и .xlsx</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsm,.xlsx"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploadMutation.isError && (
        <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-lg px-4 py-3 text-sm">
          Ошибка загрузки: {uploadMutation.error?.response?.data?.detail || 'Неизвестная ошибка'}
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="bg-accent-green/10 border border-accent-green/30 text-accent-green rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          Файл загружен успешно
        </div>
      )}

      {files && files.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border">
            <h2 className="text-sm font-semibold text-dark-text">Загруженные файлы ({files.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border text-left text-dark-muted text-xs">
                <th className="px-4 py-2">Файл</th>
                <th className="px-3 py-2">Период</th>
                <th className="px-3 py-2 text-right">Дней</th>
                <th className="px-3 py-2 text-right">Установок</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.filename} className="border-b border-dark-border/50 hover:bg-white/5">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-accent-green shrink-0" />
                    <span className="truncate">{f.filename}</span>
                  </td>
                  <td className="px-3 py-2.5 text-dark-muted">{f.period}</td>
                  <td className="px-3 py-2.5 text-right">{f.dates?.length || 0}</td>
                  <td className="px-3 py-2.5 text-right">{f.units?.length || 0}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(f.filename) }}
                      className="text-dark-muted hover:text-accent-red transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
