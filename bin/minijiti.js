#!/usr/bin/env node

const path = require("path");
const chalk = require("chalk");
const { program } = require("commander");
const createJiti = require("../dist/jiti").default;

// 设置版本和描述
program
  .version("0.1.0")
  .description("miniJiti - 一个简单的 TypeScript/TSX 运行时转换工具");

program
  .argument("<file>", "TypeScript 或 TSX 文件路径")
  .option("-d, --debug", "启用调试模式")
  .option("-nc, --no-cache", "禁用缓存")
  .action((file, options) => {
    try {
      const filePath = path.resolve(process.cwd(), file);
      const jiti = createJiti(__filename, {
        debug: options.debug,
        cache: options.cache,
      });

      console.log(chalk.blue(`[miniJiti] 正在运行文件: ${file}`));

      // 执行指定的文件
      jiti(filePath);
    } catch (error) {
      console.error(chalk.red(`[miniJiti] 运行失败: ${error.message}`));
      if (options.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
