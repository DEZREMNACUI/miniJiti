import React, { useState } from "react";

interface CounterProps {
  initialValue?: number;
  step?: number;
}

/**
 * 一个简单的计数器组件
 */
export const Counter: React.FC<CounterProps> = ({
  initialValue = 0,
  step = 1,
}) => {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    setCount(count + step);
  };

  const decrement = () => {
    setCount(count - step);
  };

  return (
    <div className="counter">
      <h2>React TypeScript 计数器</h2>
      <p>当前计数: {count}</p>
      <div className="buttons">
        <button onClick={decrement}>减少 ({step})</button>
        <button onClick={increment}>增加 ({step})</button>
      </div>
    </div>
  );
};

// 示例用法
export const App = () => {
  console.log("App");
  return (
    <div>
      <h1>miniJiti TSX 示例</h1>
      <Counter initialValue={5} step={2} />
      <Counter />
    </div>
  );
};

App();

// 默认导出 App 组件
export default App;
