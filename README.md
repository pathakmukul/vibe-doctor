# VibeDoctor 🩺 v2.0

**Your Claude Code CLI Development Companion** - An MCP server that intelligently reverts [Claude Code CLI](https://www.anthropic.com/claude-code) changes by analyzing conversation JSONL files. Automatically finds active sessions and reverts file modifications using structured patch data.

## ✨ Features

- 🎯 **Auto Session Detection**: Automatically finds your active Claude Code session by analyzing your message
- 🔄 **Universal Revert Logic**: Deletes `+` lines (added content), restores `-` lines (removed content)
- 📁 **Direct JSONL Access**: Reads conversation history directly from `~/.claude/projects/`
- 🏷️ **Sequential Operations**: Handles multiple revert commands with perfect state tracking  
- 🔢 **Flexible Count**: Revert last 1, 2, 3... up to 10 changes in one command
- 📍 **Correct Working Directory**: Uses the exact working directory from your Claude Code session
- 🔒 **Structured Patch Data**: Works with Claude Code's native JSON patch format for precision
- ⚡ **Claude Code CLI Integration**: Works exclusively with Claude Code CLI sessions

## 🚀 Installation

### Via npm (Recommended)
```bash
npm install -g vibedoctor
```

### Manual Installation
```bash
git clone https://github.com/pathakmukul/vibe-doctor.git
cd vibe-doctor
npm install
npm link
```

## ⚙️ Setup

### 1. Add to Claude Code CLI
Add VibeDoctor to your Claude Code CLI using the built-in MCP management:

```bash
claude mcp add-json "vibedoctor" '{"command":"vibedoctor","args":[]}'
```

### 2. Alternative: Manual Configuration
If you prefer manual configuration, you can also add it to other MCP-compatible clients:

```json
{
  "mcpServers": {
    "vibedoctor": {
      "command": "vibedoctor",
      "args": []
    }
  }
}
```

## 🎯 Usage

### Natural Language Commands (Recommended)
```
revert last 2 changes
undo the last 3 operations  
revert last change
fix my last mistake
undo that last update
revert the most recent 4 changes
```

### Explicit VibeDoctor Calls
```
use VibeDoctor to revert last 2
VibeDoctor revert 3 operations
vibedoctor undo last change
call VibeDoctor to fix last 5 changes
run VibeDoctor revert last operation
use vibedoctor to undo last 3 updates
```

## 🔧 How It Works

1. **Send Message**: Ask VibeDoctor to revert changes (e.g., "revert last 2 changes")
2. **Auto Session Detection**: VibeDoctor finds your active session by matching your message to recent JSONL entries
3. **Direct JSONL Access**: Reads conversation history directly from `~/.claude/projects/[your-project]/[session-id].jsonl`
4. **Structured Patch Parsing**: Extracts `+`/`-` lines from `toolUseResult.structuredPatch` data
5. **Smart Processing**: 
   - Deletes `+` lines (added content)
   - Restores `-` lines (removed content)  
   - Processes changes in FILO order to prevent conflicts
6. **Correct Working Directory**: Uses the `cwd` from the JSONL session data
7. **State Tracking**: Uses conversation tags to handle sequential reverts

## 📋 Supported Operations

- ✅ **Pure Additions** (only `+` lines) → Deletes added content
- ✅ **Pure Deletions** (only `-` lines) → Restores removed content  
- ✅ **Mixed Changes** (both `+` and `-`) → Deletes additions AND restores deletions
- ✅ **Sequential Reverts** → "revert 2 more" works correctly with state tracking

## 🎨 Example Workflow

```bash
# 1. Install VibeDoctor in Claude Code CLI
$ claude mcp add-json "vibedoctor" '{"command":"vibedoctor","args":[]}'

# 2. Make changes with Claude Code CLI
> add emoji to each section @index.html

# 3. Claude Code makes changes
⏺ Update(index.html) - adds emojis

# 4. Revert if needed
> revert last change

# 5. Works! Emojis are removed
✅ Successfully reverted last 1 changes. [VIBEDOCTOR CHANGES: 1]
Session: d9e3caf1-0ca2-490d-b914-012e952193fe
Working Directory: /Users/username/projects/myproject
```

## 🔍 Advanced Features

### State Tracking
VibeDoctor automatically tracks what's been reverted:
```
> revert last 2      # Reverts operations 1-2
> revert 2 more      # Reverts operations 3-4 (not 1-2 again!)
```

### Conversation History Integration
No external state files needed - uses conversation tags for perfect tracking.

## 🐛 Troubleshooting

### "Could not find Claude Code session"
- Make sure you're running this from the same Claude Code CLI session where you made changes
- Verify your message contains the keywords you're trying to revert
- Check that `~/.claude/projects/` directory exists and contains your project

### "No changes found to revert"
- Ensure Claude Code CLI has made file modifications in this session
- Check that the JSONL file contains file modification entries
- Verify you haven't already reverted all available changes

### "File not found" 
- The working directory from Claude Code CLI session may differ from current directory
- Files may have been moved or deleted since the changes were made

### "Line out of range"
- Files may have been modified outside Claude Code CLI between changes and revert
- Manual review may be needed for complex changes

## 🏗️ Technical Details

- **Platform**: Node.js 18+ 
- **Protocol**: Model Context Protocol (MCP)
- **Dependencies**: `@modelcontextprotocol/sdk`
- **Processing**: Pure JavaScript with shell command integration

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Add tests if applicable
5. Submit a pull request

## 📝 Note

VibeDoctor is designed specifically for Claude Code CLI and will not work with other Claude interfaces (web, desktop app, etc.).

## 🙋 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/pathakmukul/vibe-doctor/issues)
- **GitHub Discussions**: [Ask questions or share tips](https://github.com/pathakmukul/vibe-doctor/discussions)

---

**VibeDoctor** - *Keeping your code healthy, one revert at a time* 🩺✨ 