import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config();

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContentManager {
  constructor() {
    this.contentStore = new Map(); // Store content by ID
    this.contentOwnership = new Map(); // Map content IDs to owners (agents or parties)
    this.contentDir = path.join(__dirname, 'content');
  }

  /**
   * Load content from a file
   * @param {string} filename - The name of the file to load
   * @returns {Promise<{id: string, text: string, metadata: object}>} Content object
   */
  async loadContent(filename) {
    try {
      let filePath = path.join(this.contentDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found at: ${filePath}`);
        // Try alternative paths
        const altPath1 = path.join(__dirname, 'content', filename);
        const altPath2 = path.join(__dirname, filename);
        
        if (fs.existsSync(altPath1)) {
          console.log(`File found at alternative path: ${altPath1}`);
          filePath = altPath1;
        } else if (fs.existsSync(altPath2)) {
          console.log(`File found at alternative path: ${altPath2}`);
          filePath = altPath2;
        } else {
          throw new Error(`File not found: ${filename} - tried paths: ${filePath}, ${altPath1}, ${altPath2}`);
        }
      }
      
      // Extract file extension
      const ext = path.extname(filename).toLowerCase();
      const baseFilename = path.basename(filename, ext);
      
      let text = '';
      let description = '';
      let metadata = {
        filename,
        filepath: filePath,  // Store the actual filepath
        type: ext,
        createdAt: new Date().toISOString()
      };
      
      // Create a file description based on the filename
      if (filename.includes("Ultimate_Display")) {
        description = "Ivan Sutherland's seminal 1965 paper 'The Ultimate Display' on virtual reality and computer graphics";
        metadata.info = { 
          title: "The Ultimate Display", 
          author: "Ivan Sutherland", 
          subject: "Virtual Reality",
          year: "1965"
        };
      } else if (filename.includes("thing2reality")) {
        description = "Research poster titled 'Bridging the Gap Between Physical and Digital Reality' about tangible interfaces with virtual environments";
        metadata.info = { 
          title: "Bridging the Gap Between Physical and Digital Reality", 
          author: "Research Team", 
          subject: "Mixed Reality",
          year: "2023"
        };
      } else {
        description = `Document about ${baseFilename.replace(/_/g, ' ')}`;
        metadata.info = { 
          title: baseFilename.replace(/_/g, ' '), 
          subject: "Document"
        };
      }
      
      // Store a placeholder text for display in non-Gemini contexts
      text = `[PDF Content: ${filename}]\n\nThis is a PDF file containing ${description}.\n\nThe actual PDF file will be attached to API calls when using Gemini models.`;
      
      // Generate a unique ID for this content
      const contentId = `content-${Date.now()}`;
      
      // Store the content
      const contentObj = { id: contentId, text, description, metadata };
      this.contentStore.set(contentId, contentObj);
      
      return contentObj;
    } catch (error) {
      console.error('Error loading content:', error);
      throw error;
    }
  }
  
  /**
   * Assign ownership of content to agents or parties
   * @param {string} contentId - ID of the content
   * @param {string|Array<string>} owners - Agent name(s) or party name(s)
   * @param {boolean} isParty - Whether the owners are parties
   * @param {string|null} presenter - Agent or party presenting the content
   */
  assignOwnership(contentId, owners, isParty = false, presenter = null) {
    if (!this.contentStore.has(contentId)) {
      throw new Error(`Content with ID ${contentId} not found`);
    }
    
    // Convert single owner to array
    const ownersList = Array.isArray(owners) ? owners : [owners];
    
    // If presenter is not specified, use the first owner as presenter
    const contentPresenter = presenter || (ownersList.length > 0 ? ownersList[0] : null);
    
    // Store ownership information
    this.contentOwnership.set(contentId, {
      owners: ownersList,
      isParty,
      public: ownersList.length === 0, // If no owners specified, content is public
      presenter: contentPresenter,
      presenterIsParty: presenter ? isParty : (ownersList.length > 0 ? isParty : false)
    });
    
    const presenterInfo = contentPresenter 
      ? `, presented by ${contentPresenter} (${this.contentOwnership.get(contentId).presenterIsParty ? 'party' : 'agent'})`
      : '';
      
    console.log(`Content ${contentId} ownership assigned to ${ownersList.join(', ')} (${isParty ? 'party' : 'agent'})${presenterInfo}`);
  }
  
  /**
   * Set content as public (accessible to all agents)
   * @param {string} contentId - ID of the content
   * @param {string|null} presenter - Agent or party presenting the content
   * @param {boolean} presenterIsParty - Whether the presenter is a party
   */
  setContentAsPublic(contentId, presenter = null, presenterIsParty = false) {
    if (!this.contentStore.has(contentId)) {
      throw new Error(`Content with ID ${contentId} not found`);
    }
    
    this.contentOwnership.set(contentId, {
      owners: [],
      isParty: false,
      public: true,
      presenter: presenter,
      presenterIsParty: presenterIsParty
    });
    
    const presenterInfo = presenter 
      ? ` (presented by ${presenter} as ${presenterIsParty ? 'party' : 'agent'})` 
      : '';
      
    console.log(`Content ${contentId} set as public${presenterInfo}`);
  }
  
  /**
   * Check if an agent has access to specific content
   * @param {string} contentId - ID of the content
   * @param {string} agentName - Name of the agent
   * @param {Map} partyMembership - Map of agent names to party names
   * @returns {boolean} Whether the agent has access
   */
  hasAccess(contentId, agentName, partyMembership) {
    if (!this.contentStore.has(contentId)) {
      return false;
    }
    
    const ownership = this.contentOwnership.get(contentId);
    
    // Public content is accessible to everyone
    if (ownership.public) {
      return true;
    }
    
    // Check direct agent ownership
    if (!ownership.isParty && ownership.owners.includes(agentName)) {
      return true;
    }
    
    // Check party membership ownership
    if (ownership.isParty && partyMembership) {
      const agentParty = partyMembership.get(agentName);
      return ownership.owners.includes(agentParty);
    }
    
    return false;
  }
  
  /**
   * Get content by ID
   * @param {string} contentId - ID of the content
   * @returns {object|null} Content object or null if not found
   */
  getContent(contentId) {
    return this.contentStore.get(contentId) || null;
  }
  
  /**
   * Get a list of all content IDs
   * @returns {Array<string>} Array of content IDs
   */
  getContentIds() {
    return Array.from(this.contentStore.keys());
  }
  
  /**
   * Get ownership information for content
   * @param {string} contentId - ID of the content
   * @returns {object|null} Ownership object or null if not found
   */
  getOwnership(contentId) {
    return this.contentOwnership.get(contentId) || null;
  }
  
  /**
   * Generate a summary of the content
   * @param {string} contentId - ID of the content
   * @param {number} maxLength - Maximum length of the summary
   * @returns {string} Summary of the content
   */
  getSummary(contentId, maxLength = 500) {
    const content = this.contentStore.get(contentId);
    if (!content) {
      return '';
    }
    
    // For now, just return the first part of the content
    // This could be replaced with an actual summarization algorithm
    return content.text.substring(0, maxLength) + (content.text.length > maxLength ? '...' : '');
  }
  
  /**
   * Get content prompt for agent
   * @param {string} contentId - ID of the content 
   * @param {string} agentName - Name of the agent
   * @param {Map} partyMembership - Map of agent names to party names
   * @returns {string|object} Content prompt or empty string if no access
   */
  getContentPrompt(contentId, agentName, partyMembership) {
    if (!this.hasAccess(contentId, agentName, partyMembership)) {
      return '';
    }
    
    const content = this.contentStore.get(contentId);
    if (!content) {
      return '';
    }
    
    const ownership = this.contentOwnership.get(contentId);
    let ownershipText = '';
    let presenterText = '';
    let roleGuidance = '';
    
    if (ownership.public) {
      ownershipText = 'This content is public and available to everyone.';
    } else if (ownership.isParty) {
      ownershipText = `This content belongs to the following parties: ${ownership.owners.join(', ')}.`;
    } else {
      ownershipText = `This content belongs to the following agents: ${ownership.owners.join(', ')}.`;
    }
    
    // Check if agent is presenter or part of presenting party
    const isPresenter = ownership.presenterIsParty 
      ? partyMembership.get(agentName) === ownership.presenter 
      : agentName === ownership.presenter;
    
    if (isPresenter) {
      presenterText = `You are presenting this content. Take initiative to explain key points, answer questions, and guide the discussion.`;
      roleGuidance = `As the presenter, you should:
- Explain the content clearly and thoroughly
- Highlight important aspects that others might miss
- Respond to questions with authority and expertise
- Provide additional context where helpful`;
    } else {
      const presenterDescription = ownership.presenterIsParty
        ? `the ${ownership.presenter} party`
        : ownership.presenter;
      
      presenterText = `This content is being presented by ${presenterDescription}.`;
      roleGuidance = `Since you are not the presenter, you should:
- Ask questions about aspects you find interesting or unclear
- Seek clarification on technical details or methodology
- Provide constructive feedback from your area of expertise
- Connect ideas to your own knowledge and experience
- Wait for the presenter to explain before making assumptions`;
    }
    
    // Return an object with both the text prompt and file information for API calls
    return {
      textPrompt: `
ATTACHED CONTENT: ${content.metadata.filename}
TITLE: ${content.metadata.info?.title || content.metadata.filename}
${ownershipText}
${presenterText}
${roleGuidance}

${content.text}
      `.trim(),
      filepath: content.metadata.filepath,
      description: content.description || content.metadata.info?.title || content.metadata.filename,
      isPresenter
    };
  }
}

export default ContentManager; 