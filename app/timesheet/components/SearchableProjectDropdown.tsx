'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface SearchableProjectDropdownProps {
  value: string
  onChange: (value: string) => void
  projects: any[]
  placeholder?: string
  style?: React.CSSProperties
  recentJobs?: { jobNumber: string; title: string }[]
}

export default function SearchableProjectDropdown({
  value,
  onChange,
  projects,
  placeholder,
  style,
  recentJobs,
}: SearchableProjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const projectsWithCodes = useMemo(
    () => projects.filter((p) => (p.code || '').toString().trim() !== ''),
    [projects]
  )
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projectsWithCodes
    const term = searchTerm.toLowerCase()
    return projectsWithCodes.filter((p) => {
      const code = (p.code || p.id || '').toString().toLowerCase()
      const name = (p.name || '').toString().toLowerCase()
      const client = ((p.client_name || p.clientName || '')).toString().toLowerCase()
      return code.includes(term) || name.includes(term) || client.includes(term)
    })
  }, [projectsWithCodes, searchTerm])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const t = setTimeout(() => searchInputRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(t)
    }
  }, [isOpen])

  const displayValue = useMemo(() => {
    if (!value) return ''
    const project = projects.find((p) => (p.code || p.id || '').toString() === value)
    if (project) {
      const code = (project.code || project.id || '').toString()
      const name = (project.name || '').toString().trim()
      return name ? `${code} – ${name}` : code
    }
    return value
  }, [value, projects])

  const openPopup = () => {
    setIsOpen(true)
    setSearchTerm('')
  }

  const handleSelect = (project: any) => {
    const code = (project.code || project.id || '').toString()
    onChange(code)
    setIsOpen(false)
    setSearchTerm('')
  }

  const closePopup = () => {
    setIsOpen(false)
    setSearchTerm('')
  }

  const fontSize = style?.fontSize || '13px'
  const isCompact = fontSize === '12px'
  const hasExplicitHeight = style && ('height' in style || 'minHeight' in style)

  return (
    <>
      <div style={{ position: 'relative', flex: 1, display: 'flex', ...style }}>
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={displayValue}
          onFocus={openPopup}
          onClick={openPopup}
          placeholder={placeholder || 'Search projects...'}
          style={{
            width: '100%',
            height: hasExplicitHeight ? '100%' : undefined,
            boxSizing: 'border-box',
            padding: isCompact ? '4px 6px' : '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: isCompact ? '4px' : '6px',
            fontSize: fontSize,
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        />
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select job"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 24,
          }}
          onClick={(e) => e.target === e.currentTarget && closePopup()}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px 12px',
                borderBottom: '1px solid var(--border)',
                gap: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Select job
              </h2>
              <button
                type="button"
                onClick={closePopup}
                aria-label="Close"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 12, paddingBottom: 8 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by job number, name or client..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {recentJobs && recentJobs.length > 0 && (
              <div style={{ padding: '0 12px 8px' }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Recent job numbers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {recentJobs.map(({ jobNumber, title }) => {
                    const labelTitle = title && title !== jobNumber ? title : ''
                    const isSelected = jobNumber === value
                    return (
                      <button
                        key={jobNumber}
                        type="button"
                        onClick={() => {
                          const project =
                            projectsWithCodes.find(
                              (p) => (p.code || p.id || '').toString() === jobNumber
                            ) || null
                          if (project) {
                            handleSelect(project)
                          } else {
                            onChange(jobNumber)
                            closePopup()
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          border:
                            '1px solid ' +
                            (isSelected ? 'var(--accent-primary)' : 'var(--border)'),
                          background: isSelected
                            ? 'var(--accent-primary-light)'
                            : 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{jobNumber}</span>
                        {labelTitle && (
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontWeight: 400,
                            }}
                          >
                            {labelTitle}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 200,
                maxHeight: 400,
              }}
            >
              {filteredProjects.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                >
                  {searchTerm.trim()
                    ? 'No projects match your search.'
                    : 'No projects with job numbers.'}
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const code = (project.code || project.id || '').toString()
                  const name = project.name || ''
                  const client = project.client_name || project.clientName || ''
                  const isSelected = code === value
                  return (
                    <div
                      key={project.id || code}
                      onClick={() => handleSelect(project)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected
                          ? 'var(--accent-primary-light)'
                          : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{code}</span>
                        {name && (
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontWeight: 400,
                              fontSize: 13,
                            }}
                          >
                            {name}
                          </span>
                        )}
                      </div>
                      {client && (
                        <div
                          style={{
                            color: 'var(--text-tertiary)',
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {client}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
