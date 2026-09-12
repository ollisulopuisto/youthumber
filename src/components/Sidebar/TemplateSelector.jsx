import { useState } from 'react'
import templates from '../../data/templates'
import { getCustomTemplates, deleteCustomTemplate, saveCustomTemplate } from '../../utils/storageUtils'

function TemplateSelector({ selectedTemplate, onSelectTemplate, currentState }) {
  const [customTemplates, setCustomTemplates] = useState(getCustomTemplates())
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  const handleDeleteCustomTemplate = (e, templateId) => {
    e.stopPropagation()
    if (confirm('Delete this custom template?')) {
      deleteCustomTemplate(templateId)
      setCustomTemplates(getCustomTemplates())
    }
  }

  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name')
      return
    }

    const template = {
      name: newTemplateName.trim(),
      description: 'Custom template',
      thumbnail: '🎨',
      background: currentState?.selectedTemplate?.background || { color: '#1E3A5F' },
      text: currentState?.selectedTemplate?.text || {}
    }

    saveCustomTemplate(template)
    setCustomTemplates(getCustomTemplates())
    setShowSaveDialog(false)
    setNewTemplateName('')
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[#E67E22]">
          Templates
        </h2>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          title="Save current layout as template"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Save as Template
        </button>
      </div>

      {/* Save as Template Dialog */}
      {showSaveDialog && (
        <div className="mb-3 bg-gray-800 rounded p-3 space-y-2">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Template name..."
            className="w-full bg-gray-700 px-3 py-2 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveAsTemplate}
              className="flex-1 px-3 py-1.5 bg-[#E67E22] hover:bg-[#d35400] text-white rounded text-sm font-medium transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false)
                setNewTemplateName('')
              }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {/* Custom Templates */}
        {customTemplates.length > 0 && (
          <>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-2 mb-1">
              Your Templates
            </div>
            {customTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={`
                  w-full px-4 py-3 rounded text-left transition-all
                  flex items-center gap-3 relative group
                  ${selectedTemplate?.id === template.id
                    ? 'bg-[#E67E22] text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }
                `}
              >
                <span className="text-2xl">{template.thumbnail}</span>
                <div className="flex-1">
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-xs opacity-75 mt-0.5">
                    {template.description}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteCustomTemplate(e, template.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete template"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </button>
            ))}
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-4 mb-1">
              Built-in Templates
            </div>
          </>
        )}

        {/* Built-in Templates */}
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={`
              w-full px-4 py-3 rounded text-left transition-all
              flex items-center gap-3
              ${selectedTemplate?.id === template.id
                ? 'bg-[#E67E22] text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }
            `}
          >
            <span className="text-2xl">{template.thumbnail}</span>
            <div className="flex-1">
              <div className="font-semibold">{template.name}</div>
              <div className="text-xs opacity-75 mt-0.5">
                {template.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default TemplateSelector
