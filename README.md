# miniJiti

一个简单的 TypeScript 和 TSX 运行时转换工具，无需预编译即可直接运行 .ts 和 .tsx 文件。

## 功能

* 支持直接运行 TypeScript (.ts) 文件
* 支持直接运行 TypeScript React (.tsx) 文件
* 使用 esbuild 进行快速转换
* 可作为命令行工具使用
* 也可以作为 Node.js 模块在代码中导入使用

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 命令行使用

```bash
# 直接运行 ts 文件
npx minijiti ./path/to/your/file.ts

# 直接运行 tsx 文件
npx minijiti ./path/to/your/file.tsx
```

### 在代码中使用

```javascript
const createJiti = require('minijiti');

// 创建一个 jiti 实例
const jiti = createJiti(__filename);

// 导入一个 ts/tsx 文件并直接使用
const {
    someFunction
} = jiti('./path/to/file.ts');
someFunction();
```

## 许可证

MIT 
