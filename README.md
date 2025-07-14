# VibeDoctor 🩺

**Your Claude Development Companion** - An MCP server that intelligently reverts Claude's code changes by analyzing clipboard exports. Handles additions, deletions, and mixed changes with smart state tracking.

## ✨ Features

- 🔄 **Smart Revert Logic**: Handles additions, deletions, and mixed changes correctly
- 📋 **Clipboard Analysis**: Parses Claude's exported conversation format automatically  
- 🎯 **Sequential Operations**: Tracks state through conversation history for "revert 2 more" workflows
- 🛡️ **Safe Processing**: Bottom-to-top line processing prevents conflicts
- 🏷️ **Auto-Tagging**: Includes completion tags for perfect state tracking

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

### Natural Language (Recommended)
```
revert last 2 changes
undo the last 3 operations  
revert last change
```

### Explicit VibeDoctor Calls
```
use VibeDoctor to revert last 2
VibeDoctor revert 3 operations
vibedoctor undo last change
```

## 🔧 How It Works

1. **Export Conversation**: Use `/export` in Claude after making changes
2. **Automatic Analysis**: VibeDoctor parses the clipboard for Claude's Update operations
3. **Smart Processing**: 
   - Deletes `+` lines (added content)
   - Restores `-` lines (removed content)  
   - Processes changes in FILO order to prevent conflicts
4. **State Tracking**: Uses conversation tags to handle sequential reverts

## 📋 Supported Operations

- ✅ **Pure Additions** (only `+` lines) → Deletes added content
- ✅ **Pure Deletions** (only `-` lines) → Restores removed content  
- ✅ **Mixed Changes** (both `+` and `-`) → Deletes additions AND restores deletions
- ✅ **Sequential Reverts** → "revert 2 more" works correctly with state tracking

## 🎨 Example Workflow

```bash
# 1. Make changes with Claude
> add emoji to each section @index.html

# 2. Claude makes changes
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

### "No Update operations found"
- Make sure you used `/export` after Claude made changes
- Verify clipboard contains the exported conversation

### "File not found" 
- Ensure you're in the correct working directory
- Check that the files mentioned in the export exist

### "Line out of range"
- Files may have been modified outside Claude between export and revert
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