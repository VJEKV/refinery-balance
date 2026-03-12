import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import api from '../api/client'
import { Upload, Trash2, FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react'

export default function UploadPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef()
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({}) // {fileName: {progress, status}}

  const { data: files } = useQuery({
    queryKey: ['files'],
    queryFn: () => api.get('/files').then(r => r.data),
  })

  const handleUpload = async (file) => {
    const key = file.name
    setUploadProgress(prev => ({ ...prev, [key]: { progress: 0, status: 'uploading', name: file.name } }))

    const fd = new FormData()
    fd.append('file', file)

    try {
      await api.post('/upload', fd, {
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0
          setUploadProgress(prev => ({ ...prev, [key]: { ...prev[key], progress: pct } }))
        },
      })
      setUploadProgress(prev => ({ ...prev, [key]: { ...prev[key], progress: 100, status: 'processing' } }))
      // Give backend time to process (store.load_all)
      await new Promise(r => setTimeout(r, 500))
      setUploadProgress(prev => ({ ...prev, [key]: { ...prev[key], status: 'done' } }))
      queryClient.invalidateQueries()
      // Auto-clear after 4s
      setTimeout(() => {
        setUploadProgress(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, 4000)
    } catch (err) {
      setUploadProgress(prev => ({
        ...prev,
        [key]: { ...prev[key], status: 'error', error: err?.response?.data?.detail || 'Ошибка загрузки' },
      }))
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (filename) => api.delete(`/files/${encodeURIComponent(filename)}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    Array.from(e.dataTransfer.files).forEach(file => handleUpload(file))
  }

  const handleFileSelect = (e) => {
    Array.from(e.target.files).forEach(file => handleUpload(file))
    e.target.value = ''
  }

  const activeUploads = Object.values(uploadProgress)
  const isUploading = activeUploads.some(u => u.status === 'uploading' || u.status === 'processing')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-dark-text">Загрузка файлов</h1>

      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          isUploading ? 'cursor-wait' : 'cursor-pointer'
        } ${
          dragActive
            ? 'border-accent-blue bg-accent-blue/5'
            : 'border-dark-border hover:border-dark-muted'
        }`}
      >
        {isUploading ? (
          <Loader2 size={40} className="mx-auto text-accent-blue mb-3 animate-spin" />
        ) : (
          <Upload size={40} className="mx-auto text-dark-muted mb-3" />
        )}
        <p className="text-dark-text font-medium">
          {isUploading ? 'Идёт загрузка и обработка...' : 'Перетащите файл .xlsm или нажмите для выбора'}
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

      {/* Upload progress cards */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map(u => (
            <div key={u.name} className="bg-dark-card border border-dark-border rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet size={16} className="text-accent-green shrink-0" />
                  <span className="text-sm text-dark-text truncate">{u.name}</span>
                </div>
                <span className="text-xs shrink-0 ml-2">
                  {u.status === 'uploading' && (
                    <span className="text-accent-blue">{u.progress}% загрузка</span>
                  )}
                  {u.status === 'processing' && (
                    <span className="text-accent-yellow flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      Обработка данных...
                    </span>
                  )}
                  {u.status === 'done' && (
                    <span className="text-accent-green flex items-center gap-1">
                      <CheckCircle size={12} />
                      Готово
                    </span>
                  )}
                  {u.status === 'error' && (
                    <span className="text-accent-red">{u.error}</span>
                  )}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    u.status === 'error' ? 'bg-accent-red' :
                    u.status === 'done' ? 'bg-accent-green' :
                    u.status === 'processing' ? 'bg-accent-yellow animate-pulse' :
                    'bg-accent-blue'
                  }`}
                  style={{ width: `${u.status === 'done' ? 100 : u.status === 'processing' ? 100 : u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {files && files.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border">
            <h2 className="text-sm font-semibold text-dark-text">Загруженные файлы ({files.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dark-muted text-xs">
                <th className="px-4 py-2 border border-dark-border/40">Файл</th>
                <th className="px-3 py-2 border border-dark-border/40">Период</th>
                <th className="px-3 py-2 border border-dark-border/40 text-right">Дней</th>
                <th className="px-3 py-2 border border-dark-border/40 text-right">Установок</th>
                <th className="px-3 py-2 border border-dark-border/40"></th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.filename} className="hover:bg-white/5">
                  <td className="px-4 py-2.5 border border-dark-border/20 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-accent-green shrink-0" />
                    <span className="truncate">{f.filename}</span>
                  </td>
                  <td className="px-3 py-2.5 border border-dark-border/20 text-dark-muted">{f.period}</td>
                  <td className="px-3 py-2.5 border border-dark-border/20 text-right">{f.dates?.length || 0}</td>
                  <td className="px-3 py-2.5 border border-dark-border/20 text-right">{f.units?.length || 0}</td>
                  <td className="px-3 py-2.5 border border-dark-border/20 text-right">
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
