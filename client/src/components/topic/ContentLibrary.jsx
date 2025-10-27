import React, { useState, useEffect, useRef, useCallback } from 'react';
import { File, FileText, FileSpreadsheet, ExternalLink, Eye } from 'lucide-react';
import API_CONFIG from '@/config';

const ContentLibrary = ({ currentScene, fileInputId }) => {
  const [contentFiles, setContentFiles] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  // Add effect to listen for file upload from external input
  useEffect(() => {
    if (fileInputId) {
      const fileInput = document.getElementById(fileInputId);
      if (fileInput) {
        const handleFileChange = (e) => handleFileUpload(e);
        fileInput.addEventListener('change', handleFileChange);
        return () => {
          fileInput.removeEventListener('change', handleFileChange);
        };
      }
    }
  }, [fileInputId]);

  // Function to close the preview when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (previewRef.current && !previewRef.current.contains(event.target)) {
        setPreviewContent(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to preview a content item
  const handlePreviewContent = (content, e) => {
    e.stopPropagation();
    setPreviewContent(content);
  };

  // Function to load content from the content folder
  const loadContentFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let serverFiles = [];

      // First try to fetch content files from the server
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT_LIST}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Server content files:', data);

          if (Array.isArray(data)) {
            serverFiles = data;
          } else {
            console.warn('Server returned non-array data:', data);
          }
        } else {
          console.warn('Server returned error:', await response.text());
        }
      } catch (fetchError) {
        console.error('Error fetching content from API:', fetchError);
      }

      // Merge all content sources, prioritizing server files for duplicates
      // First, create a map to deduplicate based on filename
      const contentMap = new Map();
      
      // Add server files first (highest priority)
      serverFiles.forEach(file => {
        contentMap.set(file.filename, file);
      });

      // Convert map back to array and sort by name
      const allContentFiles = Array.from(contentMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log('Final content file list:', allContentFiles);
      setContentFiles(allContentFiles);
    } catch (err) {
      console.error('Error loading content files:', err);
      setError('Failed to load content files: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setError(null); // Clear any previous errors
    
    console.log(`Starting file upload process for ${files.length} file(s)`);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if it's a valid content file type
        if (!file.type.includes('pdf') && 
            !file.type.includes('image/') && 
            !file.type.includes('spreadsheet') && 
            !file.type.includes('excel') && 
            !file.type.includes('text/')) {
          console.warn(`Skipping unsupported file type: ${file.type}`);
          continue;
        }
        
        // Extract and sanitize filename
        const filename = file.name;
        const sanitizedFilename = filename.replace(/\s+/g, '_');
        
        console.log(`Processing file: ${filename} (sanitized as: ${sanitizedFilename})`);
        console.log(`File details: size=${file.size}, type=${file.type}`);
        
        // Upload to the server
        try {
          // Create a FormData object to send the file
          const formData = new FormData();
          formData.append('file', file);
          formData.append('filename', sanitizedFilename);

          // Send the file to the server
          const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT_UPLOAD}`, {
            method: 'POST',
            body: formData,
          });
          
          // Get full response text for debugging
          const responseText = await uploadResponse.text();
          console.log(`Server response for ${sanitizedFilename}: ${responseText}`);
          
          // Parse the response if possible
          try {
            const uploadResult = JSON.parse(responseText);
            
            if (uploadResponse.ok && uploadResult.success) {
              console.log('File uploaded to server successfully:', uploadResult);
            } else {
              console.warn(`Server upload failed for ${sanitizedFilename}:`, uploadResult);
            }
          } catch (parseError) {
            console.error('Error parsing server response:', parseError);
            console.log('Raw response text:', responseText);
          }
        } catch (uploadError) {
          console.error(`Error uploading ${sanitizedFilename} to server:`, uploadError);
          
          // Try the emergency upload as a fallback
          if (file.type === 'application/pdf') {
            try {
              console.log(`Attempting emergency upload for ${sanitizedFilename}...`);
              // Create a FormData object with explicit instructions to copy to content folder
              const emergencyFormData = new FormData();
              emergencyFormData.append('file', file);
              emergencyFormData.append('filename', sanitizedFilename);
              emergencyFormData.append('destination', 'content');
              
              // Try alternative upload endpoint
              const emergencyResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT_UPLOAD}`, {
                method: 'POST',
                body: emergencyFormData,
              });
              
              const emergencyResponseText = await emergencyResponse.text();
              console.log(`Emergency upload response: ${emergencyResponseText}`);
            } catch (emergencyError) {
              console.warn('Emergency upload attempt failed:', emergencyError);
            }
          }
        }
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the content list from the server
      console.log('Refreshing content list from server...');
      await loadContentFiles();
      
      console.log('File upload process completed successfully.');
    } catch (error) {
      console.error('Error in upload process:', error);
      setError(`Failed to upload files: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Load content files on component mount
  useEffect(() => {
    loadContentFiles();
  }, [loadContentFiles]);

  // Update the file count in the header
  useEffect(() => {
    const fileCountElement = document.getElementById('content-file-count');
    if (fileCountElement) {
      fileCountElement.textContent = `${contentFiles.length} files`;
    }
  }, [contentFiles.length]);

  // Function to check if a content file is already in the scene
  const isContentImported = (contentId) => {
    if (!currentScene || !currentScene.boxes) return false;
    
    // Check all boxes in the scene
    return currentScene.boxes.some(box => {
      // Check elements array for content elements
      if (box.elements) {
        return box.elements.some(element => 
          element.elementType === 'content' && 
          element.contentId === contentId
        );
      }
      return false;
    });
  };

  // Handle drag start for content files
  const handleDragStart = (e, content) => {
    // Create content data for drag and drop
    const contentData = {
      type: 'content',
      content: {
        id: content.id,
        name: content.name,
        filename: content.filename,
        contentType: content.type,
        contentUrl: content.path,
        contentId: content.id,
        description: content.description,
        metadata: content.metadata
      }
    };

    console.log('Dragging content:', content.name, 'with data:', contentData);
    e.dataTransfer.setData('application/json', JSON.stringify(contentData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle content item click
  const handleContentClick = (index) => {
    setSelectedContent(index);
    
    // You could open a content preview or inspector here
    console.log('Selected content:', contentFiles[index]);
  };

  // Function to get appropriate icon for file type
  const getFileIcon = (fileType) => {
    if (fileType === 'application/pdf') {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else if (fileType.startsWith('image/')) {
      return <File className="w-4 h-4 text-blue-500" />;
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <File className="w-4 h-4 text-amber-500" />;
    } else {
      return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };
  
  return (
    <div className="content-library px-3 overflow-y-auto theme-bg-tertiary rounded-lg shadow h-[calc(100%-30px)]">
      {/* Upload status indicator (only shown when uploading) */}
      {isUploading && (
        <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent mr-1"></div>
          <span className="text-xs text-blue-500">Uploading...</span>
        </div>
      )}

      <div className="space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm theme-text-secondary">Loading content...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-500 p-2 rounded bg-red-50">{error}</div>
        ) : contentFiles.length === 0 ? (
          <div className="text-sm theme-text-secondary italic p-2">No content files available</div>
        ) : (
          contentFiles.map((content, index) => {
            const isImported = isContentImported(content.id);
            
            return (
              <div
                key={index}
                className={`flex items-center p-2 rounded-md transition
                  ${isImported ? 'theme-bg-muted' : 'hover:bg-blue-50/70 hover:dark:bg-blue-900/30 cursor-move'}
                  ${selectedContent === index ? 'ring-1 ring-blue-500 theme-bg-selected' : ''}
                  ${content.isUserUploaded ? 'border-l-4 border-blue-400' : ''}
                  ${content.isOnServer && !content.isUserUploaded ? 'border-l-4 border-green-400' : ''}`}
                draggable={!isImported}
                onDragStart={(e) => !isImported && handleDragStart(e, content)}
                onClick={() => handleContentClick(index)}
              >
                {/* Content thumbnail/icon */}
                <div 
                  className={`relative w-8 h-8 rounded overflow-hidden border flex items-center justify-center
                    ${isImported ? 'border-gray-300 grayscale' : 'border-gray-200'}
                    theme-bg-muted`}
                >
                  {getFileIcon(content.type)}
                  {isImported && (
                    <div className="absolute inset-0 bg-black bg-opacity-20" />
                  )}
                </div>

                {/* Content info */}
                <div className="ml-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isImported ? 'text-gray-500' : 'theme-text-primary'} truncate`}>
                      {content.name}
                    </span>
                    <div className="flex items-center space-x-1">
                      {/* Preview/open buttons */}
                      {content.type === 'application/pdf' && (
                        <button
                          onClick={(e) => handlePreviewContent(content, e)}
                          className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50/70"
                          title="Preview PDF"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      
                      {content.path && (
                        <a
                          href={content.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      
                      {/* Location indicator */}
                      {(content.isUserUploaded || content.isOnServer) && (
                        <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${
                          content.isOnServer 
                            ? 'text-green-600 bg-green-50' 
                            : 'text-blue-500 bg-blue-50'
                        }`}>
                          {content.isOnServer ? 'Server' : 'Local'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-xs theme-text-secondary space-x-1">
                    <span className="truncate">{content.metadata?.subject || 'Document'}</span>
                    {content.metadata?.year && (
                      <>
                        <span>•</span>
                        <span>{content.metadata.year}</span>
                      </>
                    )}
                    {content.metadata?.author && (
                      <>
                        <span>•</span>
                        <span className="truncate">{content.metadata.author}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* PDF Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            ref={previewRef}
            className="bg-white rounded-lg shadow-xl overflow-hidden max-w-4xl max-h-[90vh] w-full flex flex-col"
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">{previewContent.name}</h3>
              <button 
                onClick={() => setPreviewContent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <div className="flex-grow overflow-hidden">
              {previewContent.type === 'application/pdf' && (
                <iframe 
                  src={`${previewContent.path}#toolbar=0`}
                  className="w-full h-full border-0" 
                  title={previewContent.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentLibrary; 