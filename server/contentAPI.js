import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ContentManager from './contentManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup storage for uploaded files
const contentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use the same content directory path that ContentManager uses
    const contentManager = new ContentManager();
    const contentDir = contentManager.contentDir;

    console.log('Uploading file to content directory:', contentDir);
    
    // Create the content directory if it doesn't exist
    if (!fs.existsSync(contentDir)) {
      try {
        fs.mkdirSync(contentDir, { recursive: true });
        console.log(`Created content directory at ${contentDir}`);
      } catch (err) {
        console.error('Error creating content directory:', err);
      }
    }
    
    cb(null, contentDir);
  },
  filename: function (req, file, cb) {
    // Use the original filename to preserve file extensions
    // Replace spaces with underscores to avoid URL encoding issues
    const sanitizedFilename = file.originalname.replace(/\s+/g, '_');
    console.log(`Sanitized filename for upload: ${sanitizedFilename}`);
    cb(null, sanitizedFilename);
  }
});

const contentUpload = multer({ storage: contentStorage });

export function setupContentRoutes(app) {
  // Content API endpoints
  app.post('/api/content/upload', contentUpload.single('file'), (req, res) => {
    try {
      console.log('File upload request received');
      
      if (!req.file) {
        console.error('No file in the request');
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      
      // Get the content manager's content directory for consistent path resolution
      const contentManager = new ContentManager();
      const contentDir = contentManager.contentDir;
      
      console.log(`ContentManager dir: ${contentDir}`);
      console.log(`Uploaded file details:`, req.file);
      
      const filePath = req.file.path;
      const fileName = req.file.filename; // This will be the sanitized filename
      
      // Check if the file exists after upload
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at path after upload: ${filePath}`);
        return res.status(500).json({ 
          success: false, 
          message: 'File was not correctly written to disk',
          expectedPath: filePath 
        });
      }
      
      console.log(`Verified file exists at: ${filePath}`);
      
      // Calculate the relative path from content directory (for URL purposes)
      // This ensures the path is accessible via the static content route
      const relativePath = path.relative(contentDir, filePath).replace(/\\/g, '/');
      
      console.log(`File uploaded successfully to ${filePath}`);
      console.log(`Relative path: ${relativePath}`);
      console.log(`URL path: /content/${fileName}`);
      
      // Check if the file is accessible via the static route
      const staticPath = `/content/${fileName}`;
      console.log(`Static access path will be: ${staticPath}`);

      // Create an additional copy in a parent directory content folder for redundancy
      try {
        // Create path to parent directory content folder
        const projectRoot = path.resolve(__dirname, '..');
        const parentContentDir = path.join(projectRoot, 'content');
        
        // Ensure the parent content directory exists
        if (!fs.existsSync(parentContentDir)) {
          fs.mkdirSync(parentContentDir, { recursive: true });
          console.log(`Created parent content directory at ${parentContentDir}`);
        }
        
        // Copy the file to the parent content directory
        const parentFilePath = path.join(parentContentDir, fileName);
        fs.copyFileSync(filePath, parentFilePath);
        console.log(`Copied file to parent content directory: ${parentFilePath}`);
        
        // Add the parent content path to the response data
        const responseData = {
          success: true,
          path: staticPath, // Primary URL path for browser access
          serverPath: filePath, // Absolute path on the server
          alternativePath: parentFilePath, // Path in parent directory
          filename: fileName,
          size: req.file.size,
          contentDir: contentDir // Send the content directory for debugging
        };
        
        return res.json(responseData);
      } catch (parentCopyError) {
        console.warn('Error creating copy in parent directory:', parentCopyError);
        // Continue anyway as we still have the original file and static copy
      }

      // Return success response with server path and URL path
      res.json({
        success: true,
        path: staticPath, // This is the URL path for browser access
        serverPath: filePath, // Absolute path on the server
        filename: fileName,
        size: req.file.size,
        contentDir: contentDir // Send the content directory for debugging
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ 
        success: false, 
        message: 'File upload failed', 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Alternative endpoint using destination parameter
  app.post('/api/upload/content', contentUpload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      
      const filePath = req.file.path;
      const fileName = req.file.filename || req.file.originalname.replace(/\s+/g, '_');
      
      console.log(`File uploaded successfully to ${filePath}`);
      
      // Create an additional copy in a parent directory content folder for redundancy
      try {
        // Create path to parent directory content folder
        const projectRoot = path.resolve(__dirname, '..');
        const parentContentDir = path.join(projectRoot, 'content');
        
        // Ensure the parent content directory exists
        if (!fs.existsSync(parentContentDir)) {
          fs.mkdirSync(parentContentDir, { recursive: true });
          console.log(`Created parent content directory at ${parentContentDir}`);
        }
        
        // Copy the file to the parent content directory
        const parentFilePath = path.join(parentContentDir, fileName);
        fs.copyFileSync(filePath, parentFilePath);
        console.log(`Copied file to parent content directory: ${parentFilePath}`);
        
        // Return success response with both paths
        return res.json({
          success: true,
          path: filePath,
          parentPath: parentFilePath,
          filename: fileName
        });
      } catch (parentCopyError) {
        console.warn('Error creating copy in parent directory:', parentCopyError);
        // Continue anyway as we still have the original file
      }
      
      // Return success response
      res.json({
        success: true,
        path: filePath,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error('Error in emergency upload:', error);
      res.status(500).json({ success: false, message: 'Emergency upload failed', error: error.message });
    }
  });

  // Endpoint to list all available content files
  app.get('/api/content/list', (req, res) => {
    try {
      const contentManager = new ContentManager();
      const contentDir = contentManager.contentDir;
      
      if (!fs.existsSync(contentDir)) {
        return res.json([]);
      }
      
      const files = fs.readdirSync(contentDir);
      const contentFiles = files.map(filename => {
        // Extract file extension
        const ext = path.extname(filename).toLowerCase();
        const baseFilename = path.basename(filename, ext);
        
        // Determine file type based on extension
        let fileType = 'application/octet-stream'; // Default file type
        if (ext === '.pdf') fileType = 'application/pdf';
        else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) fileType = `image/${ext.substring(1)}`;
        else if (['.xls', '.xlsx'].includes(ext)) fileType = 'application/vnd.ms-excel';
        else if (['.doc', '.docx'].includes(ext)) fileType = 'application/msword';
        else if (ext === '.txt') fileType = 'text/plain';
        
        // Create description and metadata
        let description = `Document about ${baseFilename.replace(/_/g, ' ')}`;
        let metadata = {
          filename,
          subject: 'Document',
          year: new Date().getFullYear().toString()
        };
        
        // Special handling for known files
        if (filename.includes("Ultimate_Display")) {
          description = "Ivan Sutherland's seminal 1965 paper 'The Ultimate Display' on virtual reality and computer graphics";
          metadata = {
            author: 'Ivan Sutherland',
            year: '1965',
            subject: 'Virtual Reality'
          };
        } else if (filename.includes("thing2reality")) {
          description = "Research poster titled 'Bridging the Gap Between Physical and Digital Reality' about tangible interfaces with virtual environments";
          metadata = {
            author: 'Research Team',
            year: '2023',
            subject: 'Mixed Reality'
          };
        }
        
        // Generate a unique ID
        const id = `server-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        return {
          id,
          name: baseFilename.replace(/_/g, ' '),
          filename,
          type: fileType,
          path: `/content/${filename}`,
          description,
          metadata,
          isOnServer: true
        };
      });
      
      res.json(contentFiles);
    } catch (error) {
      console.error('Error listing content files:', error);
      res.status(500).json({ success: false, message: 'Failed to list content files', error: error.message });
    }
  });

  // Setup static file serving for content directories
  const setupStaticContentServing = () => {
    const contentDir = process.env.NODE_ENV === 'production' ? path.join(__dirname, 'content') : path.join(__dirname, '..', 'content');
    app.use('/content', express.static(contentDir));
    console.log(`Serving content files from: ${contentDir}`);
  };

  // Initialize static content serving
  setupStaticContentServing();

  return { contentUpload };
}

export default setupContentRoutes; 