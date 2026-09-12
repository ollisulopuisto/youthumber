/**
 * LocalStorage utility functions for saving and loading projects
 */

const STORAGE_KEY = 'mvtg_projects' // Music Video Thumbnail Generator
const AUTOSAVE_KEY = 'pix3lcover_autosave'

/**
 * Current schema version for project data
 * Increment this when making breaking changes to project structure
 */
export const CURRENT_SCHEMA_VERSION = 4

/**
 * Default values for project fields (used in migrations)
 */
const PROJECT_DEFAULTS = {
  format: '16:9',
  titleText: '',
  subtitleText: '',
  extraText: '',
  templateId: 'classic-blues',
  fontConfig: {
    titleFont: 'Bebas Neue',
    subtitleFont: 'Montserrat',
    titleSize: 72,
    subtitleSize: 36
  },
  textColors: {
    titleColor: null,
    subtitleColor: null
  },
  textPositions: {
    title: null,
    subtitle: null,
    extra: null
  },
  badgeConfig: {
    enabled: false,
    style: 'futuristic',
    position: 'top-right',
    text: 'AI Generated',
    transparentBg: true,
    backgroundColor: '#667eea'
  },
  filterConfig: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0
  },
  layers: [],
  customTemplates: []
}

/**
 * Migration functions for each schema version
 * Each function takes a project and returns the migrated project
 */
const migrations = {
  // Migration from no version (legacy) to version 1
  0: (project) => {
    return {
      ...project,
      schemaVersion: 1,
      // Ensure all required fields exist with defaults
      format: project.format || PROJECT_DEFAULTS.format,
      titleText: project.titleText ?? PROJECT_DEFAULTS.titleText,
      subtitleText: project.subtitleText ?? PROJECT_DEFAULTS.subtitleText,
      templateId: project.templateId || PROJECT_DEFAULTS.templateId,
      fontConfig: {
        ...PROJECT_DEFAULTS.fontConfig,
        ...project.fontConfig
      },
      textColors: {
        ...PROJECT_DEFAULTS.textColors,
        ...project.textColors
      },
      textPositions: {
        ...PROJECT_DEFAULTS.textPositions,
        ...project.textPositions
      },
      badgeConfig: {
        ...PROJECT_DEFAULTS.badgeConfig,
        ...project.badgeConfig
      }
    }
  },
  // Migration from v1 to v2: Add extraText field
  1: (project) => {
    return {
      ...project,
      schemaVersion: 2,
      extraText: project.extraText ?? '',
      textPositions: {
        ...project.textPositions,
        extra: project.textPositions?.extra || null
      }
    }
  },
  // Migration from v2 to v3: Add filterConfig
  2: (project) => {
    return {
      ...project,
      schemaVersion: 3,
      filterConfig: project.filterConfig || {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0
      }
    }
  },
  // Migration from v3 to v4: Add layers and customTemplates
  3: (project) => {
    return {
      ...project,
      schemaVersion: 4,
      layers: project.layers || [],
      customTemplates: project.customTemplates || []
    }
  }
}

/**
 * Migrate a single project to the current schema version
 */
const migrateProject = (project) => {
  let currentVersion = project.schemaVersion || 0
  let migratedProject = { ...project }

  // Apply migrations sequentially until we reach current version
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migrationFn = migrations[currentVersion]
    if (migrationFn) {
      migratedProject = migrationFn(migratedProject)
      currentVersion = migratedProject.schemaVersion
    } else {
      // No migration found, just set the version
      migratedProject.schemaVersion = CURRENT_SCHEMA_VERSION
      break
    }
  }

  return migratedProject
}

/**
 * Migrate all projects and save back to localStorage if needed
 */
const migrateAllProjects = (projects) => {
  let needsSave = false
  const migratedProjects = projects.map(project => {
    if ((project.schemaVersion || 0) < CURRENT_SCHEMA_VERSION) {
      needsSave = true
      return migrateProject(project)
    }
    return project
  })

  if (needsSave) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedProjects))
    console.log(`Migrated ${migratedProjects.length} project(s) to schema version ${CURRENT_SCHEMA_VERSION}`)
  }

  return migratedProjects
}

