#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const server = new Server({
  name: 'VibeDoctor',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'revert_last_changes',
        description: 'Revert the last N changes made by Claude from the clipboard export. Use count parameter to specify how many changes to revert (e.g., count: 3 for "revert last 3 changes"). Automatically tracks state through conversation history to handle sequential revert operations correctly.',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description: 'Number of recent changes to revert. Default is 1. Use 2 for "revert last 2 changes", 3 for "revert last 3 changes", etc.',
              default: 1,
              minimum: 1,
              maximum: 10
            },
            conversation_history: {
              type: 'string',
              description: 'The conversation history to scan for previous revert operations. This is used to calculate the correct offset for sequential reverts.',
              default: ''
            }
          },
          additionalProperties: false
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'revert_last_changes') {
    try {
      const count = request.params.arguments?.count || 1;
      const conversationHistory = request.params.arguments?.conversation_history || '';
      
      // Calculate offset from conversation history
      let totalAlreadyReverted = 0;
      const revertTags = conversationHistory.match(/\[DONE LAST (\d+)\]/g) || [];
      
      for (const tag of revertTags) {
        const match = tag.match(/\[DONE LAST (\d+)\]/);
        if (match) {
          totalAlreadyReverted += parseInt(match[1]);
        }
      }
      
      console.log(`Found ${revertTags.length} previous revert operations totaling ${totalAlreadyReverted} changes`);
      
      const tempFile = join(tmpdir(), 'e.txt');
      const updateLinesFile = join(tmpdir(), 'update_lines.txt');

      const command = `
echo "=== STARTING REVERT (${count} changes, offset: ${totalAlreadyReverted}) ===" &&
echo "1. Saving clipboard to ${tempFile}..." &&
pbpaste > ${tempFile} &&
echo "   Saved $(wc -l < ${tempFile}) lines" &&
echo "" &&
echo "2. Finding Update operations (skipping first ${totalAlreadyReverted}, taking next ${count})..." &&
grep -n "^⏺ Update(" ${tempFile} | tail -$((${totalAlreadyReverted} + ${count})) | head -${count} > ${updateLinesFile} &&
echo "   Found $(cat ${updateLinesFile} | wc -l) Update operations" &&
echo "" &&
echo "3. Processing changes in FILO order..." &&
if [ -s ${updateLinesFile} ]; then
  python3 -c "
import sys
import re
import os

# Read the update line numbers from file and reverse them
with open('${updateLinesFile}', 'r') as f:
    update_lines = [int(line.strip().split(':')[0]) for line in f if line.strip()]

# Reverse the list for FILO processing
update_lines.reverse()

print(f'   Total updates to process: {len(update_lines)}')
print(f'   Offset applied: ${totalAlreadyReverted} (from conversation history)')

if not update_lines:
    print('   No update lines found!')
    sys.exit(0)

# Process each update in FILO order
for i, current_update in enumerate(update_lines):
    print(f'   Processing Update {i+1}/{len(update_lines)} at line: {current_update}')
    
    # Find the next update line to know where this update block ends
    next_update = None
    for other_line in update_lines:
        if other_line > current_update:
            next_update = other_line
            break
    
    next_info = next_update if next_update else 'end of file'
    print(f'     Next update at line: {next_info}')
    
    # Read the file content
    try:
        with open('${tempFile}', 'r') as f:
            file_lines = f.readlines()
        print(f'     Read {len(file_lines)} lines from clipboard file')
    except Exception as e:
        print(f'     Error reading clipboard file: {e}')
        continue
    
    # Extract the relevant section
    if next_update:
        # Process between current and next update
        relevant_lines = file_lines[current_update-1:next_update-1]
    else:
        # Process from current update to end
        relevant_lines = file_lines[current_update-1:]
    
    print(f'     Extracted {len(relevant_lines)} relevant lines')
    
    # Parse the update section
    filename = None
    changes_made = False
    
    # Find the filename from Update() line
    for line in relevant_lines:
        if line.startswith('⏺ Update('):
            match = re.search(r'Update\\(([^)]+)\\)', line)
            if match:
                filename = match.group(1)
                print(f'     File: {filename}')
                break
    
    if not filename:
        print('     No filename found in this update section')
        for j, line in enumerate(relevant_lines[:10]):  # Show first 10 lines for debugging
            print(f'       Line {j}: {line.strip()}')
        continue
    
    # Collect all changes for this update
    line_changes = []
    in_changes_section = False
    
    for line in relevant_lines:
        # Look for the changes section (lines with numbers and +/-)
        if re.match(r'^\\s+\\d+\\s+[-+]\\s+', line):
            in_changes_section = True
            line_match = re.match(r'^\\s+(\\d+)\\s+([-+])\\s+(.*)$', line)
            if line_match:
                line_num = int(line_match.group(1))
                change_type = line_match.group(2)
                content = line_match.group(3)
                
                if change_type == '-':
                    # This is content that was removed, so we need to restore it
                    line_changes.append((line_num, 'restore', content))
                    print(f'     Found removed line {line_num}: {content[:60]}... (will restore)')
                elif change_type == '+':
                    # This is content that was added, so we need to delete it
                    line_changes.append((line_num, 'delete', content))
                    print(f'     Found added line {line_num}: {content[:60]}... (will delete)')
        elif in_changes_section and not re.match(r'^\\s+\\d+', line) and line.strip():
            # We've moved past the changes section
            break
    
    print(f'     Found {len(line_changes)} line changes to process')
    
    # Sort changes by line number in descending order (bottom to top)
    line_changes.sort(key=lambda x: x[0], reverse=True)
    
    if line_changes and os.path.exists(filename):
        try:
            # Read the file
            with open(filename, 'r') as f:
                file_lines = f.readlines()
            
            print(f'     Processing {len(line_changes)} line changes...')
            
            # Apply changes from bottom to top: first delete +, then restore -
            # Process deletions first (+ lines that were added)
            for line_num, action, content in line_changes:
                if action == 'delete':
                    if 0 <= line_num - 1 < len(file_lines):
                        current_content = file_lines[line_num - 1].rstrip()
                        # Remove the line by deleting it from the list
                        del file_lines[line_num - 1]
                        
                        print(f'     ✓ Line {line_num} (deleted):')
                        print(f'       REMOVED: {current_content[:80]}...')
                        changes_made = True
                    else:
                        print(f'     ✗ Line {line_num} is out of range (file has {len(file_lines)} lines)')
            
            # Then process restorations (- lines that were removed)
            for line_num, action, content in line_changes:
                if action == 'restore':
                    if 0 <= line_num - 1 <= len(file_lines):
                        line_ending = '\\n' if not content.endswith('\\n') else ''
                        file_lines.insert(line_num - 1, content + line_ending)
                        
                        print(f'     ✓ Line {line_num} (restored):')
                        print(f'       INSERTED: {content[:80]}...')
                        changes_made = True
                    else:
                        print(f'     ✗ Line {line_num} is out of range for insertion (file has {len(file_lines)} lines)')
            
            if changes_made:
                # Write back to file
                with open(filename, 'w') as f:
                    f.writelines(file_lines)
                print(f'     ✓ File {filename} updated successfully with {len(line_changes)} changes')
            
        except Exception as e:
            print(f'     ✗ Failed to process file {filename}: {e}')
    elif filename and not os.path.exists(filename):
        print(f'     ✗ File {filename} not found')
    elif not line_changes:
        print(f'     ⚠ No line changes found for this update')
        # Show some sample lines for debugging
        print('     Sample lines from this update:')
        for j, line in enumerate(relevant_lines[:15]):
            print(f'       {j+current_update}: {line.strip()}')
    else:
        print(f'     ⚠ No filename found for this update')
    
    print('     ---')

# Clean up
try:
    os.remove('${updateLinesFile}')
except:
    pass
"
else
  echo "No Update operations found in clipboard"
fi &&
echo "" &&
echo "=== REVERT COMPLETE ==="
`;
      
      const output = execSync(command, {encoding: 'utf8'});
      
      // Generate the response that Claude should include in its visible response
      const responseText = `${output}

✅ Successfully reverted last ${count} changes.

**Important:** Include this tag in your response: [DONE LAST ${count}]

This tag helps track the revert history for future sequential operations. Make sure to mention this tag when you respond to the user about the revert completion.`;
      
      return { 
        content: [{ 
          type: 'text', 
          text: responseText
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error reverting changes: ${error.message}` 
        }] 
      };
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);