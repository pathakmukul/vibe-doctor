#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const server = new Server(
  {
    name: 'vibedoctor',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Find Claude Code conversation JSONLs directory
function findClaudeProjectsDir() {
  const claudeDir = join(homedir(), '.claude', 'projects');
  if (!existsSync(claudeDir)) {
    throw new Error('Claude Code projects directory not found at ~/.claude/projects');
  }
  return claudeDir;
}

// Find the active JSONL based on user message and recent timestamp
function findActiveSession(userMessage, args) {
  const projectsDir = findClaudeProjectsDir();
  const projectDirs = readdirSync(projectsDir);
  
  let mostRecentMatch = null;
  let mostRecentTime = 0;
  
  for (const projectDir of projectDirs) {
    const fullProjectPath = join(projectsDir, projectDir);
    if (!statSync(fullProjectPath).isDirectory()) continue;
    
    const jsonlFiles = readdirSync(fullProjectPath).filter(f => f.endsWith('.jsonl'));
    
    for (const jsonlFile of jsonlFiles) {
      const jsonlPath = join(fullProjectPath, jsonlFile);
      try {
        const content = readFileSync(jsonlPath, 'utf8');
        const lines = content.trim().split('\n');
        
        // Check last few lines for user message match
        const recentLines = lines.slice(-5); // Last 5 entries
        
        for (const line of recentLines) {
          const entry = JSON.parse(line);
          
          // Look for user messages that match our search
          if (entry.type === 'user' && 
              entry.message?.role === 'user' && 
              entry.message?.content) {
            
            // Handle both array and string content formats
            let contentText = '';
            if (Array.isArray(entry.message.content)) {
              contentText = entry.message.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join(' ');
            } else if (typeof entry.message.content === 'string') {
              contentText = entry.message.content;
            }
            contentText = contentText.toLowerCase();
            
            const searchText = userMessage.toLowerCase();
            
            // Check if this message contains our user message
            if (contentText.includes(searchText)) {
              const timestamp = new Date(entry.timestamp).getTime();
              
              if (timestamp > mostRecentTime) {
                mostRecentTime = timestamp;
                mostRecentMatch = {
                  jsonlPath,
                  projectDir: fullProjectPath,
                  cwd: entry.cwd,
                  sessionId: entry.sessionId,
                  timestamp: entry.timestamp
                };
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading ${jsonlPath}:`, error.message);
      }
    }
  }
  
  return mostRecentMatch;
}

// Extract revert operations from JSONL structuredPatch data
function extractRevertOperations(jsonlPath, count, conversationHistory) {
  const content = readFileSync(jsonlPath, 'utf8');
  const lines = content.trim().split('\n');
  
  const operations = [];
  
  // Calculate offset from previous reverts
  let totalAlreadyReverted = 0;
  const revertTags = conversationHistory.match(/\[VIBEDOCTOR CHANGES: (\d+)\]/g) || [];
  
  for (const tag of revertTags) {
    const match = tag.match(/\[VIBEDOCTOR CHANGES: (\d+)\]/);
    if (match) {
      totalAlreadyReverted += parseInt(match[1]);
    }
  }
  
  console.log(`Found ${revertTags.length} previous revert operations totaling ${totalAlreadyReverted} changes`);
  
  // Find all tool results with file changes
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'user' && entry.toolUseResult) {
        const result = entry.toolUseResult;
        
        // Handle file edits (oldString/newString replacement)
        if (result.oldString && result.newString) {
          console.log(`Found file edit: ${result.filePath}`);
          operations.push({
            type: 'replace',
            file: result.filePath,
            oldContent: result.newString, // What's currently there
            newContent: result.oldString, // What to change it back to
            timestamp: entry.timestamp
          });
        }
        // Handle file creations (make file empty) - only if explicitly a create operation
        else if (result.type === 'create' && result.content && !result.oldString) {
          console.log(`Found file creation: ${result.filePath}`);
          operations.push({
            type: 'empty',
            file: result.filePath,
            timestamp: entry.timestamp
          });
        }
        else {
          console.log(`Skipped operation: ${result.filePath}, type: ${result.type}, hasOldString: ${!!result.oldString}, hasNewString: ${!!result.newString}`);
        }
      }
    } catch (error) {
      // Skip invalid JSON lines
    }
  }
  
  // Sort by timestamp (newest first) then by line number (descending within files)
  operations.sort((a, b) => {
    const timeCompare = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeCompare !== 0) return timeCompare;
    
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) return fileCompare;
    
    return b.lineNumber - a.lineNumber;
  });
  
  // Skip operations we already reverted and take the count we want
  const operationsToRevert = operations.slice(totalAlreadyReverted, totalAlreadyReverted + count);
  
  console.log(`Selected ${operationsToRevert.length} operations to revert (skipped ${totalAlreadyReverted} already reverted)`);
  
  return operationsToRevert;
}

// Apply the revert operations
function applyRevertOperations(operations, workingDir) {
  const results = [];
  
  for (const op of operations) {
    try {
      if (op.type === 'replace') {
        // Read the file content
        const content = readFileSync(op.file, 'utf8');
        
        // Replace newString with oldString
        const updatedContent = content.replace(op.oldContent, op.newContent);
        
        // Write back to file
        writeFileSync(op.file, updatedContent, 'utf8');
        
        results.push(`✅ Replaced content in ${op.file}`);
        
      } else if (op.type === 'empty') {
        // Make the file empty to revert file creation
        writeFileSync(op.file, '', 'utf8');
        
        results.push(`✅ Emptied ${op.file} (reverted file creation)`);
      }
      
    } catch (error) {
      results.push(`❌ Error processing ${op.file}: ${error.message}`);
    }
  }
  
  return results;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'revert_last_changes',
        description: 'Intelligently reverts the last N changes made by Claude Code CLI by analyzing conversation JSONL files. Automatically finds the active session and reverts file modifications using structured patch data.',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'integer',
              description: 'Number of recent changes to revert (1-10)',
              minimum: 1,
              maximum: 10,
              default: 1
            },
            user_message: {
              type: 'string',
              description: 'The message you sent to Claude Code that triggered this revert request',
              default: ''
            },
            conversation_history: {
              type: 'string', 
              description: 'Conversation history to track previous revert operations',
              default: ''
            }
          },
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'revert_last_changes') {
    try {
      const count = request.params.arguments?.count || 1;
      const userMessage = request.params.arguments?.user_message || 'revert';
      const conversationHistory = request.params.arguments?.conversation_history || '';
      
      console.log(`VibeDoctor: Looking for session with user message: "${userMessage}"`);
      
      // Find the active session
      const session = findActiveSession(userMessage, request.params.arguments);
      
      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Could not find Claude Code session containing message: "${userMessage}"\n\nMake sure you're running this from the same session where you made the changes.`
            }
          ]
        };
      }
      
      console.log(`Found active session: ${session.sessionId} in ${session.cwd}`);
      
      // Extract revert operations from the JSONL
      const operations = extractRevertOperations(session.jsonlPath, count, conversationHistory);
      
      if (operations.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ No changes found to revert in session ${session.sessionId}.\n\nMake sure Claude Code has made file modifications in this session.`
            }
          ]
        };
      }
      
      // Apply the revert operations in the correct working directory
      const results = applyRevertOperations(operations, session.cwd);
      
      const successMessage = `✅ Successfully reverted last ${operations.length} changes. [VIBEDOCTOR CHANGES: ${operations.length}]\n\n` +
                           `Session: ${session.sessionId}\n` +
                           `Working Directory: ${session.cwd}\n\n` +
                           `Operations:\n${results.join('\n')}\n\n` +
                           `**Important:** Please include this tag in your response: [VIBEDOCTOR CHANGES: ${operations.length}]`;
      
      return {
        content: [
          {
            type: 'text',
            text: successMessage
          }
        ]
      };
      
    } catch (error) {
      console.error('VibeDoctor error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ VibeDoctor error: ${error.message}\n\nPlease ensure:\n- You're in a Claude Code session\n- Claude Code has made recent file changes\n- The conversation JSONL files are accessible`
          }
        ]
      };
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('VibeDoctor v2.0.0 MCP server running (JSONL-powered)');
}

main().catch((error) => {
  console.error('Failed to start VibeDoctor server:', error);
  process.exit(1);
});