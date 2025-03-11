import * as path from 'path';
import * as fs from 'fs';
import { transformSync } from '@babel/core';
import { buildSync } from 'esbuild';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as vm from 'vm';

// 类型定义
interface JitiOptions {
  debug?: boolean;
  cache?: boolean;
  requireCache?: boolean;
  extensions?: string[];
  transformOptions?: any;
  sourceMaps?: boolean;
}

interface Module {
  exports: any;
  require: any;
  id: string;
  filename: string;
  loaded: boolean;
  path?: string;
  paths?: string[];
  children?: Module[];
  parent?: Module;
}

/**
 * 检测当前是否运行在 Bun 环境中
 */
function isBun(): boolean {
  return typeof process !== 'undefined' &&
    typeof process.versions !== 'undefined' &&
    typeof (process.versions as any).bun !== 'undefined';
}

/**
 * 创建一个 miniJiti 实例
 */
function createJiti(
  filename: string,
  options: JitiOptions = {},
  parentModule?: any
): (id: string) => any {
  // 设置默认选项
  const jitiOptions: JitiOptions = {
    debug: false,
    cache: true,
    requireCache: true,
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.mjs'],
    transformOptions: {},
    sourceMaps: true,
    ...options,
  };

  // 获取调用者的目录
  const callerDir = path.dirname(filename);

  // 检查是否在 Bun 环境中运行
  const runningInBun = isBun();
  // 如果是 Bun 环境，可以使用 Bun 内置的加载机制
  if (runningInBun) {
    console.log('[miniJiti] 检测到 Bun 运行时环境，将使用 Bun 内置的 TypeScript/JSX 支持');
    return function bunJitiFn(id: string): any {
      // 解析模块路径
      const resolvedPath = resolveModulePath(id, callerDir, jitiOptions.extensions || []);

      if (!resolvedPath) {
        throw new Error(`Cannot find module '${id}'`);
      }

      // 使用 Bun 的内置 require
      // @ts-ignore - Bun 类型可能未定义
      return require(resolvedPath);
    };
  }


  // 创建一个 require 函数
  const _require = createRequire(filename);

  /**
   * 通过 esbuild 快速转换 TS 代码
   */
  function transformWithEsbuild(source: string, filePath: string): string {
    const result = buildSync({
      entryPoints: [filePath],
      write: false,
      bundle: false,
      format: 'cjs',
      platform: 'node',
      loader: {
        [path.extname(filePath)]: path.extname(filePath).slice(1) as any
      },
      sourcemap: 'inline',
      target: 'node14',
    });

    return result.outputFiles[0].text;
  }

  /**
   * 通过 Babel 转换 TS/TSX 代码
   */
  function transformWithBabel(source: string, filePath: string): string {
    const isJSX = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const result = transformSync(source, {
      filename: filePath,
      sourceMaps: 'inline',
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript', { isTSX: isJSX, allExtensions: true }],
        isJSX && '@babel/preset-react'
      ].filter(Boolean),
      ...jitiOptions.transformOptions
    });

    return result?.code || '';
  }

  /**
   * 转换并运行一个模块
   */
  function jitiFn(id: string): any {
    // 解析模块路径
    const resolvedPath = resolveModulePath(id, callerDir, jitiOptions.extensions || []);

    if (!resolvedPath) {
      throw new Error(`Cannot find module '${id}'`);
    }

    // 检查模块缓存
    const nodeRequire = _require as any;
    if (jitiOptions.requireCache && nodeRequire.cache && nodeRequire.cache[resolvedPath]) {
      return nodeRequire.cache[resolvedPath].exports;
    }

    // 读取文件内容
    const source = fs.readFileSync(resolvedPath, 'utf-8');
    let transformedCode = '';

    try {
      // 根据文件类型选择转换方法
      if (resolvedPath.endsWith('.ts') || resolvedPath.endsWith('.tsx')) {
        // 使用 esbuild 进行快速转换
        transformedCode = transformWithEsbuild(source, resolvedPath);
      } else if (resolvedPath.endsWith('.js')) {
        // 直接返回 JS 文件
        transformedCode = source;
      } else if (resolvedPath.endsWith('.json')) {
        // 处理 JSON 文件
        return JSON.parse(source);
      } else {
        // 默认使用 Babel 进行转换
        transformedCode = transformWithBabel(source, resolvedPath);
      }

      // 在转换后的代码中添加路径解析辅助函数
      const moduleDir = path.dirname(resolvedPath);
      const preamble = `
        const originalRequire = require;
        const createJiti = require('${__filename}').default;
        const jitiInstance = createJiti('${resolvedPath}');
        
        const __miniJitiRequire = (id) => {
          // 只处理相对路径，其他路径使用原始 require
          if (id.startsWith('./') || id.startsWith('../')) {
            const ext = require('path').extname(id);
            // 如果是 .ts 或 .tsx 文件，使用 jiti 处理
            if (ext === '.ts' || ext === '.tsx' || !ext) {
              return jitiInstance(id);
            }
          }
          return originalRequire(id);
        };
        
        // 保存原始 require 并替换
        require = __miniJitiRequire;
      `;

      transformedCode = preamble + transformedCode;

      // 创建模块
      const moduleObj: Module = {
        exports: {},
        require: _require,
        id: resolvedPath,
        filename: resolvedPath,
        loaded: false,
      };

      // 运行转换后的代码
      const script = new vm.Script(
        `(function (exports, require, module, __filename, __dirname) { ${transformedCode} \n});`,
        { filename: resolvedPath }
      );

      const fn = script.runInThisContext();
      fn(
        moduleObj.exports,
        moduleObj.require,
        moduleObj,
        resolvedPath,
        path.dirname(resolvedPath)
      );

      moduleObj.loaded = true;

      // 缓存模块
      if (jitiOptions.requireCache && nodeRequire.cache) {
        nodeRequire.cache[resolvedPath] = moduleObj as any;
      }

      return moduleObj.exports;
    } catch (error) {
      console.error(`Error transforming or executing ${resolvedPath}:`, error);
      throw error;
    }
  }

  /**
   * 解析模块路径
   */
  function resolveModulePath(id: string, basedir: string, extensions: string[]): string | null {
    try {
      // 尝试直接解析
      return _require.resolve(id);
    } catch (error) {
      // 如果是相对路径
      if (id.startsWith('./') || id.startsWith('../') || path.isAbsolute(id)) {
        const absolutePath = path.isAbsolute(id) ? id : path.resolve(basedir, id);

        // 尝试添加扩展名
        for (const ext of extensions) {
          const pathWithExt = absolutePath + ext;
          if (fs.existsSync(pathWithExt)) {
            return pathWithExt;
          }
        }

        // 尝试直接路径
        if (fs.existsSync(absolutePath)) {
          return absolutePath;
        }

        // 尝试作为目录解析 (寻找 index 文件)
        if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
          for (const ext of extensions) {
            const indexPath = path.join(absolutePath, 'index' + ext);
            if (fs.existsSync(indexPath)) {
              return indexPath;
            }
          }
        }
      }
    }
    return null;
  }

  return jitiFn;
}

export default createJiti;

// 如果直接运行此文件
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('请指定要运行的文件路径');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args[0]);

  // 检测 Bun 环境并提供信息
  if (isBun()) {
    console.log('[miniJiti] 检测到 Bun 运行时环境，将使用 Bun 内置的 TypeScript/JSX 支持');
  }

  const jiti = createJiti(__filename);

  try {
    // 运行指定的文件
    jiti(filePath);
  } catch (error) {
    console.error('运行失败:', error);
    process.exit(1);
  }
}
