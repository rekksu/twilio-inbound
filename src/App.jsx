import { useEffect } from "react";

function App() {
  useEffect(() => {
    // Small delay to ensure component mounts properly
    setTimeout(() => {
      window.open("", "_self"); // Required for some browsers
      window.close();
    }, 100);
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>This tab will close automatically...</h2>
    </div>
  );
}

export default App;