# VibeDoctor 🩺

**Your Claude Code Development Companion** - An MCP server that intelligently reverts [Claude Code CLI](https://www.anthropic.com/claude-code) changes by analyzing clipboard exports. Handles additions, deletions, and mixed changes with smart state tracking.

## ✨ Features

- 🔄 **Smart Revert Logic**: Handles additions, deletions, and mixed changes correctly
- 📋 **Clipboard Analysis**: Parses Claude Code's exported conversation format automatically  
- 🎯 **Sequential Operations**: Tracks state through conversation history for "revert 2 more" workflows
- 🛡️ **Safe Processing**: Bottom-to-top line processing prevents conflicts
- 🏷️ **Auto-Tagging**: Includes completion tags for perfect state tracking
- 🔒 **Safety First**: Verifies clipboard contains valid Claude export before making any changes

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

### 1. Add to Claude Desktop Config
Add to your `claude_desktop_config.json`:

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

### 2. Config File Locations
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

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

1. **Export Conversation**: Use `/export` in Claude Code CLI after making changes
2. **Clipboard Verification**: VibeDoctor checks for `✻ Welcome to Claude Code!` header to ensure valid export
3. **Automatic Analysis**: Parses the clipboard for Claude Code's Update operations
4. **Smart Processing**: 
   - Deletes `+` lines (added content)
   - Restores `-` lines (removed content)  
   - Processes changes in FILO order to prevent conflicts
5. **State Tracking**: Uses conversation tags to handle sequential reverts

## 📋 Supported Operations

- ✅ **Pure Additions** (only `+` lines) → Deletes added content
- ✅ **Pure Deletions** (only `-` lines) → Restores removed content  
- ✅ **Mixed Changes** (both `+` and `-`) → Deletes additions AND restores deletions
- ✅ **Sequential Reverts** → "revert 2 more" works correctly with state tracking

## 🎨 Example Workflow

```bash
# 1. Make changes with Claude Code CLI
> add emoji to each section @index.html

# 2. Claude Code makes changes
⏺ Update(index.html) - adds emojis

# 3. Export conversation  
> /export

# 4. Revert if needed
> revert last change

# 5. Works! Emojis are removed
✅ Successfully reverted last 1 changes. [DONE LAST 1]
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

### "Clipboard verification failed"
- Run `/export` in your Claude Code CLI session
- Select "1. Copy to clipboard" 
- Ensure clipboard starts with `✻ Welcome to Claude Code!`

### "No Update operations found"
- Make sure you used `/export` after Claude Code made changes
- Verify clipboard contains the exported conversation

### "File not found" 
- Ensure you're in the correct working directory
- Check that the files mentioned in the export exist

### "Line out of range"
- Files may have been modified outside Claude Code between export and revert
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

## 🙋 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/pathakmukul/vibe-doctor/issues)
- **GitHub Discussions**: [Ask questions or share tips](https://github.com/pathakmukul/vibe-doctor/discussions)

---

**VibeDoctor** - *Keeping your code healthy, one revert at a time* 🩺✨ 