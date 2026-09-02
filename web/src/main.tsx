import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles/tokens.css";
import "./global.css";
// Visual Engine 样式（M9-007 回灌；取值全部来自 tokens.css 令牌，见 ui/visual-engine README）
import "./components/ui/visual-engine/visual-engine.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
