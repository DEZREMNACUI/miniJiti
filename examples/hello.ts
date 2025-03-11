interface Person {
  name: string;
  age: number;
  greet(): void;
}

class Student implements Person {
  constructor(public name: string, public age: number, private grade: string) { }

  greet(): void {
    console.log(`你好，我叫${this.name}，今年${this.age}岁，就读于${this.grade}年级。`);
  }

  study(subject: string): void {
    console.log(`${this.name}正在学习${subject}...`);
  }
}

const student = new Student('小明', 15, '初三');
student.greet();
student.study('TypeScript');

// 使用泛型
function identity<T>(arg: T): T {
  return arg;
}

const output = identity<string>('Hello, TypeScript!');
console.log(output);

// 导出函数供其他模块使用
export function sum(a: number, b: number): number {
  return a + b;
}

console.log(`1 + 2 = ${sum(1, 2)}`);

// 测试完毕
console.log('TypeScript 示例运行成功！'); 