/**
 * Get all saved projects from localStorage
 * Automatically migrates old projects to current schema
 */
export const getAllProjects = () => {
  try {
    const projectsJson = localStorage.getItem(STORAGE_KEY)
    const projects = projectsJson ? JSON.parse(projectsJson) : []
    // Run migrations if needed
    return migrateAllProjects(projects)
  } catch (error) {
    console.error('Error loading projects:', error)
    return []
  }
}

/**
 * Save a project to localStorage
 */
export const saveProject = (project) => {
  try {
    const projects = getAllProjects()

    // Check if project with same id exists (update) or create new
    const existingIndex = projects.findIndex(p => p.id === project.id)

    if (existingIndex >= 0) {
      // Update existing project
      projects[existingIndex] = {
        ...project,
        updatedAt: new Date().toISOString()
      }
    } else {
      // Add new project
      projects.push({
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return true
  } catch (error) {
    console.error('Error saving project:', error)
    return false
  }
}

/**
 * Load a project by ID
 */
export const loadProject = (projectId) => {
  try {
    const projects = getAllProjects()
    return projects.find(p => p.id === projectId)
  } catch (error) {
    console.error('Error loading project:', error)
    return null
  }
}

/**
 * Delete a project by ID
 */
export const deleteProject = (projectId) => {
  try {
    const projects = getAllProjects()
    const filtered = projects.filter(p => p.id !== projectId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Error deleting project:', error)
    return false
  }
}

/**
 * Duplicate a project by ID
 * Creates a copy with new ID and modified name
 */
export const duplicateProject = (projectId) => {
  try {
    const projects = getAllProjects()
    const original = projects.find(p => p.id === projectId)

    if (!original) {
      return { success: false, error: 'Project not found' }
    }

    const duplicate = {
      ...original,
      id: generateProjectId(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    projects.push(duplicate)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))

    return { success: true, project: duplicate }
  } catch (error) {
    console.error('Error duplicating project:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate a unique project ID
 */
export const generateProjectId = () => {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a project object from current state
 * Note: We save only the template ID, not the entire template object
 */
export const createProjectFromState = (state, projectName, thumbnail = null) => {
  return {
    id: state.id || generateProjectId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: projectName || `Project ${new Date().toLocaleDateString()}`,
    format: state.format,
    uploadedImage: state.uploadedImage,
    templateId: state.selectedTemplate?.id || 'classic-blues', // Save only template ID
    titleText: state.titleText,
    subtitleText: state.subtitleText,
    extraText: state.extraText,
    fontConfig: state.fontConfig,
    textColors: state.textColors,
    textPositions: state.textPositions,
    badgeConfig: state.badgeConfig,
    filterConfig: state.filterConfig,
    layers: state.layers || [],
    thumbnail: thumbnail
  }
}

/**
 * Generate a thumbnail from canvas
 * Returns a small base64 image for gallery preview
 */
export const generateThumbnail = (canvas, format = '16:9') => {
  if (!canvas) return null

  try {
    // Thumbnail dimensions (small for storage efficiency)
    const thumbWidth = format === '16:9' ? 160 : 90

    // Get canvas data URL at reduced size
    const dataURL = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.6,
      multiplier: thumbWidth / canvas.getWidth()
    })

    return dataURL
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return null
  }
}

/**
 * Get storage usage info
 */
export const getStorageInfo = () => {
  try {
    const projects = getAllProjects()
    const storageJson = localStorage.getItem(STORAGE_KEY)
    const sizeInBytes = storageJson ? new Blob([storageJson]).size : 0
    const sizeInKB = (sizeInBytes / 1024).toFixed(2)

    return {
      projectCount: projects.length,
      sizeInKB,
      sizeInBytes
    }
  } catch (error) {
    console.error('Error getting storage info:', error)
    return {
      projectCount: 0,
      sizeInKB: '0',
      sizeInBytes: 0
    }
  }
}

/**
 * Save auto-save data to localStorage
 */
export const saveAutoSave = (state) => {
  try {
    const autoSaveData = {
      ...state,
      templateId: state.selectedTemplate?.id,
      savedAt: new Date().toISOString()
    }
    // Remove the full template object, keep only ID
    delete autoSaveData.selectedTemplate
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(autoSaveData))
    return true
  } catch (error) {
    console.error('Error auto-saving:', error)
    return false
  }
}

/**
 * Load auto-save data from localStorage
 */
export const loadAutoSave = () => {
  try {
    const autoSaveJson = localStorage.getItem(AUTOSAVE_KEY)
    return autoSaveJson ? JSON.parse(autoSaveJson) : null
  } catch (error) {
    console.error('Error loading auto-save:', error)
    return null
  }
}

/**
 * Clear auto-save data
 */
export const clearAutoSave = () => {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
    return true
  } catch (error) {
    console.error('Error clearing auto-save:', error)
    return false
  }
}

/**
 * Export all projects as JSON file
 */
export const exportProjectsToJSON = () => {
  try {
    const projects = getAllProjects()
    if (projects.length === 0) {
      return { success: false, error: 'No projects to export' }
    }

    const exportData = {
      version: '1.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      projectCount: projects.length,
      projects: projects
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `pix3lcover-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return { success: true, count: projects.length }
  } catch (error) {
    console.error('Error exporting projects:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Import projects from JSON file
 * @param {File} file - The JSON file to import
 * @param {string} mode - 'merge' (add to existing) or 'replace' (overwrite all)
 * @returns {Promise<{success: boolean, imported?: number, skipped?: number, error?: string}>}
 */
/**
 * Custom Templates Storage Key
 */
const CUSTOM_TEMPLATES_KEY = 'pix3lcover_custom_templates'

/**
 * Get all custom templates
 */
export const getCustomTemplates = () => {
  try {
    const templatesJson = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
    return templatesJson ? JSON.parse(templatesJson) : []
  } catch (error) {
    console.error('Error loading custom templates:', error)
    return []
  }
}

/**
 * Save a custom template
 */
export const saveCustomTemplate = (template) => {
  try {
    const templates = getCustomTemplates()
    templates.push({
      ...template,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isCustom: true,
      createdAt: new Date().toISOString()
    })
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
    return true
  } catch (error) {
    console.error('Error saving custom template:', error)
    return false
  }
}

/**
 * Delete a custom template
 */
export const deleteCustomTemplate = (templateId) => {
  try {
    const templates = getCustomTemplates()
    const filtered = templates.filter(t => t.id !== templateId)
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Error deleting custom template:', error)
    return false
  }
}

export const importProjectsFromJSON = (file, mode = 'merge') => {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result)

        // Validate structure
        if (!importData.projects || !Array.isArray(importData.projects)) {
          resolve({ success: false, error: 'Invalid backup file format' })
          return
        }

        // Migrate imported projects to current schema
        const importedProjects = importData.projects.map(p => migrateProject(p))
        let imported = 0
        let skipped = 0

        if (mode === 'replace') {
          // Replace all existing projects
          localStorage.setItem(STORAGE_KEY, JSON.stringify(importedProjects))
          imported = importedProjects.length
        } else {
          // Merge with existing projects
          const existingProjects = getAllProjects()
          const existingIds = new Set(existingProjects.map(p => p.id))

          for (const project of importedProjects) {
            if (existingIds.has(project.id)) {
              skipped++
            } else {
              existingProjects.push(project)
              imported++
            }
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(existingProjects))
        }

        resolve({ success: true, imported, skipped })
      } catch (error) {
        console.error('Error parsing import file:', error)
        resolve({ success: false, error: 'Failed to parse backup file' })
      }
    }

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' })
    }

    reader.readAsText(file)
  })
}
