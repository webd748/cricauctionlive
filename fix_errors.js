const fs = require('fs')
const path = require('path')

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f)
    let isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f))
  })
}

walkDir(path.join(__dirname, 'src', 'app', 'api'), function(filePath) {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8')
    let original = content
    content = content.replace(/return errorJson\(message, authStatus\(message\)\)/g, "return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))")
    
    // Also, some generic catch blocks use error.message without safePublicErrorMessage? Let's check:
    // Actually the grep_search showed they use safePublicErrorMessage(error, fallback) for the main try/catch.
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log('Fixed', filePath)
    }
  }
})
